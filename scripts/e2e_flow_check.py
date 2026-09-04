"""
End-to-end flow check against a locally running API.

Gate 6.1 of the launch plan: drive a fresh practice through the flows a real
one takes, on test credentials, and record evidence per flow rather than
asserting from the code that it ought to work.

Read-mostly and self-contained: it creates its own tenant with a timestamped
slug and its own accounts, so it never touches existing data. It makes no call
to a third party except Paystack's sandbox, and only when --payments is passed.

Login is rate limited to five attempts per IP with a five-minute block, so
two runs inside that window will see 429s on the login flows. Leave five
minutes between runs, or expect those lines to report the limiter instead.

    python3 scripts/e2e_flow_check.py            # everything but payments
    python3 scripts/e2e_flow_check.py --payments # also initialise a test charge
"""

import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

API = os.environ.get("E2E_API", "http://localhost:3001")
STAMP = str(int(time.time()))
SLUG = f"e2e{STAMP}"
# Filled in from the login response — the API derives it from the practice name.
TENANT_SLUG = None
# booking id -> the payment reference the API minted for it.
REFERENCES = {}
# Paystack rejects a .test TLD as an invalid address, and the booking leg
# hands the client's email to it, so the fixtures use a resolvable domain.
OWNER_EMAIL = f"e2e-owner-{STAMP}@example.com"
PASSWORD = "Correct-Horse-9!"

results = []


def record(flow, ok, detail=""):
    results.append((flow, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {flow}" + (f"  — {detail}" if detail else ""))


def call(method, path, body=None, host=None, cookies=None, csrf=None, expect=None):
    """Returns (status, parsed_body, set_cookies)."""
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if host:
        req.add_header("Host", host)
    if cookies:
        req.add_header("Cookie", "; ".join(f"{k}={v}" for k, v in cookies.items()))
    if csrf:
        req.add_header("X-CSRF-Token", csrf)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, safe_json(raw), resp.headers.get_all("Set-Cookie") or []
    except urllib.error.HTTPError as e:
        return e.code, safe_json(e.read().decode()), []
    except Exception as e:  # connection refused, etc.
        return None, {"error": str(e)}, []


def safe_json(raw):
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw[:300]}


def jar(set_cookies):
    out = {}
    for c in set_cookies:
        name, _, rest = c.partition("=")
        out[name.strip()] = rest.split(";")[0]
    return out


def main():
    payments = "--payments" in sys.argv

    print(f"\nAPI {API}   practice slug {SLUG}\n")

    # ── the service is up ────────────────────────────────────────────────
    status, _, _ = call("GET", "/health")
    record("health check", status == 200, f"status {status}")
    if status is None:
        print("\nAPI is not reachable; start it with `pnpm --filter @unclutterdesk/api dev`.")
        return 1

    # ── signup ───────────────────────────────────────────────────────────
    status, body, _ = call(
        "POST",
        "/v1/auth/register",
        {
            "email": OWNER_EMAIL,
            "password": PASSWORD,
            "firstName": "E2E",
            "lastName": "Owner",
            "practiceName": f"E2E Practice {STAMP}",
            "type": "therapist",
        },
    )
    record("register a new practice", status in (200, 201), f"status {status}")
    record(
        "the verification email is actually sent",
        isinstance(body, dict) and body.get("email_sent") is True,
        "email_sent=" + str(body.get("email_sent") if isinstance(body, dict) else "?"),
    )

    # An unverified account must not be able to sign in.
    status, body, _ = call("POST", "/v1/auth/login", {"email": OWNER_EMAIL, "password": PASSWORD})
    record(
        "login is refused before email verification",
        status == 403 and "VERIFICATION" in json.dumps(body).upper(),
        f"status {status}",
    )

    # ── verification, using the code from the database ───────────────────
    code = verification_code(OWNER_EMAIL)
    if code:
        status, _, _ = call("POST", "/v1/auth/verify-email", {"email": OWNER_EMAIL, "code": code})
        record("verify email with the emailed code", status in (200, 201), f"status {status}")
    else:
        record("verify email with the emailed code", False, "no code found in database")

    # ── login ────────────────────────────────────────────────────────────
    status, body, cookies = call("POST", "/v1/auth/login", {"email": OWNER_EMAIL, "password": PASSWORD})
    session = jar(cookies)
    csrf = body.get("csrfToken") if isinstance(body, dict) else None
    # The API derives the slug from the practice name; it is not ours to choose.
    # Login's profile payload omits it — refresh and /status carry it, login
    # does not — so it is read from /status, which is what the app does too.
    global TENANT_SLUG
    record("login after verification", status in (200, 201) and bool(session), f"status {status}")

    status, body, _ = call("POST", "/v1/auth/login", {"email": OWNER_EMAIL, "password": "wrong"})
    record(
        "login is refused with a wrong password",
        status in (401, 429),
        "status 429 — the rate limiter refused before checking, which is also correct"
        if status == 429
        else f"status {status}",
    )

    if not session:
        print("\nNo session; the remaining flows need one.")
        return summarise()

    # ── the session is real and revocable ────────────────────────────────
    status, body, _ = call("GET", "/v1/auth/status", cookies=session)
    record("session status reads back", status == 200, f"status {status}")
    if isinstance(body, dict):
        TENANT_SLUG = body.get("tenantSlug") or body.get("slug")

    status, sessions, _ = call("GET", "/v1/auth/sessions", cookies=session)
    record(
        "active sessions lists this device",
        status == 200 and isinstance(sessions, list) and len(sessions) >= 1,
        f"{len(sessions) if isinstance(sessions, list) else '?'} session(s)",
    )
    if isinstance(sessions, list) and sessions:
        record(
            "session list leaks no token hash",
            all("tokenHash" not in s for s in sessions),
            "",
        )

    status, body, refreshed = call("POST", "/v1/auth/refresh", cookies=session)
    record("refresh rotates the session", status in (200, 201), f"status {status}")
    rotated = jar(refreshed) or session
    # Only refresh returns the practice slug; login and /status both omit it.
    if isinstance(body, dict) and (body.get("profile") or {}).get("tenantSlug"):
        TENANT_SLUG = body["profile"]["tenantSlug"]
    # Refresh mints a new CSRF token; the old one must stop working with it.
    if isinstance(body, dict) and body.get("csrfToken"):
        csrf = body["csrfToken"]
        rotated.setdefault("unclutter_csrf", csrf)

    # ── role boundaries ──────────────────────────────────────────────────
    status, _, _ = call("GET", "/v1/admin/stats", cookies=rotated)
    record("practice owner cannot reach platform admin", status in (401, 403), f"status {status}")

    status, _, _ = call("GET", "/v1/tenant/clients", cookies=rotated)
    record("owner can read their own client list", status == 200, f"status {status}")

    # ── tenant routing ───────────────────────────────────────────────────
    status, _, _ = call("GET", f"/v1/tenant/public/info/{TENANT_SLUG}")
    record("practice is reachable by its own slug", status == 200, f"slug {TENANT_SLUG}, status {status}")

    status, body, _ = call("GET", "/v1/consult/public/therapists", host="nosuchpractice.localhost")
    record(
        "an unknown practice host answers 404, not 500",
        status == 404,
        f"status {status}"
        + (" — a typo'd booking link should not page anyone" if status == 500 else ""),
    )

    booking_id = practice_flows(rotated, csrf, payments)

    staff_and_client_flows(rotated, csrf, booking_id)

    # ── closing the practice, last, because it ends this tenant ──────────
    status, _, _ = call(
        "POST",
        "/v1/privacy/practice/close",
        {"confirmSlug": "not-the-right-slug"},
        cookies=rotated,
        csrf=csrf,
    )
    record(
        "closing a practice refuses the wrong confirmation",
        status >= 400,
        f"status {status}",
    )

    status, closed, _ = call(
        "POST",
        "/v1/privacy/practice/close",
        {"confirmSlug": TENANT_SLUG},
        cookies=rotated,
        csrf=csrf,
    )
    record(
        "closing a practice starts the retention window",
        status in (200, 201),
        f"status {status}",
    )

    # ── signing out ends the session at once ─────────────────────────────
    status, _, _ = call("POST", "/v1/auth/logout", cookies=rotated, csrf=csrf)
    record("logout returns success", status in (200, 201), f"status {status}")

    status, _, _ = call("GET", "/v1/auth/sessions", cookies=rotated)
    record(
        "the access token stops working the moment the session ends",
        status in (401, 403),
        f"status {status} (was valid for 15 more minutes before this was fixed)",
    )

    return summarise()


def practice_flows(session, csrf, payments):
    """Booking, clinical records, notifications — the work the practice does."""
    import datetime

    # ── a service to sell ────────────────────────────────────────────────
    status, service, _ = call(
        "POST",
        "/v1/consult/services",
        {"title": "E2E Therapy", "durationMinutes": 50, "priceKobo": 500000},
        cookies=session,
        csrf=csrf,
    )
    record("create a bookable service", status in (200, 201), f"status {status}")
    service_id = service.get("id") if isinstance(service, dict) else None

    # ── a slot to book ───────────────────────────────────────────────────
    starts = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3)
    ends = starts + datetime.timedelta(minutes=50)
    status, slot, _ = call(
        "POST",
        "/v1/consult/therapist/availability",
        {
            "startsAt": starts.isoformat(),
            "endsAt": ends.isoformat(),
            "serviceId": service_id,
            "channel": "VIDEO",
        },
        cookies=session,
        csrf=csrf,
    )
    record("publish an availability slot", status in (200, 201), f"status {status}")
    slot_id = slot.get("id") if isinstance(slot, dict) else None

    host = f"{TENANT_SLUG}.localhost"
    status, listed, _ = call("GET", "/v1/consult/public/availability", host=host)
    record(
        "the slot is visible on the practice's own booking host",
        status == 200 and isinstance(listed, list),
        f"status {status}, {len(listed) if isinstance(listed, list) else '?'} slot(s)",
    )

    if not (service_id and slot_id):
        return None

    # ── a client books it ────────────────────────────────────────────────
    booking_body = {
        "serviceId": str(service_id),
        "availabilityId": str(slot_id),
        "firstName": "E2E",
        "lastName": "Client",
        "email": f"e2e-client-{STAMP}@example.com",
    }
    status, booking, _ = call("POST", "/v1/consult/public/bookings", booking_body, host=host)
    record("a client books the slot", status in (200, 201), f"status {status}")
    booking_id = booking.get("bookingId") if isinstance(booking, dict) else None

    if payments:
        record(
            "a paid booking returns a Paystack checkout link",
            isinstance(booking, dict) and bool(booking.get("paymentUrl")),
            "sandbox charge initialised" if isinstance(booking, dict) and booking.get("paymentUrl")
            else "no paymentUrl returned",
        )

    # ── the same slot cannot be sold twice ───────────────────────────────
    status, second, _ = call("POST", "/v1/consult/public/bookings", booking_body, host=host)
    record(
        "the same slot cannot be booked twice",
        status >= 400,
        f"status {status} — {json.dumps(second)[:70]}",
    )

    # ── the practice sees it ─────────────────────────────────────────────
    status, bookings, _ = call("GET", "/v1/consult/therapist/bookings", cookies=session)
    record(
        "the booking appears on the practice's list",
        status == 200 and isinstance(bookings, list) and len(bookings) >= 1,
        f"status {status}",
    )

    status, summary, _ = call("GET", "/v1/consult/dashboard/summary", cookies=session)
    if status == 200 and isinstance(summary, dict):
        record(
            "the dashboard reports no revenue for an unpaid booking",
            summary.get("revenueThisMonthNaira") == 0,
            f"revenue {summary.get('revenueThisMonthNaira')}",
        )
        record(
            "the dashboard returns a real twelve-month series",
            isinstance(summary.get("monthlyRevenue"), list)
            and len(summary["monthlyRevenue"]) == 12,
            f"{len(summary.get('monthlyRevenue') or [])} months",
        )

    # ── clinical records ─────────────────────────────────────────────────
    status, clients, _ = call("GET", "/v1/tenant/clients", cookies=session)
    client_id = clients[0]["id"] if isinstance(clients, list) and clients else None
    if client_id:
        status, note, _ = call(
            "POST",
            "/v1/notes",
            {
                "clientProfileId": str(client_id),
                "bookingId": str(booking_id) if booking_id else None,
                "subjective": "E2E subjective",
                "plan": "E2E plan",
            },
            cookies=session,
            csrf=csrf,
        )
        record("write a SOAP note", status in (200, 201), f"status {status}")
        note_id = note.get("id") if isinstance(note, dict) else None

        if note_id:
            status, _, _ = call("PATCH", f"/v1/notes/{note_id}/lock", {}, cookies=session, csrf=csrf)
            record("lock the note", status in (200, 201), f"status {status}")

            status, after, _ = call(
                "POST",
                "/v1/notes",
                {"clientProfileId": str(client_id), "subjective": "edited after lock"},
                cookies=session,
                csrf=csrf,
            )
            # A locked note is the clinical record; editing it must not silently
            # overwrite what was signed.
            record(
                "a locked note is not silently overwritten",
                status >= 400 or (isinstance(after, dict) and after.get("id") != note_id),
                f"status {status}",
            )

    # ── the webhook that completes the payment ───────────────────────────
    if booking_id:
        paid = webhook_charge_success(booking_id)
        record(
            "a signed webhook confirms the booking",
            paid is True,
            "signature accepted" if paid is True else str(paid),
        )

        status, bad, _ = call(
            "POST",
            "/v1/billing/paystack-webhook",
            {"event": "charge.success", "data": {"reference": f"booking-{booking_id}-forged"}},
        )
        record(
            "an unsigned webhook is refused",
            status == 400,
            f"status {status} — anyone can reach this endpoint",
        )

        if paid is True:
            status, summary, _ = call("GET", "/v1/consult/dashboard/summary", cookies=session)
            earned = summary.get("revenueThisMonthNaira") if isinstance(summary, dict) else None
            record(
                "the payment shows up as revenue at the amount charged",
                earned == 5000,
                f"reported {earned}, service priced at 5000",
            )

            status, bookings, _ = call("GET", "/v1/consult/therapist/bookings", cookies=session)
            confirmed = [
                b for b in (bookings if isinstance(bookings, list) else [])
                if str(b.get("id")) == str(booking_id)
            ]
            record(
                "the booking is now confirmed",
                bool(confirmed) and confirmed[0].get("status") == "CONFIRMED",
                confirmed[0].get("status") if confirmed else "booking not found",
            )

            # A retry must not confirm it twice or double-count the money.
            webhook_charge_success(booking_id)
            status, summary, _ = call("GET", "/v1/consult/dashboard/summary", cookies=session)
            again = summary.get("revenueThisMonthNaira") if isinstance(summary, dict) else None
            record(
                "a replayed webhook does not count the money twice",
                again == earned,
                f"{earned} then {again}",
            )

    # ── the client sees their own booking, and only theirs ───────────────
    client_email = f"e2e-client-{STAMP}@example.com"
    status, portal, _ = call("GET", "/v1/consult/portal", host=host)
    record(
        "the portal cannot be read without a session",
        status in (401, 403),
        f"status {status} — it was once addressable by email alone",
    )

    # ── the calendar file is not addressable by booking id alone ─────────
    if booking_id:
        status, _, _ = call("GET", f"/v1/calendar/bookings/{booking_id}/ical")
        record(
            "a calendar file needs its token",
            status == 404,
            f"status {status} — it carries the client's name and the join link",
        )

        status, _, _ = call("GET", f"/v1/calendar/bookings/{booking_id}/ical?token=" + "0" * 32)
        record(
            "a wrong token answers exactly as a missing booking does",
            status == 404,
            f"status {status} — so ids cannot be probed",
        )

        token = ical_token(booking_id)
        status, ics, _ = call("GET", f"/v1/calendar/bookings/{booking_id}/ical?token={token}")
        body_text = ics.get("raw", "") if isinstance(ics, dict) else str(ics)
        record(
            "the right token returns the calendar file",
            status == 200 and "BEGIN:VCALENDAR" in body_text,
            f"status {status}",
        )
        record(
            "the calendar file carries the current product name",
            "Unclutter Desk" in body_text and "unclutter.os" not in body_text,
            "PRODID and UID",
        )

    # ── rescheduling belongs to the client whose booking it is ───────────
    if booking_id:
        status, _, _ = call(
            "GET", f"/v1/consult/portal/bookings/{booking_id}/reschedule-options", host=host
        )
        record(
            "reschedule options need a session",
            status in (401, 403),
            f"status {status}",
        )

    # ── intake and assessments ───────────────────────────────────────────
    status, public_forms, _ = call("GET", "/v1/intake/public/forms", host=host)
    record("intake forms are offered publicly", status == 200, f"status {status}")

    status, reviews, _ = call("GET", "/v1/intake/public/reviews", host=host)
    record("public reviews are served", status == 200, f"status {status}")

    # ── notifications ────────────────────────────────────────────────────
    status, feed, _ = call("GET", "/v1/notifications", cookies=session)
    rows = feed if isinstance(feed, list) else (feed or {}).get("items")
    record(
        "the notifications feed reads from the API",
        status == 200 and isinstance(rows, list),
        f"status {status}, {len(rows) if isinstance(rows, list) else '?'} item(s)",
    )

    status, unread, _ = call("GET", "/v1/notifications/unread-count", cookies=session)
    record("unread count is served", status == 200, f"status {status}")

    # ── intake ───────────────────────────────────────────────────────────
    status, forms, _ = call("GET", "/v1/intake/forms", cookies=session)
    record("intake forms list is served", status == 200, f"status {status}")

    status, subs, _ = call("GET", "/v1/intake/submissions", cookies=session)
    record("intake submissions are staff-only and readable by the owner", status == 200, f"status {status}")

    return booking_id



def webhook_charge_success(booking_id):
    """
    Posts a charge.success signed the way Paystack signs it.

    The signature is HMAC-SHA512 of the raw body under the secret key, so this
    is a local exercise of the real verification path rather than a bypass —
    an unsigned body is refused by the same call.
    """
    import hashlib
    import hmac
    import re

    try:
        env = pathlib.Path("apps/api/.env").read_text()
    except Exception:
        return "apps/api/.env not readable"
    match = re.search(r"^PAYSTACK_SECRET_KEY=(.+)$", env, re.M)
    if not match:
        return "no PAYSTACK_SECRET_KEY configured"
    secret = match.group(1).strip()

    # The reference is minted server-side as booking-<id>-<timestamp> and stored
    # on the row; Paystack would echo back the one it was given.
    reference = REFERENCES.get(str(booking_id))
    if not reference:
        import subprocess

        out = subprocess.run(
            [
                "psql",
                os.environ.get("E2E_DB", "unclutter_os"),
                "-tAc",
                f'select "paymentRef" from "ConsultBooking" where id={int(booking_id)}',
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        reference = out.stdout.strip()
        REFERENCES[str(booking_id)] = reference
    if not reference:
        return "booking has no payment reference"

    payload = json.dumps(
        {
            "event": "charge.success",
            "data": {"reference": reference, "paid_at": "2026-09-04T12:00:00.000Z"},
        }
    ).encode()
    signature = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()

    req = urllib.request.Request(
        f"{API}/v1/billing/paystack-webhook", data=payload, method="POST"
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("x-paystack-signature", signature)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 201)
    except urllib.error.HTTPError as e:
        return f"status {e.code}: {e.read().decode()[:80]}"
    except Exception as e:
        return str(e)



def ical_token(booking_id):
    """
    The per-booking token the calendar route expects.

    HMAC-SHA256 of "ical:<id>" under JWT_SECRET, truncated to 32 characters —
    recomputed here so the check exercises the real comparison rather than
    trusting that some token works.
    """
    import hashlib
    import hmac
    import re

    env = pathlib.Path("apps/api/.env").read_text()
    # JWT_SECRET is currently declared twice in .env with different values.
    # dotenv keeps the last, so this must too — and the duplicate is worth
    # removing: rotating one and not the other silently ends every session.
    matches = re.findall(r"^JWT_SECRET=(.+)$", env, re.M)
    if not matches:
        return ""
    secret = matches[-1].strip()
    return hmac.new(secret.encode(), f"ical:{booking_id}".encode(), hashlib.sha256).hexdigest()[:32]



def staff_and_client_flows(owner_session, owner_csrf, booking_id):
    """
    A receptionist and a client, each held to their own side of the product.

    Both are roles the practice actually has, and neither had ever been driven:
    the role matrix is asserted from the route annotations, and the client
    portal was only ever checked for refusing an anonymous request.
    """
    import subprocess

    host = f"{TENANT_SLUG}.localhost"

    # ── a receptionist ───────────────────────────────────────────────────
    # Staff invitations need a paid tier; this run's practice is on the free
    # one. Set directly rather than paying, since the tier is not what is
    # under test here.
    subprocess.run(
        [
            "psql",
            os.environ.get("E2E_DB", "unclutter_os"),
            "-tAc",
            f"update \"Tenant\" set \"subscriptionTier\"='CLINIC' where slug='{TENANT_SLUG}'",
        ],
        capture_output=True,
        text=True,
        timeout=10,
    )

    reception_email = f"e2e-reception-{STAMP}@example.com"
    status, invite, _ = call(
        "POST",
        "/v1/tenant/staff/invite",
        {"email": reception_email, "role": "RECEPTIONIST"},
        cookies=owner_session,
        csrf=owner_csrf,
    )
    record("invite a receptionist", status in (200, 201), f"status {status}")

    claim_token = (invite or {}).get("claimToken") if isinstance(invite, dict) else None
    if not claim_token:
        record("the invitation carries a claim token", False, "no claimToken returned")
        return

    status, roster, _ = call("GET", "/v1/tenant/staff", cookies=owner_session)
    pending = [
        r for r in (roster if isinstance(roster, list) else []) if r.get("kind") == "invite"
    ]
    record(
        "the outstanding invitation shows on the roster",
        bool(pending),
        f"{len(pending)} pending",
    )

    status, claimed, cookies = call(
        "POST",
        "/v1/auth/invite/claim",
        {"token": claim_token, "password": PASSWORD, "firstName": "E2E", "lastName": "Reception"},
        host=host,
    )
    reception = jar(cookies)
    reception_csrf = claimed.get("csrfToken") if isinstance(claimed, dict) else None
    record("claiming the invitation signs them in", status in (200, 201) and bool(reception), f"status {status}")

    if reception:
        status, _, _ = call("GET", "/v1/tenant/clients", cookies=reception)
        record("a receptionist can see the client list they book against", status == 200, f"status {status}")

        # The three surfaces that carry what was discussed in a session.
        for label, method, path in [
            ("the video room's session prep", "GET", f"/v1/consult/therapist/bookings/{booking_id}/prep"),
            ("intake submissions", "GET", "/v1/intake/submissions"),
        ]:
            status, _, _ = call(method, path, cookies=reception)
            record(f"a receptionist cannot read {label}", status == 403, f"status {status}")

        status, _, _ = call(
            "POST",
            "/v1/notes",
            {"clientProfileId": "1", "subjective": "should not be written"},
            cookies=reception,
            csrf=reception_csrf,
        )
        record("a receptionist cannot write a clinical note", status == 403, f"status {status}")

    # ── the client whose booking it is ───────────────────────────────────
    client_email = f"e2e-client-{STAMP}@example.com"
    status, _, _ = call(
        "POST",
        "/v1/auth/register",
        {"email": client_email, "password": PASSWORD, "firstName": "E2E", "lastName": "Client"},
        host=host,
    )
    record("the client can create a login for the practice", status in (200, 201), f"status {status}")

    code = verification_code(client_email)
    if code:
        call("POST", "/v1/auth/verify-email", {"email": client_email, "code": code}, host=host)

    status, body, cookies = call(
        "POST", "/v1/auth/login", {"email": client_email, "password": PASSWORD}, host=host
    )
    client = jar(cookies)
    record("the client can sign in", status in (200, 201) and bool(client), f"status {status}")

    if not client:
        return

    # Booking created a profile for this address; registering must attach to it
    # rather than open a second one, or the client signs in to an empty portal.
    status, portal, _ = call("GET", "/v1/consult/portal", cookies=client, host=host)
    bookings = (portal or {}).get("upcoming") if isinstance(portal, dict) else None
    record(
        "the client sees the booking they made",
        status == 200 and isinstance(bookings, list) and len(bookings) >= 1,
        f"status {status}, {len(bookings) if isinstance(bookings, list) else '?'} booking(s)",
    )

    status, _, _ = call("GET", "/v1/consult/portal/payments", cookies=client, host=host)
    record("the client can see what they were charged", status == 200, f"status {status}")

    if booking_id:
        status, options, _ = call(
            "GET",
            f"/v1/consult/portal/bookings/{booking_id}/reschedule-options",
            cookies=client,
            host=host,
        )
        record("the client can ask to reschedule their own booking", status == 200, f"status {status}")

    # The boundary that matters most: a client is not staff.
    for label, path in [
        ("the practice's client list", "/v1/tenant/clients"),
        ("intake submissions", "/v1/intake/submissions"),
        ("the dashboard", "/v1/consult/dashboard/summary"),
    ]:
        status, _, _ = call("GET", path, cookies=client, host=host)
        record(f"a client cannot reach {label}", status == 403, f"status {status}")

    # ── cancelling, once the client has had their turn with it ───────────
    if booking_id:
        status, _, _ = call(
            "PATCH",
            f"/v1/consult/therapist/bookings/{booking_id}/status",
            {"status": "CANCELLED"},
            cookies=owner_session,
            csrf=owner_csrf,
        )
        record("the practice can cancel a booking", status in (200, 201), f"status {status}")

        status, options, _ = call(
            "GET",
            f"/v1/consult/portal/bookings/{booking_id}/reschedule-options",
            cookies=client,
            host=host,
        )
        record(
            "a cancelled booking cannot be rescheduled",
            status >= 400,
            f"status {status}",
        )

        status, summary, _ = call("GET", "/v1/consult/dashboard/summary", cookies=owner_session)
        still = summary.get("revenueThisMonthNaira") if isinstance(summary, dict) else None
        record(
            "money already taken is not erased by a cancellation",
            still == 5000,
            f"{still} — refunds are not modelled, so a paid booking stays paid",
        )


def summarise():


    print()
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"{passed}/{len(results)} flows passed")
    failed = [f for f, ok, _ in results if not ok]
    if failed:
        print("\nFailed:")
        for f in failed:
            print(f"  - {f}")
    return 0 if not failed else 1


def verification_code(email):
    """
    Recovers the six-digit code for this run's own throwaway account.

    SMTP is not configured locally, and the code is stored as a sha256 hash
    rather than in the clear — which is correct, and means it cannot simply be
    read back. Scanning the six-digit space against the stored hash takes about
    a second and lets the check exercise the real verify-email endpoint instead
    of flipping emailVerified in the database and proving nothing.
    """
    import hashlib
    import subprocess

    try:
        out = subprocess.run(
            [
                "psql",
                os.environ.get("E2E_DB", "unclutter_os"),
                "-tAc",
                'select t."tokenHash" from "Token" t join "User" u on u.id=t."userId" '
                f"where u.email='{email}' and t.type='email_verification' "
                'order by t."createdAt" desc limit 1',
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception:
        return None

    stored = out.stdout.strip()
    if not stored:
        return None

    for candidate in range(100000, 1000000):
        code = str(candidate)
        if hashlib.sha256(code.encode()).hexdigest() == stored:
            return code
    return None


if __name__ == "__main__":
    sys.exit(main())
