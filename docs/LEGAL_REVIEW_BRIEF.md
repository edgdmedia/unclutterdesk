# Legal review brief — Unclutter Desk

**Prepared:** 15 September 2026
**For:** Nigerian counsel, data protection and technology contracts
**From:** EDGD Media Digital Solutions Ltd (RC 1721185), 19 Yesufu Sanusi, off Adeniran Ogunsanya, Lagos
**Contact:** privacy@unclutterdesk.com

---

## 1. What we are asking for

A review of two documents — our privacy policy and terms of service — before we
open a private pilot with one or two therapy practices. Nothing is published
yet and no real client data exists in the system, so this is the cheapest
moment to change anything.

We are not asking for a redraft from scratch. The documents are written and
specific. We are asking you to (a) tell us where they are wrong or
unenforceable under Nigerian law, and (b) answer the ten questions in section 4,
which we could not answer ourselves without guessing.

**Turnaround we are hoping for:** two weeks. The pilot is blocked on this.

**Format that helps us most:** answers as text we can paste into the documents,
rather than tracked changes in a separate file. The documents are HTML source
in a code repository.

---

## 2. The documents

| Document | Where it lives | Length |
| --- | --- | --- |
| Privacy policy | `apps/landing/src/pages/privacy.astro`, renders at `/privacy` | 11 sections |
| Terms of service | `apps/landing/src/pages/terms.astro`, renders at `/terms` | 16 sections |

Both will be sent as rendered PDFs alongside this brief.

One placeholder remains in the privacy policy, in section 7, marked in the
text. It is question 1 below.

---

## 3. What the business actually does

**The product.** Practice-management and booking software for therapists and
clinics in Nigeria. A practice signs up, publishes a booking page on its own
subdomain or custom domain, takes bookings, runs sessions over a video link,
and keeps clinical notes and assessments (including PHQ-9 and GAD-7) in the
system. Clients of the practice can create an account, book, pay, and see their
own upcoming sessions through a portal.

**Our position.** We are a technology provider. The practice is the controller
of its clients' clinical records; we hold them on the practice's behalf. The
terms say this in sections 2, 4 and 5, and the privacy policy says it in
sections 1 and 9. Whether that position holds under Nigerian law is question 6.

**Money.** A practice pays us a subscription. Separately, a client pays the
practice for a session through our checkout: the money goes through Paystack,
which splits it and pays the practice out to its own bank account. We are
never the merchant of record for the therapy session itself — Paystack settles
to the practice. Our Paystack account is held in the name "UnclutterDesk"; the
verified business behind it is EDGD Media Digital Solutions Ltd.

**Where the data is.** The application server and PostgreSQL database run on
Contabo infrastructure in **Germany**. The website and application front end
are served through Cloudflare. This means personal data, including clinical
records of Nigerian data subjects, leaves Nigeria. This is question 1 and it is
the most important one.

**Sub-processors**, as listed in privacy policy section 5:

| Provider | Function |
| --- | --- |
| Paystack | Client payments, practice subscriptions, bank payouts |
| Cloudflare | Website and application hosting, CDN, DDoS protection |
| Contabo (Germany) | Application server and database hosting |
| Google (Calendar & Meet) | Calendar sync and meeting links, only where a therapist connects their account |
| Google (Gmail SMTP) | Transactional email |
| Jitsi Meet (8x8) | Default video sessions |
| Daily.co | Optional branded video rooms |
| Termii | SMS notifications, where enabled |

**Security measures we can evidence**, should you want to cite them:

- The four narrative fields of a clinical note are encrypted by the application
  with AES-256-GCM before they reach the database, so they are unreadable to
  anyone holding the disk, a backup file or a database connection.
- Backups are encrypted with AES-256 before leaving the server, kept 14 days on
  the server and 90 days off-site.
- The database volume itself is **not** encrypted at rest. The privacy policy
  says so rather than implying otherwise.
- Access is role-based, with integration tests proving each role's reach, and
  cross-tenant access is tested against.

**Lawful bases we have asserted** (privacy policy section 3): performance of a
contract for providing the service and taking payments; legitimate interests
for security and support; legal obligation for financial records. Question 5
asks whether these are right for health data under the NDPA.

---

## 4. The ten questions

### 1. The transfer to Germany

Our servers are in Germany. Clinical records of Nigerian data subjects are
stored there.

- Under the NDPA, on what basis may we make this transfer? Is Germany covered
  by an adequacy determination we can rely on and cite, or do we need standard
  contractual clauses with Contabo, or consent, or something else?
- What exactly should section 7 of the privacy policy say? This is the
  remaining placeholder.
- Does anything need to be in place with Contabo specifically, beyond their
  standard terms?

### 2. Registration with the NDPC

Is EDGD Media Digital Solutions Ltd a data controller or processor of major
importance requiring registration with the Nigeria Data Protection Commission,
given the volume and the fact that the data is health data? If so, what is the
filing and what does it cost us in time?

### 3. A data processing agreement

The practice is the controller of its clients' records and we process on its
behalf. The NDPA requires a written arrangement between them.

- Does our terms of service satisfy that requirement as drafted, or do we need
  a separate data processing addendum?
- If an addendum is needed, must each practice sign it separately, or can it be
  incorporated by reference into the terms they accept at signup? We would
  much prefer the latter, but not at the cost of validity.

### 4. An assignment clause

EDGD Media Digital Solutions Ltd holds this product on an interim basis. We
expect to register a dedicated entity, "Unclutter", and move the product to it.

Please add a clause permitting assignment to an affiliate or successor, so the
transfer does not require re-papering every practice individually. We would
rather have this in the first version every practice accepts than discover we
need it after fifty of them have signed.

### 5. Lawful bases for health data

Clinical notes and assessment scores are sensitive personal data. Are the bases
we assert in section 3 the right ones under the NDPA for that category, or does
health data require an additional condition we have not named? Note that we
rely on contract rather than consent for the core service.

### 6. The "technology provider only" position

We hold clinical records and carry telehealth sessions, but we take no clinical
responsibility. Terms section 2 puts professional responsibility, licensing and
clinical judgement entirely on the practice.

- Does this position survive contact with Nigerian law?
- Is there any healthcare or telemedicine regulatory exposure for us as the
  platform — MDCN telemedicine guidance, or anything comparable for
  psychologists and therapists — that we should be responding to in these
  documents?

### 7. What a therapy client accepts

Our terms bind "the practice or clinic that opens an account". But a client of
that practice also creates an account with us, pays through our checkout, and
holds a login to a portal.

- Does the client need to accept anything from us directly, and if so, what?
- If a separate short client-facing agreement is required, we would like it
  drafted. It is not written.

### 8. Collecting and paying out client money

We collect a client's payment for a therapy session and Paystack splits it out
to the practice. Does that make us a payment intermediary in any sense that
attracts CBN licensing or registration, or does operating entirely through
Paystack's split-payment and subaccount model keep that obligation with
Paystack? We want to be sure the answer is not "it depends on volume" without
knowing where the threshold is.

### 9. Liability cap and indemnity

Terms section 14 caps our total liability at the fees paid to us in the
preceding 12 months, and section 14 requires the practice to indemnify us for
claims arising from its clinical services or its breach of data protection law.

- Is a cap set at fees paid enforceable in Nigeria where the claim concerns a
  breach of clinical records? For a pilot practice paying a small monthly
  subscription, the cap is close to nothing relative to a plausible claim.
- Is the indemnity enforceable against a practitioner, and are the carve-outs
  in the final paragraph of section 14 the right ones?

### 10. Refunds and the FCCPA

Terms section 6 now says fees already paid are not refundable, including for
part-periods, and that the practice keeps access to the end of the paid period.
Does that survive the Federal Competition and Consumer Protection Act, given
some of our customers will be sole practitioners who may count as consumers?

---

## 5. Two things we would like challenged

Not questions, but places we suspect we have talked ourselves into something:

- **Retention on account closure.** We delete a practice's data when its
  account closes. Nigerian medical-record retention duties may require the
  practitioner to keep clinical records for years. Our deletion language should
  not be pushing a practice into breach of its own professional obligations.
  Section 7 of the privacy policy and section 13 of the terms are the relevant
  clauses.

- **Client data-subject requests.** Privacy policy section 9 tells a therapy
  client to contact their practice, and commits us to pass on any request that
  reaches us directly. We think that is the correct split given the practice is
  the controller. Tell us if it is not.

---

## 6. What we are not asking

We are not asking for advice on incorporating the Unclutter entity, on
trademarks, or on employment. Those are separate and later.
