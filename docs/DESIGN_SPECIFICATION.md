# Unclutter Desk — Design Specification (Claude Design Systems Layer)

**Design Token Layer**: Unclutter Design System OS Token Layer  
**Primary Palette**: Deep Navy (`#0F3A53`), Slate Sidebar (`#0F172A`), Warm Gold Accent (`#E3B341`), Soft Surface (`#F8FAFC`).  
**Typography**: `Outfit` sans-serif  
**Surfaces & Cards**: `24px` rounded-3xl cards (`border border-slate-100 shadow-sm`)  
**Shell Dimensions**: Minimum width `1440px` (Desktop), Responsive Mobile (`< 768px`)  

---

## 1. Design Artifact Files & Layout Architecture

### A. Desktop Spec Board (`Unclutter Desk Screens.dc.html`)
Six complete screens arranged on a single specification canvas:
1. **Therapist Dashboard**: Top header with `Copy Booking Link` action + 1-click clipboard button, revenue summary widget, upcoming sessions.
2. **White-Label Client Booking Portal**: Dynamic brand logo, practitioner bio, service selection cards, interactive date picker, time slot pills, intake details form, sticky confirm bar.
3. **Schedule**: 7-day week grid calendar with recurring availability slots and block-out times.
4. **Clients**: Client roster table with contact details, session count, last session date, and quick action buttons.
5. **Analytics**: 12-month revenue performance chart, session mix breakdown (50-min, 60-min, Couples), and booking sources.
6. **Booking Confirmed**: Client session confirmation screen with calendar sync buttons (.ics, Google Calendar) and 1-click video join link.

### B. Interactive Desktop Prototype (`Unclutter Desk Prototype.dc.html`)
* **Shell & Layout**: Left vertical slate sidebar (`#0F172A`) navigating all 5 workspace screens. Shell min-width `1440px`.
* **Brand Settings Page**:
  * Left Panel: Customizer controls (Logo uploader, Primary Color picker, Secondary Color picker, Custom Domain input).
  * Right Panel: Live `1180px` booking page scaled into an interactive preview pane with a *Booking page / Confirmation* toggle.
* **Layout Safeguards**: Revenue stat row configured to wrap cleanly; Schedule & Clients roster cards set to `flex: none` to prevent lower row clipping.

### C. Mobile Design Specification (`Unclutter Desk Mobile.dc.html`)
Five mobile screens featuring a frosted bottom navigation bar (`backdrop-blur-md`):
1. **Today**: Dark revenue hero card, next upcoming session card.
2. **Schedule**: Horizontal day strip + daily timeline.
3. **Clients**: Mobile client card list with 1-click call/email buttons.
4. **Brand & Booking Link**: Mobile brand settings & 1-click booking link copy bar.
5. **Mobile Client Booking Web**: Mobile client booking page with sticky price/confirm bar at the bottom.

---

## 2. Component Token Mapping (`@unclutterdesk/ui`)

```css
:root {
  /* Unclutter OS Base Tokens */
  --os-sidebar-bg: #0F172A;
  --os-chrome-navy: #0F3A53;
  --os-gold-accent: #E3B341;
  --os-card-radius: 24px;
  --os-shell-min-width: 1440px;

  /* Dynamic Tenant Brand Token Slots (Drives Client Portal) */
  --brand-primary: #0F3A53;
  --brand-secondary: #E3B341;
}
```
