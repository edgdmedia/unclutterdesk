# Client portal and session page polish (owner feedback, 10 Nov 2026): plan for opencode

**Builder:** opencode. Branch `phase1/client-polish` from `dev`, PR into `dev`.

**Before asking for review**, follow `AGENTS.md`: run the full suites and `pnpm typecheck`, and post the totals. One commit per task, each with tests. Tests fake only the network (`utils/apiClient`); never stub our own components.

## Tasks

- [ ] **1. Assessments explain themselves to the client.**
  - Each instrument already has `measures`, `instructions` and `estimatedMinutes` (`apps/api/src/modules/assessments/builtin-instruments.ts`, sent by `publicDefinition` in `engine.ts`). Add a client-facing `description` to the definition: two or three plain sentences on what it is about and why the practitioner may ask for it, written for the client (no clinical labels, no scores). Write one for each built-in: PHQ-9, GAD-7, PCL-5, DASS-21, BPAQ, DAR-5, RSES.
  - Make `description` optional in `validateDefinition` (older stored instruments have none) and send it in `publicDefinition`. Built-ins are only copied into the database when missing (`instrument.service.ts`), so add a small step that fills in `description` on stored built-ins that lack one, without touching anything else an admin may have edited. Test it.
  - Before the first question, show a short intro: the name, the description, "About N minutes", "There are no right or wrong answers", "Your answers go only to your practitioner", then the instrument's own instructions above the questions. Both places a client takes one use `components/assessments/AssessmentQuestionnaire.tsx` (the token link `/assessment/:token` and the portal `/portal/assessments/:id`); do it there once.

- [ ] **2. Not every questionnaire is "a few questions before we talk".**
  - That heading (`AssessmentQuestionnaire.tsx`, line ~45) fits intake only. For an assessment, the heading is the instrument's name (with the greeting, e.g. "Hi Ada, here is the Rosenberg Self-Esteem Scale"). Keep "a few questions before we talk" only where the questionnaire is the intake. Test both.

- [ ] **3. After signing in, go back to where the client was heading.**
  - The recap email's button opens e.g. `https://consult.unclutter.com.ng/portal/sessions/10/recap`. A client who is not signed in signs in and lands on `/portal`, not the recap. The same applies to `/portal/assessments/:id`, `/forms/:id` and any portal link.
  - Carry the requested path through sign-in (and through account creation and setting a password) and return to it afterwards. Places that send to `/portal` today: `pages/public/ClientLoginPage.tsx` (`onDone`), `pages/auth/LoginPage.tsx` (~line 72), `pages/public/SetPasswordPage.tsx`, and wherever `PortalSignIn` / `ClientShell` send a signed-out client to sign in.
  - Only same-site paths that start with a single `/` are allowed as the return (never `//…`, never a full URL), so the sign-in page cannot be used to redirect anywhere else. One shared helper, tested with good and bad values.
  - Test: open `/portal/sessions/10/recap` signed out, sign in, land on that recap.

- [ ] **4. A better signed-out portal page.**
  - `pages/client/portal/PortalSignIn.tsx` ("Sign in to see your sessions…") is a bare card. Redesign it as a proper welcome for the practice's client: the practice's name and logo (brand is available from `ClientBrandProvider` / `useBrand`), a short line on what the portal holds (sessions and join links, forms, recaps, payments), the Sign in button, and a quieter "First time? Create your account" for clients who booked but never set a password. Keep the privacy line. It must look right at 375px and on desktop; use `packages/ui` primitives, no new one-off styles.
  - Task 3's return path applies here too.

- [ ] **5. Session page: Overview, then tabs.**
  - On the practitioner's session page (`pages/practice/SessionDetailPage.tsx`), keep the session overview (who, when, status, payment, actions) at the top. Below it, put **SOAP notes** and **Summary** (internal summary, supervision notes, client recap and its attached questionnaires) in tabs, so a therapist reaches them without scrolling. Use the existing tab component, and keep the tab in the URL (`?tab=notes` / `?tab=summary`) so a reload or a shared link keeps it.
  - `#note` links (from the client page and the room) must still open the SOAP tab.
  - Only staff who may write notes see these tabs (today: `can.summary`); the desk sees the overview only. Keep that, and keep every existing test passing (`SessionDetailPage.test.tsx`, `SessionDetailMove.test.tsx`).

## Out of scope (Claude has these)

- The Unclutter Journal integration (`docs/design/journal-integration.md`). It will add a "Journal plan" to the Summary tab and a button to the portal recap page later; leave room, don't build it.
- The recap page's content and the rich-text editor (`components/richText`): use them as they are.
