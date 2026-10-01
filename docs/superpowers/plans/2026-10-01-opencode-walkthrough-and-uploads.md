# Walkthrough and Image Uploads: Implementation Plan (for opencode)

**Goal:** Close two items from `docs/testing-feedback.md`:
- **SET-08:** photo and logo uploads show no progress or result. The dashboard's profile photo isn't even saved.
- **ONB-06:** a first-time walkthrough of the dashboard.

**Who runs this:** opencode, in its **own git worktree and branch**. Another agent is working on `dev` at the same time, on booking emails and notifications (API `consult`, `billing`, `notifications`, `intake`, and the booking wizard under `apps/app/src/pages/public/booking/`). **Do not edit those areas.** This plan was split so the two never touch the same files.

**Spec:** the SET-08 and ONB-06 entries in `docs/testing-feedback.md` (read them first), plus the decisions recorded there.

## 0. Set-up (do this first)

```bash
cd /Users/olalekan/Projects/Unclutter/unclutterdesk
git fetch --all
git worktree add ../unclutterdesk-opencode -b opencode/walkthrough-uploads dev
cd ../unclutterdesk-opencode
pnpm install
```

Work and commit only in `../unclutterdesk-opencode`. When everything is green, open a PR into `dev`. **Never push to `main`**: a push to `main` deploys to production.

## Project rules (read before coding)

- **Monorepo:**
  - `apps/api`: NestJS + Prisma (PostgreSQL), tested with vitest using test stand-ins for Prisma (see any `*.spec.ts`).
  - `apps/app`: React + Vite + Tailwind.
  - `packages/ui`: the shared design system (`Button`, `Card`, `Eyebrow`, `Input`, `SegmentedControl`, …).
- **Test-first, always.** Write the test, run it and watch it fail, implement, run it and watch it pass, then commit. One commit per task.
- **App tests** render through `renderWithApp` from `apps/app/src/test/renderWithApp.tsx` (the real router, brand and toast providers). Fake **only** `../../utils/apiClient` (and `context/AuthContext` where a page needs a signed-in user, as existing tests do). Never stub `@unclutterdesk/ui` or other code of ours.
- **Prefer shared components over one-off copies.** Copy should be plain and short.
- **Run tests:**
  - App: `cd apps/app && npx vitest run --maxWorkers=2 --minWorkers=1` (the full parallel run runs out of memory on this machine).
  - API: `cd apps/api && npx vitest run --maxWorkers=2 --minWorkers=1`.
  - UI: `cd packages/ui && npx vitest run`.
  - Type checks: `npx tsc --noEmit -p .` in each package.
- **API build:** `NODE_OPTIONS=--max-old-space-size=8192 npx nest build`.
- **Schema changes:** a hand-written migration in `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma migrate deploy` and `npx prisma generate`. **Don't run `prisma format`**: it realigns unrelated models.
- **Local servers** (only if you need a browser check; the other agent may be using ports 3099 and 5173, so use 3299 and 5273):
  - API: `cd apps/api && SMTP_HOST= SMTP_USER= SMTP_PASS= PORT=3299 node dist/src/main.js` (the SMTP variables stay blank so email is only logged).
  - App: `cd apps/app && API_PROXY_TARGET=http://localhost:3299 npx vite --port 5273`. Don't set `VITE_API_URL`; the dev server proxies `/v1`.
  - Practice login: `dr.jane@smiththerapy.ng` / `password123`.
- **Commit messages:** a plain sentence describing the outcome. End with a blank line, then `Co-Authored-By: <your model> <noreply@…>`.
- **Request size:** the API's JSON body limit is **100 KB**. Images must be shrunk in the browser before upload; that's how `LogoField` does it.

---

## Task 1: A shared image field with visible states (SET-08)

**Today:**
- `apps/app/src/components/settings/LogoField.tsx` picks an image and shrinks it in the browser (canvas, with a PNG, WebP, then JPEG fallback, to fit 90,000 characters). It's used by the setup wizard (`pages/practice/OnboardingWizardPage.tsx`) and Brand settings (`pages/practice/settings/BrandSettingsPage.tsx`).
- It shows "Preparing…" while shrinking, but nothing while saving, and nothing once saved, because saving happens elsewhere when the page's Save button is pressed.

**Build:** generalise it into `apps/app/src/components/settings/ImageField.tsx`. `LogoField` becomes a thin wrapper, so its current users keep working.

```ts
export type ImageFieldProps = {
  value: string;                        // data URL or https URL, '' for none
  onChange: (dataUrl: string) => void;  // called with the shrunk image, or '' on remove
  label: string;                        // accessible names: "Upload {label}", "Remove {label}", alt "{label}"
  shape?: 'square' | 'circle';          // circle for profile photos
  /** When given, the field saves on its own and shows the save states. */
  onSave?: (dataUrl: string) => Promise<void>;
};
```

**States to show** (`role="status"` text under the control):
- *Preparing…* while shrinking;
- *Saving…* during `onSave`;
- *Saved* for 2 seconds after success;
- the error message (`role="alert"`) if shrinking or saving fails, with the previous image restored.

The control is disabled while preparing or saving. Without `onSave`, it behaves exactly like today's `LogoField` (the page's own Save button does the saving).

**Tests (`apps/app/src/components/__tests__/ImageField.test.tsx`, test-first):**
1. With `onSave` resolving: pick a small PNG, and "Saving…" then "Saved" appear. `onSave` is called with a `data:image/` URL.
2. With `onSave` rejecting `new Error('Too large')`: the alert shows "Too large", and the previous value is still shown.
3. A non-image file shows "Choose an image file" and calls nothing.
4. Remove calls `onChange('')`, and calls `onSave('')` when given.
5. `shape="circle"` renders the preview with a full radius (assert the class).

Keep `LogoField.test.tsx` passing unchanged; its labels must still be "Upload logo", "Remove logo" and alt "Practice logo".

**Commit:** "One image field for logos and photos, showing preparing, saving, saved and errors".

---

## Task 2: The profile photo is actually saved (SET-08)

**Today:** on the dashboard (`apps/app/src/pages/practice/DashboardPage.tsx`, around line 465), **Upload Photo** reads the file with `FileReader` and calls `setProfileAvatar(...)`. Nothing is sent to the API, so the photo is gone on reload. An endpoint already exists: `POST /v1/consult/therapist/profile/avatar` with body `{ avatarUrl }`. It's handled by `ConsultService.uploadTherapistAvatar` in `apps/api/src/modules/consult/consult.service.ts`. Its summary says "Max 2MB", but the body limit is 100 KB and it validates nothing.

**API (test-first, `apps/api/src/modules/consult/therapist-avatar.spec.ts`):**
- Accepts a `data:image/(png|jpeg|webp|gif);base64,…` up to 100,000 characters, or an `https://` URL. `''` or `null` clears the photo.
- Rejects anything else with a `BadRequestException`: "The photo must be an image.", and for oversized input "That photo is too large…".
- Reuse the validator `cleanLogoUrl` exported from `apps/api/src/modules/tenant/tenant.service.ts`. Rename it to `cleanImageUrl(value, what: 'logo' | 'photo')` and keep a `cleanLogoUrl` alias, so `apps/api/src/modules/tenant/brand-logo.spec.ts` keeps passing.
- This is the **only** change in `consult.service.ts`: the body of `uploadTherapistAvatar`. Don't touch anything else in that file; the other agent is working in it.

**App (test-first, `apps/app/src/pages/__tests__/DashboardProfilePhoto.test.tsx`):**
- Replace the dashboard's hand-made upload block with `<ImageField label="profile photo" shape="circle" value={profileAvatar ?? ''} onChange={setProfileAvatar} onSave={savePhoto} />`, where `savePhoto` posts `{ avatarUrl }` to `/v1/consult/therapist/profile/avatar`, then calls `refreshProfile()` from `useAuth()` so the account menu avatar updates.
- Test: choosing a photo posts to that endpoint and shows "Saved"; a rejected save shows the server's message.
- Remove the misleading "JPG or PNG · max 2 MB" note. Images are shrunk automatically now, so say "PNG, JPG or WebP".

**Commit:** "The profile photo is saved, and shows that it was".

---

## Task 3: Remember when a person has finished the walkthrough (ONB-06, API)

**Decision (product owner):** setup already works as the checklist. What's missing is a guided **walkthrough** of the dashboard: shown once per person, on any device, and replayable from the account menu.

**Schema:** add `tourCompletedAt DateTime?` to `model Profile` in `prisma/schema.prisma`. Migration `prisma/migrations/20261002090000_profile_tour/migration.sql`:

```sql
ALTER TABLE "Profile" ADD COLUMN "tourCompletedAt" TIMESTAMP(3);
```

**API (test-first):**
- The signed-in profile returned by `GET /v1/auth/status` and by login includes `tourCompletedAt: string | null`. It's built in `apps/api/src/modules/auth/auth.service.ts`, in the function that returns `tenantSlug`, `plan` and `permissions`, around line 1100.
- New `POST /v1/auth/me/tour-complete` in `apps/api/src/modules/auth/auth.controller.ts`, using the same guard and decorator pattern as the other signed-in auth routes. It sets `tourCompletedAt = now()` for **the caller's own profile only** and returns `{ tourCompletedAt }`.
- Spec `apps/api/src/modules/auth/tour.spec.ts`: it sets the date for the caller's profile id (assert the Prisma `update` `where`), and a second call keeps the first date (it only updates where `tourCompletedAt` is null; use `updateMany` with `{ id, tourCompletedAt: null }`).
- If `apps/api/src/client-surface.spec.ts` (the reviewed list of client-reachable routes) fails because of the new route, the route is for staff and clients alike. Add it to the list with a one-line comment, as the existing entries do.

**Commit:** "The app remembers when someone has taken the dashboard walkthrough".

---

## Task 4: A shared Tour component (ONB-06, design system)

**File:** `packages/ui/src/components/Tour.tsx`, exported from `packages/ui/src/index.ts`. Tests in `packages/ui/src/components/__tests__/Tour.test.tsx`, using the UI package's own vitest set-up (`packages/ui/src/test/setup.ts`).

```ts
export type TourStep = { anchor: string; title: string; body: string }; // anchor = value of a data-tour attribute
export function Tour(props: { steps: TourStep[]; open: boolean; onDone: (how: 'finished' | 'skipped') => void }): JSX.Element | null;
```

**Behaviour:**
- **Finding the anchor:** finds `[data-tour="<anchor>"]` in the document. Steps whose anchor isn't on screen are skipped (for example, a sidebar item hidden on phones).
- **Highlight:** dims the page with an overlay and cuts out a highlight around the anchor, using its `getBoundingClientRect()`, with the brand ring `0 0 0 4px var(--brand-ring)`. The anchor is scrolled into view (`scrollIntoView({ block: 'center' })`).
- **Popover:** next to the anchor, with the title, body, "2 of 7", **Back**, **Next** (**Done** on the last step) and **Skip tour**.
- **Keyboard:** focus moves into the popover, Esc means skip, and Enter means Next. It's a `role="dialog"` with `aria-modal="true"`, labelled by the step title.
- **Phone width:** the popover sits at the bottom of the screen, full width.

**Tests:**
1. It shows step 1's title next to an anchor rendered in the test.
2. Next moves on, and Back goes back.
3. A step whose anchor is missing is skipped.
4. Esc calls `onDone('skipped')`.
5. Done on the last step calls `onDone('finished')`.

**Commit:** "A shared, keyboard-friendly tour for walking people through a screen".

---

## Task 5: The dashboard walkthrough (ONB-06, app)

**Anchors:** add `data-tour` attributes to the real elements.
- `booking-link`: the dashboard's booking-link card, in `apps/app/src/pages/practice/DashboardPage.tsx`, near `handleCopyLink`, around line 200.
- `nav-sessions`, `nav-clients`, `nav-availability`, `nav-forms`, `nav-payouts`: the sidebar items for `/dashboard/sessions`, `/dashboard/clients`, `/dashboard/settings/availability`, `/dashboard/settings/forms` and `/dashboard/settings/payouts`. The nav is defined in `apps/app/src/components/shell/practiceNav.tsx` and rendered by `packages/ui/src/navigation/Sidebar.tsx`. Add an optional `tourId?: string` to the sidebar item type, rendered as `data-tour={tourId}` on the link, and set it in `practiceNav.tsx`.
- `account-menu`: the account menu button in `apps/app/src/components/shell/AccountMenu.tsx`.

**Steps, in this order and with this copy:**
1. `booking-link`: "Your booking link". "Share it with clients, or copy it here. This is where they book and pay."
2. `nav-sessions`: "Sessions". "Every booking lands here. Open one to start the video call, take notes or mark it paid."
3. `nav-clients`: "Clients". "Each client's history, forms and notes."
4. `nav-availability`: "Availability". "Set your working hours. Clients can only book times you've opened."
5. `nav-forms`: "Forms". "Your intake and confidentiality forms. Edit the wording to suit your practice."
6. `nav-payouts`: "Payouts". "Where client payments go: Paystack, bank transfer, or both."
7. `account-menu`: "Your account". "Your profile and settings. You can take this tour again from here."

**Wiring:**
- `apps/app/src/components/onboarding/DashboardTour.tsx` renders `<Tour>` with these steps when the signed-in profile (`useAuth().profile`) is a practice account and `tourCompletedAt` is null.
- On `onDone`, it posts `/v1/auth/me/tour-complete`, then `refreshProfile()`.
- Add `tourCompletedAt?: string | null` to the `AuthProfile` type in `apps/app/src/context/AuthContext.tsx`.
- Mount `<DashboardTour />` on `DashboardPage`, so the tour starts the first time someone reaches the dashboard after setup.
- **Take the tour** in `AccountMenu.tsx`: a menu item that starts the tour again (through a small context or a `window` event `unclutter:start-tour` that `DashboardTour` listens for, navigating to `/dashboard` first if needed).

**Tests** (`apps/app/src/components/__tests__/DashboardTour.test.tsx`, faking `apiClient` and `AuthContext` as the other page tests do):
1. With `tourCompletedAt: null`, the first step shows on the dashboard.
2. Finishing posts `/v1/auth/me/tour-complete`.
3. With a date set, no tour is shown.
4. **Take the tour** in the account menu starts it again.

**Browser check** (ports 3299 and 5273): sign in as `dr.jane@smiththerapy.ng`. Clear `tourCompletedAt` for that profile first:

```bash
node --env-file=.env -e "const {PrismaClient}=require('@prisma/client');new PrismaClient().profile.updateMany({where:{email:'dr.jane@smiththerapy.ng'},data:{tourCompletedAt:null}}).then(r=>console.log(r))"
```

Walk all seven steps at 1280px and 390px, and check that each highlight lands on its element.

**Commit:** "New practices get a short walkthrough of the dashboard".

---

## Finish

1. Run everything green: the app, API and UI suites, plus type checks in each.
2. Update `docs/testing-feedback.md`: SET-08 and ONB-06 → `Fixed`, with the commit range and a one-line note on the browser check.
3. Open a PR `opencode/walkthrough-uploads` → `dev`, and list any decision you made that this plan didn't cover.
4. Remove the worktree after merge: `git worktree remove ../unclutterdesk-opencode`.
