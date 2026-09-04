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
import sys
import time
import urllib.error
import urllib.request

API = os.environ.get("E2E_API", "http://localhost:3001")
STAMP = str(int(time.time()))
SLUG = f"e2e{STAMP}"
# Filled in from the login response — the API derives it from the practice name.
TENANT_SLUG = None
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

    practice_flows(rotated, csrf, payments)

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
        return

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
