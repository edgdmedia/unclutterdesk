# Settings in one place (owner decision, 3 Nov 2026): plan for opencode

**Builder:** opencode. Branch `phase1/settings-ia` from `dev` (after #92 merges), PR into `dev`.

**Before asking for review**, follow `AGENTS.md`: run the full suites and `pnpm typecheck`, and post the totals.

## Tasks

- [ ] **1. One Settings area, four groups.** `/dashboard/settings` gets a left sub-menu (below the page header, not over it), grouped like this:

  | Group | Pages |
  |---|---|
  | **You** | My profile (`/dashboard/profile`, with its Public profile, Share and This practice tabs), Account & preferences, Notifications |
  | **Practice** | Practice profile, Locations, Team, Services, Availability, Discounts |
  | **Booking page** | Brand & booking page, Custom domain, Sending mail, Forms |
  | **Money** | Payouts, Subscription |

  - Keep every existing address working; where a page moves, redirect the old address to the new one.
  - Owner-only and permission rules stay exactly as they are (`practiceNav.tsx` `ownerOnly` and permissions). A role that can't see a page must not see its menu entry.
- [ ] **2. Main sidebar.**
  - Add **My profile** to the main menu, near the top (after Today), for every practitioner.
  - Remove the separate Payouts, Preferences and Forms entries; they live in Settings now.
  - Profile-first accounts (`onboardingIntent = PROFILE`) keep their current short menu.
- [ ] **3. "Confirmed state" preview on the Brand page.** It renders `BookingConfirmedPage` with no booking, so it says "No booking information found". Give `BookingConfirmedPage` an optional `preview` sample (a confirmed session with this practice's name, the first service, a date next week) and pass it from the Brand page preview. The real page is unchanged when there's no `preview`.
- [ ] **Tests:**
  - The Settings menu shows each group with the right pages for an owner and for a therapist.
  - Old addresses redirect.
  - The Confirmed-state preview shows the sample.

## Out of scope

Which fields each profile page shows (§6.17, Spec Claude).
