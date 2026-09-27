# Email sending

How Desk sends email, and how a practice sends from its own domain.

## The layers

| Layer | Who | Sender (the From address) | Setup |
|---|---|---|---|
| 1. Platform | Every practice, and all mail with no practice (sign-up, platform notices) | `"Practice Name" <MAIL_FROM address>`, with Reply-To set to the practice's contact email | None |
| 2. Own domain | Any practice that verifies a domain in **Brand → Sending email** | `"Practice Name" <{name}@{their domain}>` | The practice adds 3 DNS records, then presses **Check again** |
| 3. Bring your own SMTP | Planned | The practice's own mailbox | Not built yet |

A practice's own domain is used only while Resend reports it **VERIFIED**. In any other state, including `TEMPORARY_FAILURE` after records are removed, mail goes out from the platform address, so email never stops. Practice owners and admins get a notification when their domain becomes verified or stops being verified.

## Configuration (API `.env`)

```bash
# Resend: turns on layers 1 and 2.
RESEND_API_KEY=re_...
# Webhook signing secret from Resend (Webhooks → the endpoint → Signing secret).
RESEND_WEBHOOK_SECRET=whsec_...
# The platform's sender address. It must be on a domain verified in Resend.
MAIL_FROM="Unclutter Desk <notifications@mail.unclutterdesk.com>"

# Optional: the SMTP settings below are used only when RESEND_API_KEY is unset.
# SMTP_HOST=smtp.gmail.com
# SMTP_USER=...
# SMTP_PASS=...
```

**Which transport is used:**

1. Resend, when `RESEND_API_KEY` is set.
2. Otherwise SMTP, when `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are all set.
3. Otherwise preview: mail is logged, not sent.

SMTP never uses a practice's domain, because SMTP cannot sign for it. `EMAIL_LOG_ONLY=true` still suppresses all sending.

## One-time platform setup

1. **Create the Resend account.** Pick a plan whose domain allowance covers the number of practices you expect to verify their own domain.
2. **Add and verify the platform domain in Resend.** Use `mail.unclutterdesk.com`, a subdomain, so its reputation stays separate from any mail sent from the root domain. Resend lists three records; in the `unclutterdesk.com` Cloudflare zone they are:

   | Type | Name | Value |
   |---|---|---|
   | TXT | `resend._domainkey.mail` | the DKIM key Resend shows |
   | MX | `send.mail` | `feedback-smtp.<region>.amazonses.com`, priority 10 |
   | TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` |

   These should be **DNS-only** (grey cloud).
3. **Add DMARC for `unclutterdesk.com`.** The domain has none today. Start in monitoring mode, then tighten once reports look clean:

   ```
   TXT  _dmarc  "v=DMARC1; p=none; rua=mailto:dmarc@unclutterdesk.com"
   ```
4. **Add a webhook in Resend.**
   - URL: `https://api.unclutterdesk.com/v1/webhooks/resend`
   - Events: `domain.created`, `domain.updated`, `domain.deleted`
   - Copy its signing secret into `RESEND_WEBHOOK_SECRET`.
5. **Set the three variables above and restart the API.** The log should say `Email via Resend, default sender …`.

Keep the SMTP settings until Resend is confirmed in production. Removing `RESEND_API_KEY` switches straight back to them.

## A practice's own domain

The practice enters a domain in **Brand → Sending email**, plus the name before the @ (default `notifications`).

- **What Desk does:** it registers the domain with Resend and shows the records to add. They look like the platform ones above, with names relative to the domain they entered.
- **Recommend a subdomain,** e.g. `mail.drjane.com`. A root domain works too.
- **Existing email is not affected.** Resend's SPF record lives on the `send.` subdomain (the return path), not the root domain. A practice's existing SPF and DMARC records for Google Workspace or Microsoft 365 need no changes. DKIM signing on its own domain is what lets the mail pass that DMARC.

**Status meanings:**

| Status | Meaning | Mail sends from |
|---|---|---|
| `NOT_STARTED`, `PENDING` | Records not added yet, or still propagating | Platform address |
| `PARTIALLY_VERIFIED`, `PARTIALLY_FAILED` | Some records found | Platform address |
| `VERIFIED` | All records found | **The practice's domain** |
| `FAILED` | Records not found within 72 hours | Platform address |
| `TEMPORARY_FAILURE` | Was verified, but a record has since gone | Platform address; the practice is notified |

## The founder's practice (`unclutter.com.ng`)

The zone is on Cloudflare. It already has Google Workspace MX, SPF (`include:_spf.google.com -all`) and DMARC (`p=quarantine`). Nothing there needs to change.

1. In **Brand → Sending email**, enter `mail.unclutter.com.ng`, or `unclutter.com.ng` to send as `…@unclutter.com.ng`.
2. Add the three records Resend shows to the `unclutter.com.ng` zone, as DNS-only.
3. Press **Check again**.

With DKIM aligned to `unclutter.com.ng`, the mail passes the existing `p=quarantine` DMARC.

## API

Practice admin (OWNER, ADMIN):

| Method | Path | Does |
|---|---|---|
| `GET` | `/v1/tenant/sending-domain` | Current domain, records, status, and the address mail goes out from now |
| `POST` | `/v1/tenant/sending-domain` | `{ domain, fromLocalPart? }` starts using a domain |
| `POST` | `/v1/tenant/sending-domain/verify` | Asks Resend to re-check, then returns the current state |
| `PATCH` | `/v1/tenant/sending-domain` | `{ fromLocalPart }` changes the name before the @ |
| `DELETE` | `/v1/tenant/sending-domain` | Stops using the domain |

Public:

| Method | Path | Does |
|---|---|---|
| `POST` | `/v1/webhooks/resend` | Resend domain events, accepted only with a valid Svix signature less than 5 minutes old |

## Local development

Without `RESEND_API_KEY`, mail is logged. The card in Brand settings then says own domains are not available yet.

To exercise the full flow locally, point `RESEND_API_URL` at a stand-in server that speaks Resend's `/emails` and `/domains` endpoints.
