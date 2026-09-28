# Responsive PR 1: Shell, Sidebar and Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every practice page a shared, responsive shell. The sidebar is full on desktop, an icon rail on tablets, and a drawer from "More" on phones. Add the shared `Page`, `PageHeader`, `Grid`, `StatTile` and `MetricTile` components, and use them to fix the three worst pages: the client page, Analytics and Overview.

**Architecture:**
- **In `packages/ui`:** new typed components, styled with Tailwind over the existing `--desk-*` and `--brand-*` tokens.
  - `AppShell` picks the sidebar mode from the screen width (`useViewport`).
  - `Page` is the only place content width is set, and it names a container (`@container/page`), so `Grid` and `PageHeader` respond to the page's own width.
- **In `apps/app`:** only practice-specific data (the nav list, role and plan filtering, the account menu, the brand) goes into a thin `PracticeShell`.
- **Checks:**
  - a rule test that stops page files from setting their own width;
  - a Playwright script that fails on sideways scrolling.

**Not in this PR:** `AppShell`'s `header` slot and its `portal` and `public` modes (spec section 5) arrive with the portal and public pages in PR 5. Tables, form controls and the other pages are PRs 2–4.

**Tech Stack:** React 18, React Router 6, Tailwind CSS 4 (built-in container queries, `@source`), Vitest 2 with Testing Library and jsdom, playwright-core, and a pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-28-responsive-layout-shared-components-design.md`. This plan is PR 1 in the spec's section 9 table; PRs 2–5 get their own plans.

## Global Constraints

- **Widths:**
  - Phone < 768px: no inline sidebar; drawer from "More"; content padding 16px.
  - Tablet 768–1279px: 76px icon rail, always; content padding 24px.
  - Desktop ≥ 1280px: 248px full sidebar, or the rail if the user collapsed it (saved in `localStorage` key `unclutter_sidebar_collapsed`); padding 26px.
- **Content-area container steps** (`@container/page`): `sm` 480px, `md` 640px, `lg` 960px, `xl` 1200px.
- **Page width:** `Page` caps content at 1440px (`narrow`: 880px) and centres it. That is the only maximum width. Pages never set their own.
- **Package code:**
  - typed, with no `@ts-nocheck`;
  - Tailwind classes over tokens, with no inline style objects except runtime values (a brand colour);
  - no routes, auth or roles;
  - every Tailwind class written out in full as a literal string, because Tailwind cannot see classes built by concatenation.
- **Sidebar background:** stays slate (`--desk-sidebar`) in every practice. Tenant colour never tints it.
- **Existing package exports the app uses keep their props:** `Card`, `Eyebrow`, `StatusBadge`, `Button`, `useToast`, `BrandProvider`, `UnclutterLockup`.
- **Phone bottom bar (practice):** Today, Schedule, Clients, Notifications, More.
- **Navigation stays inside the app:** use router links, never `window.location.href` for navigation.
- **Git:**
  - work on `dev`, never push to `main`;
  - every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  - no model IDs in commits or PRs.
- **Commands (from the repo root):**
  - package tests: `pnpm --filter @unclutterdesk/ui test`;
  - app tests: `pnpm --filter @unclutterdesk/app test`;
  - typecheck: `pnpm --recursive run typecheck`.

## Review Focus

1. **A tablet turned to landscape, or a window widened past 1280px, while the tablet overlay or phone drawer is open.** Expected: the overlay closes, and the desktop sidebar shows normally.
   - Test: Task 6, "closes the overlay when the screen becomes desktop width".
2. **A deep link to a nested page such as `/dashboard/clients/53` or `/dashboard/settings/team`.** Expected: the parent item (Clients, or Team & staff) is highlighted in every sidebar mode and in the bottom bar.
   - Test: Task 7, `activeNavKey` cases.
3. **A long practice name, client name or figure in a tile or header.** Expected: it truncates with the full text in a tooltip, instead of pushing the page wider.
   - Tests: Task 3, "truncates long values and keeps the full text as a tooltip", and Task 2, "truncates a long title".
4. **A keyboard or screen-reader user on the rail, where labels are hidden.** Expected: every rail link has an accessible name, and the overlay traps focus and returns it to the button that opened it.
   - Tests: Task 4, "rail links are named", and Task 6, "returns focus to the opener on close".
5. **Phone content hidden behind the fixed bottom bar.** Expected: the content area gets bottom padding whenever the bar is shown, and none when it isn't.
   - Test: Task 6, "pads the content only when the bottom bar shows".

---

## File map

**`packages/ui`**
- Modify `package.json`: `test` script and dev dependencies.
- Create `vitest.config.ts`.
- Create `src/test/setup.ts` and `src/test/matchMedia.ts`, the test helpers.
- Create `src/layout/useViewport.ts`: phone, tablet or desktop from `matchMedia`.
- Create `src/a11y/useFocusTrap.ts`.
- Create `src/layout/Grid.tsx`, `src/layout/Page.tsx`, `src/layout/PageHeader.tsx` and `src/layout/AppShell.tsx`.
- Create `src/navigation/links.tsx`: the `LinkLike` contract and `PlainLink`.
- Create `src/navigation/Sidebar.tsx`: replaces `src/components/Sidebar.tsx`.
- Create `src/navigation/BottomNav.tsx`: replaces `src/components/BottomNav.tsx`.
- Create `src/data/StatTile.tsx` and `src/data/MetricTile.tsx`: replace the `src/components/` versions.
- Delete `src/components/Sidebar.tsx`, `src/components/BottomNav.tsx`, `src/components/StatTile.tsx` and `src/components/MetricTile.tsx`. The app imports none of them except `BottomNav`, which Task 7 replaces.
- Modify `src/index.ts`: exports.
- Tests sit next to each file as `*.test.tsx`.

**`apps/app`**
- Modify `src/index.css`: `@source` for the package.
- Create `src/components/shell/practiceNav.tsx`: nav data, `planIncludes`, `activeNavKey`.
- Create `src/components/shell/RouterLink.tsx`.
- Create `src/components/shell/AccountMenu.tsx`: moved out of the old `Sidebar`.
- Create `src/components/shell/PracticeBrand.tsx`.
- Create `src/components/shell/PracticeShell.tsx`.
- Delete `src/components/Sidebar.tsx`.
- Modify `src/App.tsx`: the shell in `AppLayout`.
- Modify `src/pages/practice/ClientDetailPage.tsx`, `src/pages/practice/AnalyticsPage.tsx` and `src/pages/practice/DashboardPage.tsx`.
- Tests:
  - create `src/components/shell/__tests__/practiceNav.test.ts` and `src/test/layout-rules.test.ts`;
  - modify `src/components/__tests__/plan-tags.test.ts`, `src/utils/__tests__/route-integrity.test.ts` and `src/pages/__tests__/AnalyticsPage.test.tsx`.
- Create `scripts/check-layout.mjs`, and add `check:layout` to `package.json`.

**CI**
- Modify `.github/workflows/deploy-api.yml`, `deploy-app.yml`, `deploy-landing.yml` and `deploy-tenant-router.yml`: add the package tests to the test step.

---

### Task 0: Preconditions

- [ ] **Step 1: Make sure the booking work has merged.** The staff-booking work (Phase 1 step 4) edits `ClientDetailPage.tsx`, `SchedulePage.tsx` and `App.tsx`.

Run: `git fetch origin && git log --oneline origin/main | head -5 && git status --short`

Expected:
- `origin/main` includes the staff booking commits ("Let staff book an open slot…" and later);
- `git status` shows no uncommitted changes to the files above.

If the booking PR is still open, stop and wait. Do not start this plan on top of another session's uncommitted work.

- [ ] **Step 2: Bring `dev` up to date**

Run: `git checkout dev && git pull --ff-only origin dev`

- [ ] **Step 3: Take "before" screenshots for the desktop check**

1. Start the API: `cd apps/api && npx nest build && PORT=3099 node dist/src/main.js`.
2. Start the app: `cd apps/app && VITE_API_URL=http://localhost:3099 npx vite --port 5173 --strictPort`.
3. Logged in as `dr.jane@smiththerapy.ng` / `password123`, save 1280×900 screenshots of `/dashboard`, `/dashboard/clients/53` (or any client) and `/dashboard/analytics` to your scratch folder as `before-*.png`. Keep them for Task 13.

---

### Task 1: Package test setup, Tailwind source and `useViewport`

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/vitest.config.ts`, `packages/ui/src/test/setup.ts`, `packages/ui/src/test/matchMedia.ts`, `packages/ui/src/layout/useViewport.ts`
- Test: `packages/ui/src/layout/useViewport.test.tsx`
- Modify: `apps/app/src/index.css` (after line 2)
- Modify: the 4 files in `.github/workflows/` (the test step)

**Interfaces:**
- Produces:
  - `export type Viewport = 'phone' | 'tablet' | 'desktop'`
  - `export const TABLET_QUERY = '(min-width: 768px)'`
  - `export const DESKTOP_QUERY = '(min-width: 1280px)'`
  - `export function useViewport(): Viewport`
  - Test helpers: `installMatchMedia(width?: number): void` and `setViewportWidth(width: number): void`, in `src/test/matchMedia.ts`.

- [ ] **Step 1: Add the test tooling to the package**

Run: `pnpm --filter @unclutterdesk/ui add -D vitest@^2.1.9 @testing-library/react@^16.1.0 jsdom@^26.1.0 @vitejs/plugin-react@^4.3.1 react@^18.3.1 react-dom@^18.3.1`

Then in `packages/ui/package.json` set `"scripts"` to:

```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
```

`packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

`packages/ui/src/test/setup.ts`:

```ts
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installMatchMedia } from './matchMedia';

// jsdom has no matchMedia; every test starts at desktop width.
installMatchMedia(1280);
afterEach(() => {
  cleanup();
  installMatchMedia(1280);
});
```

`packages/ui/src/test/matchMedia.ts`:

```ts
type Listener = () => void;

let width = 1280;
const listeners = new Set<Listener>();

/** A matchMedia that answers min-width queries against a width tests control. */
export function installMatchMedia(initial = 1280): void {
  width = initial;
  listeners.clear();
  window.matchMedia = ((query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
    return {
      get matches() {
        return width >= min;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, l: Listener) => listeners.add(l),
      removeEventListener: (_type: string, l: Listener) => listeners.delete(l),
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/** Changes the width and tells every listener, as a real resize would. */
export function setViewportWidth(next: number): void {
  width = next;
  listeners.forEach((l) => l());
}
```

- [ ] **Step 2: Write the failing test**

`packages/ui/src/layout/useViewport.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useViewport } from './useViewport';
import { installMatchMedia, setViewportWidth } from '../test/matchMedia';

describe('useViewport', () => {
  it('names the width band', () => {
    installMatchMedia(390);
    expect(renderHook(() => useViewport()).result.current).toBe('phone');
    installMatchMedia(820);
    expect(renderHook(() => useViewport()).result.current).toBe('tablet');
    installMatchMedia(1279);
    expect(renderHook(() => useViewport()).result.current).toBe('tablet');
    installMatchMedia(1280);
    expect(renderHook(() => useViewport()).result.current).toBe('desktop');
  });

  it('follows the screen when it changes', () => {
    installMatchMedia(820);
    const { result } = renderHook(() => useViewport());
    act(() => setViewportWidth(1400));
    expect(result.current).toBe('desktop');
    act(() => setViewportWidth(500));
    expect(result.current).toBe('phone');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL, "Failed to resolve import './useViewport'".

- [ ] **Step 4: Implement**

`packages/ui/src/layout/useViewport.ts`:

```ts
import { useEffect, useState } from 'react';

export type Viewport = 'phone' | 'tablet' | 'desktop';

export const TABLET_QUERY = '(min-width: 768px)';
export const DESKTOP_QUERY = '(min-width: 1280px)';

function read(): Viewport {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'phone';
}

/**
 * Which of the three layouts the screen is in. Only the shell uses this; inside
 * a page, layouts follow the page's own width through container queries.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const lists = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
    const update = () => setViewport(read());
    lists.forEach((l) => l.addEventListener('change', update));
    update();
    return () => lists.forEach((l) => l.removeEventListener('change', update));
  }, []);
  return viewport;
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: PASS (2 tests).

- [ ] **Step 6: Let Tailwind see the package, and run the package tests in CI**

In `apps/app/src/index.css`, after `@import "../../../packages/ui/src/tokens/styles.css";`, add:

```css
/* Shared components live in packages/ui; without this their classes are never generated. */
@source "../../../packages/ui/src";
```

In each of `.github/workflows/deploy-api.yml`, `deploy-app.yml`, `deploy-landing.yml` and `deploy-tenant-router.yml`, change the test line to:

```yaml
        run: pnpm --filter @unclutterdesk/api test && pnpm --filter @unclutterdesk/ui test && pnpm --filter @unclutterdesk/app test && pnpm --filter @unclutterdesk/tenant-router test
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --recursive run typecheck`
Expected: no errors.

```bash
git add packages/ui/package.json packages/ui/vitest.config.ts packages/ui/src/test packages/ui/src/layout/useViewport.ts packages/ui/src/layout/useViewport.test.tsx apps/app/src/index.css .github/workflows pnpm-lock.yaml
git commit -m "Set up tests in the shared UI package and let the app build its classes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `Grid`, `Page` and `PageHeader`

**Files:**
- Create: `packages/ui/src/layout/Grid.tsx`, `packages/ui/src/layout/Page.tsx`, `packages/ui/src/layout/PageHeader.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/layout/Grid.test.tsx` and `packages/ui/src/layout/Page.test.tsx`

**Interfaces:**
- Produces:
  - `export type GridCols = 1 | 2 | 3 | 4 | 5 | 6`
  - `export type ResponsiveCols = { base: GridCols; sm?: GridCols; md?: GridCols; lg?: GridCols; xl?: GridCols }`
  - `export function gridClasses(cols: ResponsiveCols): string`
  - `export function Grid(props: { cols: ResponsiveCols; gap?: 'sm' | 'md' | 'lg'; as?: ElementType; className?: string; children: ReactNode }): JSX.Element`,
    with `Grid.Item(props: { span: ResponsiveCols; as?: ElementType; className?: string; children: ReactNode })`
  - `export function Page(props: { size?: 'default' | 'narrow'; header?: ReactNode; className?: string; children: ReactNode }): JSX.Element`
  - `export function PageHeader(props: { title: ReactNode; eyebrow?: ReactNode; breadcrumb?: ReactNode; actions?: ReactNode; secondaryActions?: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/layout/Grid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Grid, gridClasses } from './Grid';

describe('Grid', () => {
  it('turns column counts into content-width container classes', () => {
    expect(gridClasses({ base: 1, sm: 2, lg: 4 })).toBe(
      'grid-cols-1 @min-[480px]/page:grid-cols-2 @min-[960px]/page:grid-cols-4',
    );
    expect(gridClasses({ base: 2, md: 3, xl: 6 })).toBe(
      'grid-cols-2 @min-[640px]/page:grid-cols-3 @min-[1200px]/page:grid-cols-6',
    );
  });

  it('renders a grid with the gap from the spacing scale', () => {
    render(
      <Grid cols={{ base: 1, lg: 4 }} gap="lg" className="items-start">
        <span>one</span>
      </Grid>,
    );
    const grid = screen.getByText('one').parentElement!;
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('@min-[960px]/page:grid-cols-4');
    expect(grid.className).toContain('gap-5');
    expect(grid.className).toContain('items-start');
  });

  it('lets an item span columns', () => {
    render(
      <Grid cols={{ base: 1, xl: 3 }}>
        <Grid.Item span={{ base: 1, xl: 2 }}>wide</Grid.Item>
      </Grid>,
    );
    expect(screen.getByText('wide').className).toContain('@min-[1200px]/page:col-span-2');
  });
});
```

`packages/ui/src/layout/Page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Page } from './Page';
import { PageHeader } from './PageHeader';

describe('Page', () => {
  it('names the page container and caps content at 1440px', () => {
    const { container } = render(<Page>content</Page>);
    const root = container.firstElementChild!;
    expect(root.className).toContain('@container/page');
    expect(root.className).toContain('min-w-0');
    expect(screen.getByRole('main').className).toContain('max-w-[1440px]');
  });

  it('has a narrow size for form pages', () => {
    render(<Page size="narrow">form</Page>);
    expect(screen.getByRole('main').className).toContain('max-w-[880px]');
  });

  it('renders its header above the content', () => {
    render(<Page header={<PageHeader title="Analytics" />}>body</Page>);
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeTruthy();
  });
});

describe('PageHeader', () => {
  it('shows the eyebrow, breadcrumb and actions', () => {
    render(
      <PageHeader
        eyebrow="PRACTICE ANALYTICS"
        breadcrumb={<a href="/clients">Clients</a>}
        title="Ada Ola"
        actions={<button>Book a session</button>}
      />,
    );
    expect(screen.getByText('PRACTICE ANALYTICS')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Book a session' })).toBeTruthy();
  });

  it('truncates a long title rather than widening the page', () => {
    render(<PageHeader title={'A very long practice name '.repeat(8)} />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('truncate');
  });

  it('folds secondary actions into a "More actions" menu for narrow pages', () => {
    render(<PageHeader title="Client" secondaryActions={<button>Export file</button>} />);
    const more = screen.getByRole('button', { name: 'More actions' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
    // jsdom cannot evaluate container queries, so the inline copy is present too.
    expect(screen.getAllByRole('button', { name: 'Export file' }).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL, the imports cannot be resolved.

- [ ] **Step 3: Implement `Grid`**

`packages/ui/src/layout/Grid.tsx`:

```tsx
import type { ElementType, ReactNode } from 'react';

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6;
export type ResponsiveCols = { base: GridCols; sm?: GridCols; md?: GridCols; lg?: GridCols; xl?: GridCols };
type Step = keyof ResponsiveCols;

const STEPS: Step[] = ['base', 'sm', 'md', 'lg', 'xl'];

// Written out in full so Tailwind can find every class. The widths are the
// page's content area (the `page` container <Page> sets), not the screen,
// so the sidebar is always accounted for.
const COLS: Record<Step, Record<GridCols, string>> = {
  base: { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' },
  sm: {
    1: '@min-[480px]/page:grid-cols-1', 2: '@min-[480px]/page:grid-cols-2', 3: '@min-[480px]/page:grid-cols-3',
    4: '@min-[480px]/page:grid-cols-4', 5: '@min-[480px]/page:grid-cols-5', 6: '@min-[480px]/page:grid-cols-6',
  },
  md: {
    1: '@min-[640px]/page:grid-cols-1', 2: '@min-[640px]/page:grid-cols-2', 3: '@min-[640px]/page:grid-cols-3',
    4: '@min-[640px]/page:grid-cols-4', 5: '@min-[640px]/page:grid-cols-5', 6: '@min-[640px]/page:grid-cols-6',
  },
  lg: {
    1: '@min-[960px]/page:grid-cols-1', 2: '@min-[960px]/page:grid-cols-2', 3: '@min-[960px]/page:grid-cols-3',
    4: '@min-[960px]/page:grid-cols-4', 5: '@min-[960px]/page:grid-cols-5', 6: '@min-[960px]/page:grid-cols-6',
  },
  xl: {
    1: '@min-[1200px]/page:grid-cols-1', 2: '@min-[1200px]/page:grid-cols-2', 3: '@min-[1200px]/page:grid-cols-3',
    4: '@min-[1200px]/page:grid-cols-4', 5: '@min-[1200px]/page:grid-cols-5', 6: '@min-[1200px]/page:grid-cols-6',
  },
};

const SPAN: Record<Step, Record<GridCols, string>> = {
  base: { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6' },
  sm: {
    1: '@min-[480px]/page:col-span-1', 2: '@min-[480px]/page:col-span-2', 3: '@min-[480px]/page:col-span-3',
    4: '@min-[480px]/page:col-span-4', 5: '@min-[480px]/page:col-span-5', 6: '@min-[480px]/page:col-span-6',
  },
  md: {
    1: '@min-[640px]/page:col-span-1', 2: '@min-[640px]/page:col-span-2', 3: '@min-[640px]/page:col-span-3',
    4: '@min-[640px]/page:col-span-4', 5: '@min-[640px]/page:col-span-5', 6: '@min-[640px]/page:col-span-6',
  },
  lg: {
    1: '@min-[960px]/page:col-span-1', 2: '@min-[960px]/page:col-span-2', 3: '@min-[960px]/page:col-span-3',
    4: '@min-[960px]/page:col-span-4', 5: '@min-[960px]/page:col-span-5', 6: '@min-[960px]/page:col-span-6',
  },
  xl: {
    1: '@min-[1200px]/page:col-span-1', 2: '@min-[1200px]/page:col-span-2', 3: '@min-[1200px]/page:col-span-3',
    4: '@min-[1200px]/page:col-span-4', 5: '@min-[1200px]/page:col-span-5', 6: '@min-[1200px]/page:col-span-6',
  },
};

const GAP = { sm: 'gap-3', md: 'gap-4', lg: 'gap-5' } as const;

function classesFrom(table: Record<Step, Record<GridCols, string>>, cols: ResponsiveCols): string {
  return STEPS.filter((s) => cols[s] !== undefined)
    .map((s) => table[s][cols[s] as GridCols])
    .join(' ');
}

export function gridClasses(cols: ResponsiveCols): string {
  return classesFrom(COLS, cols);
}

interface GridProps {
  cols: ResponsiveCols;
  gap?: keyof typeof GAP;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/**
 * Columns that fall back as the page narrows. Use this instead of a bare
 * grid-cols-N, which has no narrow fallback and pushes the page wider.
 */
export function Grid({ cols, gap = 'md', as: Tag = 'div', className = '', children }: GridProps) {
  return <Tag className={`grid ${gridClasses(cols)} ${GAP[gap]} ${className}`.trim()}>{children}</Tag>;
}

function GridItem({ span, as: Tag = 'div', className = '', children }: { span: ResponsiveCols; as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`min-w-0 ${classesFrom(SPAN, span)} ${className}`.trim()}>{children}</Tag>;
}

Grid.Item = GridItem;
```

- [ ] **Step 4: Implement `Page` and `PageHeader`**

`packages/ui/src/layout/Page.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface PageProps {
  /** `narrow` is for pages that are only a form, so fields do not stretch across a wide screen. */
  size?: 'default' | 'narrow';
  header?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The one place a page's width is decided. It fills the space the shell gives
 * it, caps content at 1440px (880px when narrow) and names the `page`
 * container that Grid and PageHeader respond to. Pages never set their own
 * width.
 */
export function Page({ size = 'default', header, className = '', children }: PageProps) {
  const cap = size === 'narrow' ? 'max-w-[880px]' : 'max-w-[1440px]';
  return (
    <div className="@container/page flex-1 min-w-0 flex flex-col bg-[var(--desk-surface)]">
      {header}
      <main className={`w-full mx-auto ${cap} flex-1 px-4 py-4 md:px-6 md:py-6 xl:px-[26px] xl:pt-6 xl:pb-[30px] space-y-5 ${className}`.trim()}>
        {children}
      </main>
    </div>
  );
}
```

`packages/ui/src/layout/PageHeader.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { Eyebrow } from '../components/Eyebrow';

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Shown before the title, e.g. a link back to the list. */
  breadcrumb?: ReactNode;
  /** The main actions; always visible, wrapping under the title when there is no room. */
  actions?: ReactNode;
  /** Shown inline on wide pages, and in a "More actions" menu on narrow ones. */
  secondaryActions?: ReactNode;
}

export function PageHeader({ title, eyebrow, breadcrumb, actions, secondaryActions }: PageHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="bg-[var(--desk-card)] border-b border-[var(--desk-border)] print:hidden">
      <div className="min-h-[70px] px-4 md:px-6 xl:px-[26px] py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1 basis-[240px]">
          {eyebrow ? <Eyebrow className="block">{eyebrow}</Eyebrow> : null}
          <div className="flex items-center gap-2 min-w-0">
            {breadcrumb ? (
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm shrink-0">
                {breadcrumb}
              </nav>
            ) : null}
            <h1 className="min-w-0 truncate text-[17px] md:text-[20px] font-bold tracking-[-0.02em] text-[var(--desk-text)]">
              {title}
            </h1>
          </div>
        </div>
        {actions || secondaryActions ? (
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
            {secondaryActions ? (
              <>
                <div className="hidden @min-[640px]/page:contents">{secondaryActions}</div>
                <div className="relative @min-[640px]/page:hidden">
                  <button
                    type="button"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-[12px] border border-[var(--desk-border)] bg-[var(--desk-card)] text-[var(--desk-text-body)] cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                  {menuOpen ? (
                    <div
                      role="menu"
                      onClick={() => setMenuOpen(false)}
                      className="absolute right-0 top-full mt-2 z-30 min-w-[200px] rounded-[14px] bg-[var(--desk-card)] border border-[var(--desk-border)] shadow-[var(--desk-shadow-lg)] p-1.5 flex flex-col gap-1 [&>*]:w-full"
                    >
                      {secondaryActions}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
```

In `packages/ui/src/index.ts`, add:

```ts
export * from './layout/useViewport';
export * from './layout/Grid';
export * from './layout/Page';
export * from './layout/PageHeader';
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @unclutterdesk/ui typecheck`
Expected: no errors. `Eyebrow` is untyped (`any`), so passing `className` is accepted.

```bash
git add packages/ui/src/layout packages/ui/src/index.ts
git commit -m "Add shared Page, PageHeader and Grid components that follow the page's own width

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `StatTile` and `MetricTile`

**Files:**
- Create: `packages/ui/src/data/StatTile.tsx` and `packages/ui/src/data/MetricTile.tsx`
- Delete: `packages/ui/src/components/StatTile.tsx` and `packages/ui/src/components/MetricTile.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/data/tiles.test.tsx`

**Interfaces:**
- Produces:
  - `export function StatTile(props: { label: ReactNode; value: ReactNode; delta?: ReactNode; deltaTone?: 'up' | 'down' | 'neutral'; variant?: 'card' | 'inset'; size?: 'sm' | 'md' | 'lg'; valueColor?: string; className?: string; children?: ReactNode })`.
    `children` renders under the value, for extra lines.
  - `export function MetricTile(props: { value: ReactNode; label: ReactNode; className?: string })`

- [ ] **Step 1: Check nothing imports the old tiles**

Run: `grep -rn "StatTile\|MetricTile" apps --include=*.tsx --include=*.ts | grep -v node_modules`
Expected: no output.

- [ ] **Step 2: Write the failing tests**

`packages/ui/src/data/tiles.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatTile } from './StatTile';
import { MetricTile } from './MetricTile';

describe('StatTile', () => {
  it('shows the label, the value and a delta', () => {
    render(<StatTile label="Sessions" value={42} delta="+12%" deltaTone="up" />);
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('+12%').className).toContain('var(--desk-active');
  });

  it('truncates long values and keeps the full text as a tooltip', () => {
    const long = 'Wednesday 14 October 2026, 10:00 with Dr Jane Smith';
    render(<StatTile label="Next session" value={long} />);
    const value = screen.getByText(long);
    expect(value.className).toContain('truncate');
    expect(value.getAttribute('title')).toBe(long);
  });

  it('never forces its column wider', () => {
    const { container } = render(<StatTile label="x" value="y" variant="inset" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('min-w-0');
  });

  it('takes a runtime colour for the value', () => {
    render(<StatTile label="Next" value="Mon" valueColor="#123456" />);
    expect((screen.getByText('Mon') as HTMLElement).style.color).toBe('rgb(18, 52, 86)');
  });
});

describe('MetricTile', () => {
  it('shows the value over its label', () => {
    render(<MetricTile value={8} label="Total clients" />);
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Total clients')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL, the imports cannot be resolved.

- [ ] **Step 4: Implement**

`packages/ui/src/data/StatTile.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Eyebrow } from '../components/Eyebrow';

const BOX = {
  card: 'p-[16px_18px] rounded-[20px] bg-[var(--desk-card)] border border-[var(--desk-border)] shadow-[var(--desk-shadow-sm)]',
  inset: 'p-3.5 rounded-[16px] bg-[var(--desk-surface)] border border-[var(--desk-border)]',
} as const;

const VALUE_SIZE = {
  sm: 'text-[18px]',
  md: 'text-[22px]',
  lg: 'text-[26px] tracking-[-0.035em]',
} as const;

const DELTA = {
  up: 'bg-[var(--desk-active-bg)] border-[var(--desk-active-border)] text-[var(--desk-active)]',
  down: 'bg-[var(--desk-danger-bg)] border-[var(--desk-danger-border)] text-[var(--desk-danger)]',
  neutral: 'bg-[var(--desk-inactive-bg)] border-[var(--desk-inactive-border)] text-[var(--desk-inactive)]',
} as const;

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: keyof typeof DELTA;
  variant?: keyof typeof BOX;
  size?: keyof typeof VALUE_SIZE;
  /** A colour only known at runtime, such as the practice's brand colour. */
  valueColor?: string;
  className?: string;
  children?: ReactNode;
}

/** A labelled figure. Truncates rather than widening its column. */
export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'up',
  variant = 'card',
  size = 'md',
  valueColor,
  className = '',
  children,
}: StatTileProps) {
  const title = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  return (
    <div className={`min-w-0 ${BOX[variant]} ${className}`.trim()}>
      <Eyebrow className="mb-1 block truncate">{label}</Eyebrow>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <span
          title={title}
          style={valueColor ? { color: valueColor } : undefined}
          className={`min-w-0 truncate font-extrabold leading-tight text-[var(--desk-text)] ${VALUE_SIZE[size]}`}
        >
          {value}
        </span>
        {delta ? (
          <span className={`shrink-0 h-[22px] px-2 rounded-full border text-[11.5px] font-bold inline-flex items-center gap-0.5 ${DELTA[deltaTone]}`}>
            {delta}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
```

`packages/ui/src/data/MetricTile.tsx`:

```tsx
import type { ReactNode } from 'react';

/** A small figure with its label underneath, as in the Overview revenue card. */
export function MetricTile({ value, label, className = '' }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 p-2.5 md:p-[12px_14px] rounded-[16px] bg-[var(--desk-surface)] border border-[var(--desk-border)] ${className}`.trim()}>
      <span className="block truncate text-[20px] md:text-[22px] font-extrabold tracking-[-0.03em] text-[var(--desk-text)] leading-none mb-1">
        {value}
      </span>
      <span className="block truncate text-[11px] font-medium text-[var(--desk-text-muted)]">{label}</span>
    </div>
  );
}
```

Delete the old files:
`git rm packages/ui/src/components/StatTile.tsx packages/ui/src/components/MetricTile.tsx`

In `packages/ui/src/index.ts`:
- replace `export * from './components/MetricTile';` with `export * from './data/MetricTile';`;
- replace `export * from './components/StatTile';` with `export * from './data/StatTile';`.

- [ ] **Step 5: Run the tests and confirm they pass, then typecheck**

Run: `pnpm --filter @unclutterdesk/ui test && pnpm --recursive run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A packages/ui/src/data packages/ui/src/components packages/ui/src/index.ts
git commit -m "Rebuild StatTile and MetricTile as typed, token-based shared tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `Sidebar` (full, rail and overlay) and the focus trap

**Files:**
- Create: `packages/ui/src/navigation/links.tsx`, `packages/ui/src/a11y/useFocusTrap.ts`, `packages/ui/src/navigation/Sidebar.tsx`
- Delete: `packages/ui/src/components/Sidebar.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/navigation/Sidebar.test.tsx`

**Interfaces:**
- Produces:
  - `export interface LinkLikeProps { href: string; className?: string; children: ReactNode; title?: string; 'aria-label'?: string; 'aria-current'?: 'page'; onClick?: () => void }`
  - `export type LinkLike = ComponentType<LinkLikeProps>`
  - `export const PlainLink: LinkLike`
  - `export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean): void`
  - `export interface SidebarItem { key: string; label: string; href: string; icon: ReactNode; badge?: ReactNode }`
  - `export interface SidebarGroup { key: string; label?: string; items: SidebarItem[] }`
  - `export interface SidebarSection { key: string; label?: string; icon?: ReactNode; collapsible?: boolean; groups: SidebarGroup[] }`
  - `export type SidebarMode = 'full' | 'rail' | 'overlay'`
  - `export interface SidebarProps { sections: SidebarSection[]; activeKey?: string; mode: SidebarMode; brand: (mode: SidebarMode) => ReactNode; account?: (mode: SidebarMode) => ReactNode; LinkComponent?: LinkLike; openSections?: Record<string, boolean>; onSectionToggle?: (key: string, open: boolean) => void; onToggleCollapse?: () => void; onClose?: () => void; onNavigate?: () => void }`
  - `export function Sidebar(props: SidebarProps): JSX.Element`

- [ ] **Step 1: Check nothing imports the old package `Sidebar`**

Run: `grep -rn "Sidebar" apps --include=*.tsx | grep "@unclutterdesk/ui"`
Expected: no output. The app uses its own `components/Sidebar.tsx`.

- [ ] **Step 2: Write the failing tests**

`packages/ui/src/navigation/Sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar, type SidebarSection } from './Sidebar';

const icon = <svg data-testid="icon" />;
const SECTIONS: SidebarSection[] = [
  {
    key: 'main',
    groups: [
      {
        key: 'main',
        items: [
          { key: '/dashboard', label: 'Overview', href: '/dashboard', icon },
          { key: '/dashboard/clients', label: 'Clients', href: '/dashboard/clients', icon },
        ],
      },
    ],
  },
  {
    key: 'practice',
    label: 'Practice',
    collapsible: true,
    groups: [
      { key: 'ops', label: 'Operations', items: [{ key: '/dashboard/settings/team', label: 'Team & staff', href: '/dashboard/settings/team', icon, badge: <span>clinic</span> }] },
    ],
  },
];

const brand = (mode: string) => <span>brand-{mode}</span>;

describe('Sidebar, full', () => {
  it('renders every item with its label, and marks the active one', () => {
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} activeKey="/dashboard/clients" />);
    const clients = screen.getByRole('link', { name: 'Clients' });
    expect(clients.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getByText('clinic')).toBeTruthy();
    expect(screen.getByText('brand-full')).toBeTruthy();
  });

  it('collapses a section and reports it', () => {
    const onSectionToggle = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} openSections={{ practice: true }} onSectionToggle={onSectionToggle} />);
    const toggle = screen.getByRole('button', { name: /Practice/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(onSectionToggle).toHaveBeenCalledWith('practice', false);
  });

  it('hides a closed section’s items', () => {
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} openSections={{ practice: false }} />);
    expect(screen.queryByRole('link', { name: /Team & staff/ })).toBeNull();
  });

  it('offers Collapse when a toggle is given', () => {
    const onToggleCollapse = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} onToggleCollapse={onToggleCollapse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});

describe('Sidebar, rail', () => {
  it('rail links are named although their labels are hidden', () => {
    render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} openSections={{ practice: false }} />);
    // Rail shows every item, closed sections included: there is no section header to open.
    for (const name of ['Overview', 'Clients', 'Team & staff']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('aria-label')).toBe(name);
    }
    expect(screen.getByText('brand-rail')).toBeTruthy();
    expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
  });

  it('is 76px wide and the full sidebar is 248px', () => {
    const { container, rerender } = render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} />);
    expect(container.querySelector('aside')!.className).toContain('w-[76px]');
    rerender(<Sidebar sections={SECTIONS} mode="full" brand={brand} />);
    expect(container.querySelector('aside')!.className).toContain('w-[248px]');
  });

  it('offers Expand', () => {
    const onToggleCollapse = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} onToggleCollapse={onToggleCollapse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});

describe('Sidebar, overlay', () => {
  it('is a modal dialog that closes on Esc, the backdrop and the close button', () => {
    const onClose = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="overlay" brand={brand} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sidebar-backdrop'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('moves focus inside and keeps Tab there', () => {
    render(<Sidebar sections={SECTIONS} mode="overlay" brand={brand} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('calls onNavigate when an item is chosen', () => {
    const onNavigate = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="overlay" brand={brand} onClose={() => {}} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'Clients' }));
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('Sidebar links', () => {
  it('uses the LinkComponent it is given', () => {
    const Custom = ({ href, children, ...rest }: any) => <a data-router href={href} {...rest}>{children}</a>;
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} LinkComponent={Custom} />);
    expect(screen.getByRole('link', { name: 'Overview' }).hasAttribute('data-router')).toBe(true);
  });

  it('renders the account slot for the current mode', () => {
    render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} account={(m) => <span>account-{m}</span>} />);
    expect(screen.getByText('account-rail')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 4: Implement the link contract and the focus trap**

`packages/ui/src/navigation/links.tsx`:

```tsx
import type { ComponentType, ReactNode } from 'react';

export interface LinkLikeProps {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  'aria-label'?: string;
  'aria-current'?: 'page';
  onClick?: () => void;
}

/** How navigation components render a link. The app passes one backed by its router. */
export type LinkLike = ComponentType<LinkLikeProps>;

export const PlainLink: LinkLike = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);
```

`packages/ui/src/a11y/useFocusTrap.ts`:

```ts
import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** While active, focus starts inside `ref` and Tab cycles within it. */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const list = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    list()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = list();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [ref, active]);
}
```

- [ ] **Step 5: Implement `Sidebar`**

`packages/ui/src/navigation/Sidebar.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { PlainLink, type LinkLike } from './links';
import { useFocusTrap } from '../a11y/useFocusTrap';

export interface SidebarItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  /** Shown after the label in full mode, e.g. a plan tag. */
  badge?: ReactNode;
}
export interface SidebarGroup {
  key: string;
  label?: string;
  items: SidebarItem[];
}
export interface SidebarSection {
  key: string;
  label?: string;
  icon?: ReactNode;
  collapsible?: boolean;
  groups: SidebarGroup[];
}
export type SidebarMode = 'full' | 'rail' | 'overlay';

export interface SidebarProps {
  sections: SidebarSection[];
  activeKey?: string;
  mode: SidebarMode;
  brand: (mode: SidebarMode) => ReactNode;
  account?: (mode: SidebarMode) => ReactNode;
  LinkComponent?: LinkLike;
  openSections?: Record<string, boolean>;
  onSectionToggle?: (key: string, open: boolean) => void;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}

const ITEM_BASE = 'relative flex items-center h-[44px] rounded-[14px] text-[13.5px] font-semibold transition-all';
const ITEM_IDLE = 'text-[var(--desk-text-subtle)] hover:text-[var(--desk-border)] hover:bg-[var(--desk-sidebar-hover)]';
// The active item's look is the design's pine gradient, the same in every practice.
const ITEM_ACTIVE =
  'text-white bg-[linear-gradient(90deg,rgba(28,78,63,.92),rgba(46,122,99,.55))] shadow-[inset_0_0_0_1px_rgba(74,151,129,.30),0_8px_24px_rgba(20,58,47,.50)] [&_svg]:stroke-[var(--desk-pine-400)]';

function Item({ item, active, rail, Link, onNavigate }: { item: SidebarItem; active: boolean; rail: boolean; Link: LinkLike; onNavigate?: () => void }) {
  const state = active ? ITEM_ACTIVE : ITEM_IDLE;
  if (rail) {
    return (
      <div className="group relative">
        <Link
          href={item.href}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
          className={`${ITEM_BASE} ${state} justify-center w-[44px] mx-auto focus-visible:outline-2 focus-visible:outline-[var(--desk-pine-400)]`}
        >
          <span className="flex [&_svg]:h-[18px] [&_svg]:w-[18px]">{item.icon}</span>
        </Link>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-[8px] bg-[var(--desk-sidebar-hover)] px-2.5 py-1 text-[12px] font-semibold text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
        >
          {item.label}
        </span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`${ITEM_BASE} ${state} px-3 gap-2.5`}
    >
      {active ? <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[20px] bg-[var(--desk-pine-400)] rounded-r-[3px]" /> : null}
      <span className="flex flex-none [&_svg]:h-[18px] [&_svg]:w-[18px]">{item.icon}</span>
      <span className="truncate">{item.label}</span>
      {item.badge ? <span className="ml-auto">{item.badge}</span> : null}
    </Link>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d={collapsed ? 'M15 4v16M10 10l-2 2 2 2' : 'M9 4v16M15 10l2 2-2 2'} />
    </svg>
  );
}

/**
 * The workspace navigation, in three modes:
 *   full    — 248px, labels and group headings (desktop).
 *   rail    — 76px, icons with tooltips; every item shown (tablet, or collapsed desktop).
 *   overlay — the full sidebar over the page, as a modal (tablet expand, phone "More").
 * It renders what it is given; which items a person sees is the app's decision.
 */
export function Sidebar({
  sections,
  activeKey,
  mode,
  brand,
  account,
  LinkComponent = PlainLink,
  openSections = {},
  onSectionToggle,
  onToggleCollapse,
  onClose,
  onNavigate,
}: SidebarProps) {
  const rail = mode === 'rail';
  const overlay = mode === 'overlay';
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, overlay);

  useEffect(() => {
    if (!overlay || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, onClose]);

  const isOpen = (s: SidebarSection) => !s.collapsible || rail || (openSections[s.key] ?? true);

  const nav = (
    <nav aria-label="Main" className={`flex-1 min-h-0 overflow-y-auto space-y-1 ${rail ? 'flex flex-col items-center' : ''}`}>
      {sections.map((section, sIndex) => (
        <div key={section.key} className={rail ? 'w-full space-y-1' : 'space-y-1'}>
          {rail && sIndex > 0 ? <div role="separator" className="h-px w-8 mx-auto my-2 bg-white/10" /> : null}
          {!rail && section.label ? (
            section.collapsible ? (
              <button
                type="button"
                aria-expanded={isOpen(section)}
                onClick={() => onSectionToggle?.(section.key, !isOpen(section))}
                className="w-full flex items-center gap-2 text-[9px] font-black tracking-[0.2em] uppercase text-[var(--desk-text-muted)] hover:text-[var(--desk-text-subtle)] px-3 pb-2 pt-5 transition-colors cursor-pointer"
              >
                {section.icon}
                {section.label}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`ml-auto transition-transform ${isOpen(section) ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            ) : (
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-[var(--desk-text-muted)] px-3 pb-2 pt-5">{section.label}</div>
            )
          ) : null}
          {isOpen(section) ? (
            <div className={!rail && section.collapsible ? '-mx-1.5 px-1.5 py-1.5 rounded-[14px] bg-white/[0.045] space-y-1' : 'space-y-1'}>
              {section.groups.map((group, gIndex) => (
                <div key={group.key} className="space-y-1">
                  {rail && gIndex > 0 ? <div role="separator" className="h-px w-6 mx-auto my-1.5 bg-white/10" /> : null}
                  {!rail && group.label ? (
                    <div className={`text-[9px] font-black tracking-[0.2em] uppercase text-[var(--desk-text-muted)] px-3 pb-1 ${gIndex === 0 ? 'pt-1.5' : 'pt-3'}`}>{group.label}</div>
                  ) : null}
                  {group.items.map((item) => (
                    <Item key={item.key} item={item} rail={rail} active={item.key === activeKey} Link={LinkComponent} onNavigate={onNavigate} />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {onToggleCollapse && !overlay ? (
        <button
          type="button"
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
          className={`mt-2 flex items-center h-[36px] gap-2.5 rounded-[12px] cursor-pointer text-[var(--desk-text-subtle)] hover:bg-[var(--desk-sidebar-hover)] text-[12.5px] font-semibold ${rail ? 'justify-center w-[44px] mx-auto' : 'w-full px-3'}`}
        >
          <CollapseIcon collapsed={rail} />
          {rail ? null : 'Collapse'}
        </button>
      ) : null}
    </nav>
  );

  const panel = (
    <aside
      ref={panelRef}
      role={overlay ? 'dialog' : undefined}
      aria-modal={overlay ? true : undefined}
      aria-label={overlay ? 'Menu' : 'Sidebar'}
      className={`${rail ? 'w-[76px] px-2.5' : 'w-[248px] px-3.5'} py-5 h-screen flex flex-col gap-6 bg-[var(--desk-sidebar)] text-white select-none border-r border-slate-800/50 ${
        overlay ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'sticky top-0 shrink-0'
      }`}
    >
      <div className={`px-2 py-1 flex items-center ${rail ? 'justify-center' : 'justify-between'}`}>
        {brand(mode)}
        {overlay && onClose ? (
          <button type="button" aria-label="Close menu" onClick={onClose} className="p-1 text-[var(--desk-text-subtle)] hover:text-white cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
      {nav}
      {account ? <div className={`pt-3.5 border-t border-white/[0.07] ${rail ? 'flex justify-center' : 'px-2'}`}>{account(mode)}</div> : null}
    </aside>
  );

  if (!overlay) return panel;
  return (
    <>
      <div data-testid="sidebar-backdrop" onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" />
      {panel}
    </>
  );
}
```

Delete the old file: `git rm packages/ui/src/components/Sidebar.tsx`.

In `packages/ui/src/index.ts`, replace `export * from './components/Sidebar';` with:

```ts
export * from './navigation/links';
export * from './navigation/Sidebar';
export * from './a11y/useFocusTrap';
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: PASS.

If the "moves focus inside" test finds focus on `<body>`, the effect ran before the ref was attached. Keep `useFocusTrap` inside a `useEffect` (not `useLayoutEffect`), and render the panel unconditionally, as written above.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --recursive run typecheck`
Expected: no errors.

```bash
git add -A packages/ui/src/navigation packages/ui/src/a11y packages/ui/src/components/Sidebar.tsx packages/ui/src/index.ts
git commit -m "Add one shared sidebar with full, icon-rail and overlay modes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `BottomNav` with "More" and router links

**Files:**
- Create: `packages/ui/src/navigation/BottomNav.tsx`
- Delete: `packages/ui/src/components/BottomNav.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/navigation/BottomNav.test.tsx`

**Interfaces:**
- Consumes: `LinkLike` and `PlainLink` (Task 4).
- Produces:
  - `export interface BottomNavItem { key: string; label: string; icon: ReactNode; href?: string }`
  - `export interface BottomNavProps { items: BottomNavItem[]; active?: string; onSelect?: (key: string) => void; LinkComponent?: LinkLike; onMore?: () => void; moreLabel?: string; className?: string }`
  - `export function BottomNav(props: BottomNavProps): JSX.Element`

  The existing props `items`, `active` and `onSelect` keep working.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/navigation/BottomNav.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BottomNav } from './BottomNav';

const icon = <svg />;

describe('BottomNav', () => {
  it('renders links for items with an href and marks the active one', () => {
    render(
      <BottomNav
        items={[
          { key: '/dashboard', label: 'Today', icon, href: '/dashboard' },
          { key: '/dashboard/clients', label: 'Clients', icon, href: '/dashboard/clients' },
        ]}
        active="/dashboard/clients"
      />,
    );
    expect(screen.getByRole('link', { name: 'Clients' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Today' }).getAttribute('aria-current')).toBeNull();
  });

  it('still supports onSelect for items without an href', () => {
    const onSelect = vi.fn();
    render(<BottomNav items={[{ key: 'a', label: 'Alpha', icon }]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('adds a More button that opens the menu', () => {
    const onMore = vi.fn();
    render(<BottomNav items={[]} onMore={onMore} />);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(more);
    expect(onMore).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL. The old `BottomNav` renders no links and has no More button.

- [ ] **Step 3: Implement**

`packages/ui/src/navigation/BottomNav.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PlainLink, type LinkLike } from './links';

export interface BottomNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  active?: string;
  onSelect?: (key: string) => void;
  LinkComponent?: LinkLike;
  /** Adds a "More" button, which opens the full menu. */
  onMore?: () => void;
  moreLabel?: string;
  className?: string;
}

const CELL = 'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold cursor-pointer';

/** The phone's bottom bar: a few main destinations, and "More" for the rest. */
export function BottomNav({ items, active, onSelect, LinkComponent = PlainLink, onMore, moreLabel = 'More', className = '' }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={`flex items-stretch h-[68px] px-2 pb-[env(safe-area-inset-bottom)] bg-white/90 backdrop-blur-md border-t border-[var(--desk-border)] ${className}`.trim()}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const tone = isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--desk-text-muted)]';
        const content = (
          <>
            <span className="flex [&_svg]:h-5 [&_svg]:w-5">{item.icon}</span>
            <span className="truncate max-w-full">{item.label}</span>
          </>
        );
        return item.href ? (
          <LinkComponent key={item.key} href={item.href} aria-current={isActive ? 'page' : undefined} className={`${CELL} ${tone}`}>
            {content}
          </LinkComponent>
        ) : (
          <button key={item.key} type="button" aria-current={isActive ? 'page' : undefined} onClick={() => onSelect?.(item.key)} className={`${CELL} ${tone}`}>
            {content}
          </button>
        );
      })}
      {onMore ? (
        <button type="button" aria-haspopup="dialog" onClick={onMore} className={`${CELL} text-[var(--desk-text-muted)]`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span>{moreLabel}</span>
        </button>
      ) : null}
    </nav>
  );
}
```

`git rm packages/ui/src/components/BottomNav.tsx`, and in `packages/ui/src/index.ts` replace `export * from './components/BottomNav';` with `export * from './navigation/BottomNav';`.

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @unclutterdesk/ui test && pnpm --recursive run typecheck`
Expected: PASS, no type errors. `App.tsx` still passes `items`, `active` and `onSelect`, which remain valid.

- [ ] **Step 5: Commit**

```bash
git add -A packages/ui/src/navigation packages/ui/src/components/BottomNav.tsx packages/ui/src/index.ts
git commit -m "Rebuild the phone bottom bar with router links and a More button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `AppShell`

**Files:**
- Create: `packages/ui/src/layout/AppShell.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/layout/AppShell.test.tsx`

**Interfaces:**
- Consumes: `useViewport` (Task 1); `Sidebar`, `SidebarProps` and `SidebarMode` (Task 4); `BottomNav` and `BottomNavProps` (Task 5).
- Produces:
  - `export interface AppShellProps { sidebar?: Omit<SidebarProps, 'mode' | 'onToggleCollapse' | 'onClose' | 'onNavigate'>; collapsed?: boolean; onCollapsedChange?: (collapsed: boolean) => void; bottomNav?: Omit<BottomNavProps, 'onMore'>; banner?: ReactNode; children: ReactNode }`
  - `export function AppShell(props: AppShellProps): JSX.Element`

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/layout/AppShell.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import type { SidebarSection } from '../navigation/Sidebar';
import { installMatchMedia, setViewportWidth } from '../test/matchMedia';

const sections: SidebarSection[] = [
  { key: 'main', groups: [{ key: 'main', items: [{ key: '/a', label: 'Overview', href: '/a', icon: <svg /> }] }] },
];
const sidebar = { sections, brand: () => <span>brand</span> };
const bottomNav = { items: [{ key: '/a', label: 'Today', icon: <svg />, href: '/a' }] };

function shell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  return render(
    <AppShell sidebar={sidebar} bottomNav={bottomNav} {...props}>
      <p>page</p>
    </AppShell>,
  );
}

const aside = () => document.querySelector('aside');

describe('AppShell on a desktop', () => {
  it('shows the full sidebar, or the rail when collapsed, and no bottom bar', () => {
    installMatchMedia(1440);
    const { rerender } = shell();
    expect(aside()!.className).toContain('w-[248px]');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    rerender(
      <AppShell sidebar={sidebar} bottomNav={bottomNav} collapsed>
        <p>page</p>
      </AppShell>,
    );
    expect(aside()!.className).toContain('w-[76px]');
  });

  it('collapses through onCollapsedChange', () => {
    installMatchMedia(1440);
    const onCollapsedChange = vi.fn();
    shell({ onCollapsedChange });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });
});

describe('AppShell on a tablet', () => {
  it('always shows the rail, even if the desktop preference is expanded', () => {
    installMatchMedia(820);
    shell({ collapsed: false });
    expect(aside()!.className).toContain('w-[76px]');
  });

  it('expands over the page rather than beside it', () => {
    installMatchMedia(820);
    const onCollapsedChange = vi.fn();
    shell({ onCollapsedChange });
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    expect(onCollapsedChange).not.toHaveBeenCalled();
  });

  it('closes the overlay when the screen becomes desktop width', () => {
    installMatchMedia(820);
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    act(() => setViewportWidth(1400));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(aside()!.className).toContain('w-[248px]');
  });
});

describe('AppShell on a phone', () => {
  it('has no inline sidebar and shows the bottom bar with More', () => {
    installMatchMedia(390);
    shell();
    expect(aside()).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('opens the menu from More and returns focus to the opener on close', () => {
    installMatchMedia(390);
    shell();
    const more = screen.getByRole('button', { name: 'More' });
    more.focus();
    fireEvent.click(more);
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('closes the menu after choosing a page', () => {
    installMatchMedia(390);
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('AppShell content', () => {
  it('pads the content only when the bottom bar shows', () => {
    installMatchMedia(390);
    const { unmount } = shell();
    expect(screen.getByTestId('app-content').className).toContain('pb-[84px]');
    unmount();
    installMatchMedia(1440);
    shell();
    expect(screen.getByTestId('app-content').className).not.toContain('pb-[84px]');
  });

  it('keeps the content column from being forced wider', () => {
    shell();
    expect(screen.getByTestId('app-content').className).toContain('min-w-0');
  });

  it('renders a banner above the page', () => {
    shell({ banner: <div role="alert">Could not load</div> });
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement**

`packages/ui/src/layout/AppShell.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useViewport } from './useViewport';
import { Sidebar, type SidebarMode, type SidebarProps } from '../navigation/Sidebar';
import { BottomNav, type BottomNavProps } from '../navigation/BottomNav';

export interface AppShellProps {
  sidebar?: Omit<SidebarProps, 'mode' | 'onToggleCollapse' | 'onClose' | 'onNavigate'>;
  /** The desktop preference; tablets always get the rail. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  bottomNav?: Omit<BottomNavProps, 'onMore'>;
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * The workspace frame. It decides the sidebar's mode from the screen:
 * phone, a drawer from "More"; tablet, the rail, expanding over the page;
 * desktop, full or rail by the user's choice. The content column fills the
 * rest and can never be forced wider than the screen.
 */
export function AppShell({ sidebar, collapsed = false, onCollapsedChange, bottomNav, banner, children }: AppShellProps) {
  const viewport = useViewport();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const openOverlay = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setOverlayOpen(true);
  };
  const closeOverlay = () => {
    setOverlayOpen(false);
    opener.current?.focus?.();
  };

  // A tablet turned to landscape, or a window widened, must not keep an
  // overlay open on top of the desktop sidebar.
  useEffect(() => {
    if (viewport === 'desktop') setOverlayOpen(false);
  }, [viewport]);

  const inlineMode: SidebarMode | null = !sidebar || viewport === 'phone' ? null : viewport === 'desktop' && !collapsed ? 'full' : 'rail';
  const onToggleCollapse =
    viewport === 'desktop' ? (onCollapsedChange ? () => onCollapsedChange(!collapsed) : undefined) : openOverlay;
  const showBottom = Boolean(bottomNav) && viewport === 'phone';

  return (
    <div className="flex min-h-screen bg-[var(--desk-surface)]">
      {inlineMode && sidebar ? <Sidebar {...sidebar} mode={inlineMode} onToggleCollapse={onToggleCollapse} /> : null}
      {overlayOpen && sidebar ? <Sidebar {...sidebar} mode="overlay" onClose={closeOverlay} onNavigate={closeOverlay} /> : null}
      <div data-testid="app-content" className={`flex-1 min-w-0 flex flex-col ${showBottom ? 'pb-[84px]' : ''}`.trim()}>
        {banner}
        {children}
      </div>
      {showBottom && bottomNav ? (
        <div className="fixed bottom-0 inset-x-0 z-40">
          <BottomNav {...bottomNav} onMore={sidebar ? openOverlay : undefined} />
        </div>
      ) : null}
    </div>
  );
}
```

In `packages/ui/src/index.ts`, add `export * from './layout/AppShell';`.

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @unclutterdesk/ui test && pnpm --filter @unclutterdesk/ui typecheck`
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/layout/AppShell.tsx packages/ui/src/layout/AppShell.test.tsx packages/ui/src/index.ts
git commit -m "Add the shared AppShell, which picks the sidebar's mode from the screen width

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Practice shell in the app

**Files:**
- Create: `apps/app/src/components/shell/practiceNav.tsx`, `RouterLink.tsx`, `AccountMenu.tsx`, `PracticeBrand.tsx` and `PracticeShell.tsx`
- Delete: `apps/app/src/components/Sidebar.tsx`
- Modify: `apps/app/src/App.tsx` (imports at lines 5–7; state at lines 249–260; layout at about lines 404–512)
- Modify: `apps/app/src/pages/practice/DashboardPage.tsx`: remove `onOpenSidebar` and the menu button
- Modify: `apps/app/src/components/__tests__/plan-tags.test.ts` (import path) and `apps/app/src/utils/__tests__/route-integrity.test.ts` (menu scan)
- Test: `apps/app/src/components/shell/__tests__/practiceNav.test.ts`

**Interfaces:**
- Consumes: `AppShell`, `SidebarSection`, `SidebarMode`, `LinkLikeProps` and `useBrand` from `@unclutterdesk/ui`.
- Produces:
  - `export function planIncludes(plan: string | undefined, tier: string): boolean` (moved, unchanged)
  - `export function practiceSections(profile: NavProfile | null | undefined, plan: string | undefined): SidebarSection[]`
  - `export const PRACTICE_BOTTOM_NAV: { href: string; label: string; icon: LucideIcon }[]`
  - `export function activeNavKey(pathname: string, hrefs: string[]): string | undefined`
  - `export function PracticeShell(props: { plan?: string; banner?: ReactNode; children: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing tests**

`apps/app/src/components/shell/__tests__/practiceNav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { activeNavKey, practiceSections, planIncludes } from '../practiceNav';

const hrefsOf = (s: ReturnType<typeof practiceSections>) => s.flatMap((x) => x.groups.flatMap((g) => g.items.map((i) => i.href)));

describe('practiceSections', () => {
  it('gives owners the main menu and the full practice settings', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'OWNER' }, 'clinic'));
    expect(hrefs).toContain('/dashboard/hours');
    expect(hrefs).toContain('/dashboard/settings/team');
    expect(hrefs).toContain('/dashboard/settings/payouts');
  });

  it('hides the hours log from receptionists and gives them availability only', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'RECEPTIONIST', type: 'receptionist' }, 'clinic'));
    expect(hrefs).not.toContain('/dashboard/hours');
    expect(hrefs.filter((h) => h.startsWith('/dashboard/settings'))).toEqual(['/dashboard/settings/availability']);
  });

  it('tags features outside the plan, and only those', () => {
    const items = practiceSections({ role: 'OWNER' }, 'starter').flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(items.find((i) => i.href === '/dashboard/settings/team')?.badge).toBeTruthy();
    expect(items.find((i) => i.href === '/dashboard/settings/profile')?.badge).toBeFalsy();
    const clinic = practiceSections({ role: 'OWNER' }, 'clinic').flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(clinic.every((i) => !i.badge)).toBe(true);
  });

  it('keeps planIncludes as it was', () => {
    expect(planIncludes('pro', 'pro')).toBe(true);
    expect(planIncludes('starter', 'clinic')).toBe(false);
  });
});

describe('activeNavKey', () => {
  const hrefs = ['/dashboard', '/dashboard/clients', '/dashboard/settings/team', '/dashboard/settings/profile'];
  it('matches Overview only on its own path', () => {
    expect(activeNavKey('/dashboard', hrefs)).toBe('/dashboard');
    expect(activeNavKey('/', hrefs)).toBe('/dashboard');
    expect(activeNavKey('/dashboard/unknown', hrefs)).toBeUndefined();
  });
  it('highlights the parent of a nested page', () => {
    expect(activeNavKey('/dashboard/clients/53', hrefs)).toBe('/dashboard/clients');
    expect(activeNavKey('/dashboard/settings/team/', hrefs)).toBe('/dashboard/settings/team');
  });
  it('does not confuse a shared prefix', () => {
    expect(activeNavKey('/dashboard/clientsarchive', hrefs)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/components/shell`
Expected: FAIL, "Failed to resolve import '../practiceNav'".

- [ ] **Step 3: Implement the nav data**

`apps/app/src/components/shell/practiceNav.tsx`:

```tsx
import {
  Activity, BarChart3, Bell, Calendar, CalendarClock, ClipboardCheck, Clock, CreditCard, FileText,
  Home, IdCard, LayoutDashboard, Palette, Settings, Tag, Users, type LucideIcon,
} from 'lucide-react';
import type { SidebarSection } from '@unclutterdesk/ui';

export interface NavProfile {
  role?: string | null;
  type?: string | null;
}

interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  tier?: 'pro' | 'clinic';
  /** Only for roles that see clients clinically (owner, admin, therapist). */
  clinicalOnly?: boolean;
}

const MAIN: NavEntry[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/assessments', label: 'Assessments', icon: Activity },
  { href: '/dashboard/hours', label: 'Hours log', icon: Clock, clinicalOnly: true },
  { href: '/dashboard/submissions', label: 'Submissions', icon: ClipboardCheck },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

// Full settings for practice owners and admins.
const OWNER_GROUPS: { label: string; items: NavEntry[] }[] = [
  {
    label: 'Client-facing',
    items: [
      { href: '/dashboard/settings/profile', label: 'Practice profile', icon: IdCard },
      { href: '/dashboard/settings/brand', label: 'Brand & booking page', icon: Palette, tier: 'pro' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock },
      { href: '/dashboard/settings/services', label: 'Services & pricing', icon: Settings },
      { href: '/dashboard/settings/team', label: 'Team & staff', icon: Users, tier: 'clinic' },
      { href: '/dashboard/settings/subscription', label: 'Subscription', icon: CreditCard },
      { href: '/dashboard/settings/payouts', label: 'Payouts', icon: CreditCard },
      { href: '/dashboard/settings/forms', label: 'Forms', icon: FileText, tier: 'pro' },
      { href: '/dashboard/settings/discounts', label: 'Discounts & promos', icon: Tag, tier: 'pro' },
    ],
  },
];

// Therapists and receptionists manage their own availability only.
const OWN_AVAILABILITY: { label: string; items: NavEntry[] }[] = [
  { label: 'My settings', items: [{ href: '/dashboard/settings/availability', label: 'Availability', icon: CalendarClock }] },
];

/** The phone's bottom bar; everything else is under "More". */
export const PRACTICE_BOTTOM_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Today', icon: Home },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, clinic: 2 };

/** Whether a practice on `plan` has features tagged `tier`. */
export function planIncludes(plan: string | undefined, tier: string): boolean {
  return (PLAN_RANK[(plan || 'starter').toLowerCase()] ?? 0) >= (PLAN_RANK[tier.toLowerCase()] ?? 0);
}

const isRole = (p: NavProfile | null | undefined, role: string) =>
  [p?.role, p?.type].some((r) => String(r ?? '').toUpperCase() === role);

function settingsGroups(p: NavProfile | null | undefined) {
  if (isRole(p, 'OWNER') || isRole(p, 'ADMIN')) return OWNER_GROUPS;
  return OWN_AVAILABILITY;
}

function PlanTag({ tier }: { tier: 'pro' | 'clinic' }) {
  return (
    <span
      title={`Part of the ${tier === 'clinic' ? 'Clinic' : 'Pro'} plan`}
      className="h-[16px] px-1.5 rounded-[4px] text-[8.5px] font-extrabold flex items-center justify-center uppercase tracking-wider bg-[#1E293B] text-[#94A3B8] border border-white/5"
    >
      {tier}
    </span>
  );
}

/** The practice sidebar for this person: filtered by role, tagged by plan. */
export function practiceSections(profile: NavProfile | null | undefined, plan: string | undefined): SidebarSection[] {
  const receptionist = isRole(profile, 'RECEPTIONIST');
  const toItem = (e: NavEntry) => ({
    key: e.href,
    label: e.label,
    href: e.href,
    icon: <e.icon />,
    // Only for features outside the practice's plan, as an upgrade hint.
    badge: e.tier && !planIncludes(plan, e.tier) ? <PlanTag tier={e.tier} /> : undefined,
  });
  return [
    { key: 'main', groups: [{ key: 'main', items: MAIN.filter((e) => !e.clinicalOnly || !receptionist).map(toItem) }] },
    {
      key: 'practice',
      label: 'Practice',
      icon: <Settings className="h-3.5 w-3.5" />,
      collapsible: true,
      groups: settingsGroups(profile).map((g) => ({ key: g.label, label: g.label, items: g.items.map(toItem) })),
    },
  ];
}

/** The nav entry a path belongs to: Overview only on itself, otherwise the longest matching prefix. */
export function activeNavKey(pathname: string, hrefs: string[]): string | undefined {
  const path = pathname === '/' ? '/dashboard' : pathname.replace(/\/+$/, '') || '/';
  let best: string | undefined;
  for (const href of hrefs) {
    const match = href === '/dashboard' ? path === href : path === href || path.startsWith(`${href}/`);
    if (match && (!best || href.length > best.length)) best = href;
  }
  return best;
}
```

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/components/shell`
Expected: PASS.

- [ ] **Step 4: Move the account menu, brand and link out of the old sidebar**

`apps/app/src/components/shell/RouterLink.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { LinkLikeProps } from '@unclutterdesk/ui';

/** Shared navigation renders links through this, so moving between pages never reloads the app. */
export function RouterLink({ href, children, ...rest }: LinkLikeProps) {
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}
```

`apps/app/src/components/shell/PracticeBrand.tsx`:

```tsx
import { UnclutterLockup, useBrand, type SidebarMode } from '@unclutterdesk/ui';

export function PracticeBrand({ mode }: { mode: SidebarMode }) {
  const brand = useBrand();
  if (mode === 'rail') return <UnclutterLockup variant="dark" showText={false} markSize={30} />;
  if (brand.logoUrl) {
    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <img src={brand.logoUrl} alt={brand.name} className="h-7 w-7 rounded-[9px] object-cover border border-white/10" />
        <span className="font-semibold text-[16px] tracking-[-0.02em] text-[#F8FAFC] truncate">{brand.name}</span>
      </div>
    );
  }
  return <UnclutterLockup variant="dark" markSize={32} />;
}
```

`apps/app/src/components/shell/AccountMenu.tsx`. This is the old `Sidebar.tsx` footer (its lines 197–218, 245–262 and 375–458), taking a `mode` instead of `isCollapsed`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, IdCard, Loader2, LogOut, MessageSquarePlus, ShieldCheck, UserCog } from 'lucide-react';
import { useBrand, type SidebarMode } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';
import { AdminSwitchDialog } from '../AdminSwitchDialog';

const ACCOUNT_MENU_ITEMS = [
  { to: '/dashboard/profile', label: 'My profile', icon: IdCard },
  { to: '/dashboard/settings/account', label: 'Account & preferences', icon: UserCog },
  { to: '/dashboard/requests', label: 'Requests & feedback', icon: MessageSquarePlus },
];

const MENU_ITEM = 'w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13.5px] font-semibold text-[#CBD5E1] hover:text-white hover:bg-[#334155] cursor-pointer';

export function AccountMenu({ mode }: { mode: SidebarMode }) {
  const compact = mode === 'rail';
  const brand = useBrand();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [adminSwitchOpen, setAdminSwitchOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email : brand.name;
  const initials = displayName.split(' ').slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('');
  const roleLabel =
    profile?.type === 'admin' ? 'Administrator' : profile?.type === 'therapist' ? 'Therapist' : profile?.type === 'receptionist' ? 'Receptionist' : brand.name;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Account: ${displayName}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 rounded-[12px] cursor-pointer ${compact ? 'mx-auto' : 'w-full'}`}
      >
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-[10px] object-cover shrink-0 border border-white/10" />
        ) : (
          <div className="h-8 w-8 rounded-[10px] bg-[#1B5375] text-white flex items-center justify-center font-extrabold text-xs shrink-0 border border-white/10">
            {initials}
          </div>
        )}
        {compact ? null : (
          <>
            <div className="truncate text-left min-w-0">
              <p className="text-[12.5px] font-semibold text-[#E2E8F0] truncate leading-snug">{displayName}</p>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">{roleLabel}</p>
            </div>
            <ChevronDown className={`ml-auto h-4 w-4 text-[#64748B] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className={`absolute bottom-full mb-2 rounded-[14px] bg-[#1E293B] border border-white/10 shadow-2xl p-1.5 space-y-0.5 z-50 ${compact ? 'left-0 w-[220px]' : 'left-0 right-0'}`}
        >
          {ACCOUNT_MENU_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} role="menuitem" onClick={() => setOpen(false)} className={MENU_ITEM}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
          {profile?.platformAdmin ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setAdminSwitchOpen(true);
              }}
              className={MENU_ITEM}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Platform admin
            </button>
          ) : null}
          <div className="h-px bg-white/10 my-1.5" />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] text-[13px] font-semibold text-[#E11D48] hover:bg-[#E11D48]/10 disabled:opacity-50 cursor-pointer"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <LogOut className="h-4 w-4 shrink-0" />}
            Sign out
          </button>
        </div>
      ) : null}
      {adminSwitchOpen ? <AdminSwitchDialog onClose={() => setAdminSwitchOpen(false)} /> : null}
    </div>
  );
}
```

`apps/app/src/components/shell/PracticeShell.tsx`:

```tsx
import { useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';
import { PRACTICE_BOTTOM_NAV, activeNavKey, practiceSections } from './practiceNav';
import { RouterLink } from './RouterLink';
import { AccountMenu } from './AccountMenu';
import { PracticeBrand } from './PracticeBrand';

const COLLAPSED_KEY = 'unclutter_sidebar_collapsed';
const PRACTICE_OPEN_KEY = 'unclutter_sidebar_practice_open';

// Storage can be unavailable (private windows, blocked site data); the shell must still work.
function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeFlag(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference only */
  }
}

export function PracticeShell({ plan, banner, children }: { plan?: string; banner?: ReactNode; children: ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY) === '1');
  const [practiceOpen, setPracticeOpen] = useState(() => readFlag(PRACTICE_OPEN_KEY) !== '0');

  const sections = useMemo(() => practiceSections(profile as any, plan), [profile, plan]);
  const hrefs = useMemo(
    () => [...sections.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.href))), ...PRACTICE_BOTTOM_NAV.map((i) => i.href)],
    [sections],
  );
  const activeKey = activeNavKey(location.pathname, hrefs);

  return (
    <AppShell
      sidebar={{
        sections,
        activeKey,
        LinkComponent: RouterLink,
        brand: (mode) => <PracticeBrand mode={mode} />,
        account: (mode) => <AccountMenu mode={mode} />,
        openSections: { practice: practiceOpen },
        onSectionToggle: (key, open) => {
          if (key !== 'practice') return;
          setPracticeOpen(open);
          writeFlag(PRACTICE_OPEN_KEY, open ? '1' : '0');
        },
      }}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        writeFlag(COLLAPSED_KEY, next ? '1' : '0');
      }}
      bottomNav={{
        items: PRACTICE_BOTTOM_NAV.map((i) => ({ key: i.href, label: i.label, href: i.href, icon: <i.icon strokeWidth={2.5} /> })),
        active: activeKey,
        LinkComponent: RouterLink,
      }}
      banner={banner}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 5: Use `PracticeShell` in `App.tsx` and delete the old sidebar**

In `apps/app/src/App.tsx`:
1. Replace lines 5–7:

```tsx
import { Sidebar } from './components/Sidebar';
import { BrandProvider, BottomNav } from '@unclutterdesk/ui';
import { Home, Calendar, Users, Palette } from 'lucide-react';
```

with:

```tsx
import { BrandProvider } from '@unclutterdesk/ui';
import { PracticeShell } from './components/shell/PracticeShell';
```

Then run `grep -n "Home\|Palette\|<Calendar\|<Users" apps/app/src/App.tsx`. If any icon is still used elsewhere in the file, re-add just that one to a `lucide-react` import.

2. Delete the `isSidebarOpen` state line, the `isSidebarCollapsed` state (3 lines) and `handleToggleCollapse` (7 lines), shown here:

```tsx
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('unclutter_sidebar_collapsed') === '1'
  );
  
  const handleToggleCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('unclutter_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };
```

3. Replace the shell. It starts at `<div className="flex min-h-screen bg-[#F8FAFC]">` inside `<BrandProvider brand={practiceBrand}>` and ends at the closing `</div>` just before `</BrandProvider>`. The new version:

```tsx
    <BrandProvider brand={practiceBrand}>
      <PracticeShell
        plan={profile?.plan?.toLowerCase()}
        banner={
          privateDataError ? (
            <div role="alert" className="mx-4 mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 md:mx-[26px]">
              We could not load the latest workspace data. Refresh the page or try again shortly.
            </div>
          ) : null
        }
      >
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* …the existing <Route> list, unchanged… */}
          </Routes>
        </Suspense>
      </PracticeShell>
    </BrandProvider>
```

Move the existing `<Routes>…</Routes>` block across exactly as it is, with one change: remove the `onOpenSidebar={() => setIsSidebarOpen(true)}` prop from `<DashboardPage … />`. Delete the old "Mobile Bottom Navigation" block (`<div className="md:hidden fixed bottom-0 …"><BottomNav … /></div>`); the shell renders the bar now.

4. `git rm apps/app/src/components/Sidebar.tsx`

In `apps/app/src/pages/practice/DashboardPage.tsx`:
- remove `onOpenSidebar?: () => void;` from the props interface;
- remove the `<button onClick={props.onOpenSidebar} …><Menu className="h-6 w-6" /></button>` element. Task 10 rewrites that header anyway; this step only keeps the build green;
- remove `Menu` from the `lucide-react` import.

- [ ] **Step 6: Point the two existing tests at the new files**

`apps/app/src/components/__tests__/plan-tags.test.ts`: change its import of `planIncludes` from `'../Sidebar'` to `'../shell/practiceNav'`.

`apps/app/src/utils/__tests__/route-integrity.test.ts`:
- change the component scan regex from `/\b(?:to|key):\s*'(\/[^']*)'/g` to `/\b(?:to|key|href):\s*'(\/[^']*)'/g`;
- change the "sidebar was found" check to:

```ts
  test('the sidebar was found', () => {
    expect(menuLinks.some((l) => l.file.endsWith('practiceNav.tsx'))).toBe(true);
  });
```

- [ ] **Step 7: Run everything**

Run: `pnpm --recursive run typecheck && pnpm --filter @unclutterdesk/ui test && pnpm --filter @unclutterdesk/app test`
Expected: all pass. `route-integrity` confirms every `href` in `practiceNav.tsx` is a declared route.

- [ ] **Step 8: Check it in a browser**

1. Start the API and app as in Task 0.
2. Log in as `dr.jane@smiththerapy.ng`.
3. At 1440px: the full sidebar, with Collapse working and remembered after a reload.
4. At 1024px: the rail, with tooltips on hover; Expand opens the overlay; Esc closes it.
5. At 390px: the bottom bar shows Today, Schedule, Clients, Notifications and More. More opens the menu, including the account menu. Choosing a page closes it, and the app does not reload: the network tab shows no document request.

- [ ] **Step 9: Commit**

```bash
git add -A apps/app/src/components apps/app/src/App.tsx apps/app/src/pages/practice/DashboardPage.tsx apps/app/src/utils/__tests__/route-integrity.test.ts
git commit -m "Move the practice workspace onto the shared shell: rail on tablets, More drawer on phones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Client page on `Page`, `PageHeader`, `Grid` and `StatTile`

**Files:**
- Modify: `apps/app/src/pages/practice/ClientDetailPage.tsx`

**Interfaces:**
- Consumes: `Page`, `PageHeader`, `Grid` and `StatTile` (Tasks 2–3).

- [ ] **Step 1: Swap the wrapper and header**

1. Update the imports:
   - change the `@unclutterdesk/ui` import on line 4 to
     `import { Eyebrow, Card, StatusBadge, Button, useToast, Page, PageHeader, Grid, StatTile } from '@unclutterdesk/ui';`;
   - keep `Link` and `ChevronRight`, which the breadcrumb still uses.
2. Replace everything from `<div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">` down to and including `<main className="p-[24px_26px_30px] space-y-6 flex-1">` with:

```tsx
    <Page
      header={
        <PageHeader
          breadcrumb={
            <>
              <Link to="/dashboard/clients" className="font-semibold text-[#64748B] hover:text-[#0F172A]">
                Clients
              </Link>
              <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
            </>
          }
          title={client.name}
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowBooking(true)}
                className="h-[38px] px-3.5 rounded-[12px] bg-[#0F3A53] text-white text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <CalendarPlus className="h-4 w-4" /> Book a session
              </button>
              <button
                onClick={() => {
                  setNoteTitle(`Individual Therapy Session #${client.notes.length + 1}`);
                  setShowNewNoteModal(true);
                }}
                className="h-[40px] px-4 rounded-[14px] bg-[#EEF2F7] text-[#0F172A] text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New note</span>
              </button>
            </>
          }
          secondaryActions={
            <button
              onClick={handlePrintPDF}
              className="h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export file</span>
            </button>
          }
        />
      }
    >
```

If the booking work named the dialog state differently from `setShowBooking`, keep whatever name the file uses. Copy the existing "Book a session" button exactly.

3. Replace the closing `</main>` (just before `{showNewNoteModal && (`) with nothing. Replace the final `</div>` before `);` (after the `{showBooking && (…)}` block) with `</Page>`. The modals stay inside `Page`; they are `fixed` overlays.

- [ ] **Step 2: Stack the profile card and use the shared tiles**

1. The profile card's top row `<div className="flex items-start justify-between">` becomes `<div className="flex flex-wrap items-start justify-between gap-4">`.
2. The line `<div className="flex items-center gap-5">` becomes `<div className="flex items-center gap-4 md:gap-5 min-w-0">`.
3. The details column `<div className="space-y-1">` next to the avatar becomes `<div className="space-y-1 min-w-0">`.
4. The email line `<p className="text-[13px] text-[#64748B] font-medium">` becomes `<p className="text-[13px] text-[#64748B] font-medium truncate">`.

Replace the "4 Stat Tiles Grid" block, from `<div className="grid grid-cols-4 gap-3.5">` to its closing `</div>`, with:

```tsx
          <Grid cols={{ base: 1, sm: 2, lg: 4 }} gap="md">
            <StatTile variant="inset" label="TOTAL SESSIONS" value={client.sessions} />
            <StatTile variant="inset" size="sm" label="CLIENT SINCE" value={client.since} />
            <StatTile variant="inset" size="sm" label="NEXT SESSION" value={client.next} valueColor={primaryColor} />
            <EmergencyContactCard
              clientId={client.id}
              contact={client.emergencyContact ?? null}
              onSaved={(c) => setClient((prev) => ({ ...prev, emergencyContact: c }))}
            />
          </Grid>
```

- [ ] **Step 3: Keep the tabs on screen**

Change the tab bar's class from `h-[40px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex gap-1 border border-[#E2E8F0] print:hidden` to:

```
h-[40px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex max-w-full overflow-x-auto gap-1 border border-[#E2E8F0] print:hidden
```

and add `shrink-0 whitespace-nowrap` to each tab button's class. On a phone the four tabs scroll inside their own bar instead of widening the page. A shared `Tabs` component is not part of this PR.

- [ ] **Step 4: Give the two-column areas a narrow fallback**

1. The SOAP notes layout `<div className="grid grid-cols-[1fr_300px] gap-5 items-start">` becomes:

```tsx
            <div className="grid grid-cols-1 @min-[960px]/page:grid-cols-[1fr_300px] gap-5 items-start">
```

2. The intake answers `<div className="grid grid-cols-2 gap-3.5">` becomes `<Grid cols={{ base: 1, md: 2 }}>`, with its closing `</div>` becoming `</Grid>`.
3. Do the same for the two `grid grid-cols-2 gap-3.5` blocks inside the new-note modal.
4. The session timeline row `grid grid-cols-[96px_24px_1fr]` stays: its fixed columns total 120px, which fits a 360px phone.

- [ ] **Step 5: Typecheck and test**

Run: `pnpm --filter @unclutterdesk/app typecheck && pnpm --filter @unclutterdesk/app test`
Expected: PASS.

- [ ] **Step 6: Check in the browser, then commit**

Open `/dashboard/clients/53` (or any client) at 390, 820, 1024 and 1280px.

Expected:
- no sideways scroll at any width;
- tiles 1 across on the phone, 2 at 820px and 1024px (with the rail), and 4 at 1280px;
- "Export file" inline from tablet width up, and under "⋯" on the phone.

```bash
git add apps/app/src/pages/practice/ClientDetailPage.tsx
git commit -m "Let the client page fit every screen instead of forcing 1192px

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Analytics on `Page`, `PageHeader`, `Grid` and `StatTile`

**Files:**
- Modify: `apps/app/src/pages/practice/AnalyticsPage.tsx`
- Test: `apps/app/src/pages/__tests__/AnalyticsPage.test.tsx` (append)

**Interfaces:**
- Consumes: `Page`, `PageHeader`, `Grid` and `StatTile`.

- [ ] **Step 1: Write the failing test** (append inside the file's top-level `describe`, using its existing render helper; if the helper has another name, use that)

```tsx
  it('fits the page it is given instead of forcing a width', () => {
    const { container } = renderPage();
    expect(container.innerHTML).not.toContain('min-w-[1192px]');
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeTruthy();
    expect(container.querySelector('[class*="@container/page"]')).toBeTruthy();
  });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/pages/__tests__/AnalyticsPage.test.tsx`
Expected: FAIL, the markup contains `min-w-[1192px]`.

- [ ] **Step 3: Implement**

1. Change the imports:
   - `import { Eyebrow, Card, SegmentedControl, Page, PageHeader, Grid, StatTile } from '@unclutterdesk/ui';`
   - `import { Download, TrendingUp } from 'lucide-react';` stays.
2. Replace everything from `<div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">` to `<main className="p-[24px_26px_30px] space-y-5 flex-1">` with:

```tsx
    <Page
      header={
        <PageHeader
          eyebrow="PRACTICE ANALYTICS"
          title="Analytics"
          actions={
            <SegmentedControl
              options={['30 days', '90 days', '12 months']}
              value={RANGES[range].label}
              onChange={(next: string) => {
                const found = (Object.keys(RANGES) as RangeKey[]).find((key) => RANGES[key].label === next);
                if (found) setRange(found);
              }}
            />
          }
          secondaryActions={
            <button
              type="button"
              onClick={downloadReport}
              className="h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download report</span>
            </button>
          }
        />
      }
    >
```

3. Replace the KPI grid, from `<div className="grid grid-cols-4 gap-3.5">` to its closing `</div>`, with:

```tsx
        <Grid cols={{ base: 1, sm: 2, lg: 4 }}>
          {kpis.map((kpi) => (
            <StatTile
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              size="lg"
              delta={
                <>
                  <TrendingUp className="h-3 w-3" />
                  <span>{kpi.delta}</span>
                </>
              }
            />
          ))}
        </Grid>
```

4. In the "Sessions by month" card header, change `<div className="flex items-center justify-between mb-6">` to `<div className="flex flex-wrap items-center justify-between gap-2 mb-6">`.
5. Change the bar chart row `h-[220px] flex items-end gap-3.5 pt-4` to `h-[220px] flex items-end gap-1.5 md:gap-3.5 pt-4`, so twelve bars fit on a phone.
6. Replace `<div className="grid grid-cols-2 gap-5">` with `<Grid cols={{ base: 1, lg: 2 }} gap="lg">`, and its closing `</div>` with `</Grid>`.
7. Replace the closing `</main>` and `</div>` at the end with `</Page>`.

The existing tests click "Download report" with `getByText`. While the "⋯" menu is closed, only the inline copy is in the DOM (jsdom ignores the container query that hides it on narrow pages), so `getByText` still finds exactly one.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/pages/__tests__/AnalyticsPage.test.tsx`
Expected: PASS, the new test and all the existing ones.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/practice/AnalyticsPage.tsx apps/app/src/pages/__tests__/AnalyticsPage.test.tsx
git commit -m "Let Analytics fit every screen, with the shared page, header and tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Overview on `Page`, `PageHeader`, `Grid` and `MetricTile`

**Files:**
- Modify: `apps/app/src/pages/practice/DashboardPage.tsx`

**Interfaces:**
- Consumes: `Page`, `PageHeader`, `Grid` and `MetricTile`.

- [ ] **Step 1: Swap the wrapper and header**

1. Change the imports: `import { Button, Page, PageHeader, Grid, MetricTile } from '@unclutterdesk/ui';`.
2. Replace everything from `<div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">` through `<main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-[1fr_372px] gap-4 md:gap-[20px] items-start">` with:

```tsx
    <Page
      header={
        <PageHeader
          eyebrow="PRACTICE OVERVIEW"
          title={`Good morning${profileName ? `, ${profileName}` : ''}`}
          actions={
            <>
              <button
                onClick={handleCopyLink}
                className="os-brand-btn h-[40px] md:h-[44px] px-3 md:px-5 rounded-[12px] md:rounded-[14px] font-bold text-[13px] md:text-[14px] flex items-center gap-2 whitespace-nowrap text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Link copied' : 'Copy booking link'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/notifications')}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                className="relative h-[40px] w-[40px] md:h-[44px] md:w-[44px] bg-white border border-[#E2E8F0] rounded-[12px] md:rounded-[14px] flex items-center justify-center hover:bg-[#F8FAFC] cursor-pointer"
              >
                <Bell className="h-4 w-4 md:h-5 md:w-5 text-[#475569]" />
                {unreadCount > 0 ? <span className="absolute top-[8px] right-[8px] md:top-[9px] md:right-[9px] h-[6px] w-[6px] md:h-[7px] md:w-[7px] rounded-full bg-[#E11D48] ring-[1.5px] ring-white" /> : null}
              </button>
            </>
          }
          secondaryActions={
            <div className="flex h-[44px] min-w-0 bg-[#F1F5F9] border border-[#E2E8F0] rounded-[14px] px-3.5 items-center gap-2.5">
              <Link2 className="h-4 w-4 text-[#64748B] shrink-0" />
              <input
                type="text"
                readOnly
                aria-label="Booking link"
                value={bookingUrl}
                className="w-[238px] max-w-full min-w-0 bg-transparent text-[13px] font-medium text-[#334155] select-all outline-none"
              />
            </div>
          }
        />
      }
    >
      <div className="grid grid-cols-1 @min-[1200px]/page:grid-cols-[1fr_372px] gap-4 md:gap-5 items-start">
```

Notes on this header:
- The booking-link field was hidden below 768px by `hidden md:flex`. Now it is a secondary action: inline when the page is wide enough, and in the "⋯" menu when it isn't. That fixes it being cut off at tablet width.
- The copy button already copies the link at every width.
- The `min-w-0` wrapper keeps the header from pushing the page wider.

3. At the end of the component, replace `</main>` followed by `</div>` with `</div>` then `</Page>`. The new inner `<div className="grid …">` closes where `</main>` used to.

- [ ] **Step 2: Let the revenue card stack**

1. Change the revenue header row `<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">` to `<div className="flex flex-col @min-[960px]/page:flex-row @min-[960px]/page:items-start justify-between gap-4 mb-6">`.
2. Change the figure row `<div className="flex items-baseline gap-3">` to `<div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">`.
3. Replace the "Wrapped Stat Tiles" block, from `<div className="flex sm:justify-end gap-2 md:gap-3.5 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">` to its closing `</div>`, with:

```tsx
              <Grid cols={{ base: 3 }} gap="sm" className="w-full @min-[960px]/page:w-auto @min-[960px]/page:min-w-[320px]">
                <MetricTile value={totalSessions} label="Scheduled" />
                <MetricTile value={totalClients} label="Total clients" />
                <MetricTile value={activeClients} label="Active roster" />
              </Grid>
```

4. The session rows further down carry `min-w-[400px] sm:min-w-0`. Change it to plain `min-w-0`. The row already stacks with `flex-col sm:flex-row`, so it no longer needs a minimum on phones.

- [ ] **Step 3: Typecheck, test, and check in a browser**

Run: `pnpm --filter @unclutterdesk/app typecheck && pnpm --filter @unclutterdesk/app test`
Expected: PASS.

Open `/dashboard` at 390, 820, 1024 and 1280px.

Expected:
- no sideways scroll;
- the revenue figure never overlaps the three tiles;
- the tiles sit under the figure below 960px of content, and beside it above;
- the right-hand column moves under the main column below 1200px of content.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/pages/practice/DashboardPage.tsx
git commit -m "Let Overview fit tablets and phones: stacked revenue tiles, header that wraps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Layout rule check

**Files:**
- Create: `apps/app/src/test/layout-rules.test.ts`

**Interfaces:**
- Produces: `MIGRATED`, the list of page files held to the rules. PRs 2–5 extend it until it covers everything.

- [ ] **Step 1: Write the test**

`apps/app/src/test/layout-rules.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The layout rules from the responsive spec. Pages fill the space the shell
 * gives them; they do not set their own width, and they lay out columns through
 * Grid so there is always a narrow fallback.
 *
 * Pages listed in MIGRATED must follow the rules now. Every other page is
 * reported (not failed) until its PR moves it onto the shared components.
 */
const SRC = resolve(__dirname, '..');
const PAGES = join(SRC, 'pages');

const MIGRATED = [
  'pages/practice/ClientDetailPage.tsx',
  'pages/practice/AnalyticsPage.tsx',
  'pages/practice/DashboardPage.tsx',
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/** Every rule a file breaks, as "rule: evidence". */
export function violations(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/(?<![\w:-])(min|max)-w-\[(\d{3,4})px\]/g)) {
    // Page wrappers were all 1040px+; inner reading widths such as a 720px note card are fine.
    if (Number(m[2]) >= 900) found.push(`sets its own width: ${m[0]}`);
  }
  for (const m of source.matchAll(/(?<![\w:-])max-w-(?:[4-7]xl|screen-\w+)/g)) found.push(`sets its own width: ${m[0]}`);
  for (const m of source.matchAll(/(?<![\w:/\]-])grid-cols-([2-9]|1[0-2])(?![\w-])/g)) found.push(`bare multi-column grid: ${m[0]}`);
  for (const m of source.matchAll(/(?<![\w:/\]-])grid-cols-\[([^\]]+)\]/g)) {
    const widest = Math.max(0, ...m[1].split('_').map((t) => Number(/^(\d+)px$/.exec(t)?.[1] ?? 0)));
    if (widest >= 200) found.push(`fixed-width column with no narrow fallback: ${m[0]}`);
  }
  for (const m of source.matchAll(/<(table|aside)\b/g)) found.push(`builds its own ${m[1]}`);
  return found;
}

describe('layout rules', () => {
  it('recognises what it should', () => {
    expect(violations('<div className="flex-1 min-w-[1192px]">')).toEqual(['sets its own width: min-w-[1192px]']);
    expect(violations('<div className="max-w-[1200px] mx-auto">')).toHaveLength(1);
    expect(violations('<div className="max-w-[720px]">')).toEqual([]);
    expect(violations('<div className="grid grid-cols-4 gap-3">')).toEqual(['bare multi-column grid: grid-cols-4']);
    expect(violations('<div className="grid grid-cols-1 lg:grid-cols-4">')).toEqual([]);
    expect(violations('<div className="grid grid-cols-1 @min-[960px]/page:grid-cols-[1fr_300px]">')).toEqual([]);
    expect(violations('<div className="grid grid-cols-[1fr_300px]">')).toHaveLength(1);
    expect(violations('<div className="grid grid-cols-[96px_24px_1fr]">')).toEqual([]);
    expect(violations('<table>')).toEqual(['builds its own table']);
  });

  const all = files(PAGES).map((path) => ({ file: relative(SRC, path), problems: violations(readFileSync(path, 'utf8')) }));

  it.each(MIGRATED)('%s follows the layout rules', (file) => {
    const entry = all.find((e) => e.file === file);
    expect(entry, `${file} not found`).toBeTruthy();
    expect(entry!.problems).toEqual([]);
  });

  it('reports the pages not yet moved over', () => {
    const pending = all.filter((e) => !MIGRATED.includes(e.file) && e.problems.length > 0);
    if (pending.length) {
      console.info(`Layout rules: ${pending.length} page(s) still to migrate:\n${pending.map((e) => `  ${e.file}: ${e.problems.length}`).join('\n')}`);
    }
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/test/layout-rules.test.ts`

Expected:
- PASS for the "recognises" cases and the three migrated pages;
- the report lists the other pages, such as `SubmissionsPage.tsx` and the settings pages.

If a migrated page fails, the message names the class. Fix it in the page, following Tasks 8–10, not in the rule.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/test/layout-rules.test.ts
git commit -m "Add the layout rule check: migrated pages may not set their own width

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Layout check across widths

**Files:**
- Create: `apps/app/scripts/check-layout.mjs`
- Modify: `apps/app/package.json` (script and dev dependency)

**Interfaces:**
- Produces: `pnpm --filter @unclutterdesk/app check:layout`, which exits 1 when a strict route overflows at any width.

- [ ] **Step 1: Add the dependency and script**

Run: `pnpm --filter @unclutterdesk/app add -D playwright-core@1.63.0`

In `apps/app/package.json` `"scripts"`, add:

```json
    "check:layout": "node scripts/check-layout.mjs"
```

- [ ] **Step 2: Write the script**

`apps/app/scripts/check-layout.mjs`:

```js
// Loads practice routes at phone, tablet, laptop and desktop widths and fails
// when a page scrolls sideways or the sidebar is the wrong kind for the width.
// Needs the API and app running locally with seed data:
//   API: cd apps/api && PORT=3099 node dist/src/main.js
//   App: cd apps/app && VITE_API_URL=http://localhost:3099 npx vite --port 5173 --strictPort
// Browser: set CHROME_PATH, or run `npx playwright install chromium` once.
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL ?? 'http://localhost:5173';
const EMAIL = process.env.LAYOUT_EMAIL ?? 'dr.jane@smiththerapy.ng';
const PASSWORD = process.env.LAYOUT_PASSWORD ?? 'password123';
const WIDTHS = [390, 820, 1024, 1280];

// Routes that must pass. PRs 2–5 move routes from REPORT to STRICT.
const STRICT = ['/dashboard', '/dashboard/analytics', 'CLIENT'];
const REPORT = [
  '/dashboard/clients', '/dashboard/schedule', '/dashboard/hours', '/dashboard/submissions',
  '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings/account',
  '/dashboard/settings/availability', '/dashboard/settings/team', '/dashboard/settings/discounts',
];

const expectedSidebar = (w) => (w < 768 ? 'none' : w < 1280 ? 'rail' : 'full');

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard/, { timeout: 20000 });

// "CLIENT" stands for the first client's page, whatever its id.
await page.goto(`${BASE}/dashboard/clients`);
await page.waitForTimeout(1500);
const clientHref = await page.locator('a[href^="/dashboard/clients/"]').first().getAttribute('href').catch(() => null);
const resolve = (r) => (r === 'CLIENT' ? clientHref : r);

let failures = 0;
for (const [routes, strict] of [[STRICT, true], [REPORT, false]]) {
  for (const raw of routes) {
    const route = resolve(raw);
    if (!route) {
      console.log(`skip ${raw}: no client to open`);
      continue;
    }
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(BASE + route);
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const doc = document.documentElement;
        const aside = document.querySelector('aside:not([role="dialog"])');
        const width = aside ? Math.round(aside.getBoundingClientRect().width) : 0;
        const wide = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed';
          })
          .slice(-3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`);
        return { overflow: doc.scrollWidth - doc.clientWidth, sidebar: !aside ? 'none' : width <= 80 ? 'rail' : 'full', wide };
      });
      const problems = [];
      if (r.overflow > 0) problems.push(`scrolls sideways by ${r.overflow}px (${r.wide.join(', ')})`);
      if (r.sidebar !== expectedSidebar(w)) problems.push(`sidebar is ${r.sidebar}, expected ${expectedSidebar(w)}`);
      const label = `${strict ? 'STRICT' : 'report'} ${w}px ${route}`;
      if (problems.length) {
        console.log(`${strict ? '✗' : '·'} ${label}: ${problems.join('; ')}`);
        if (strict) failures++;
      } else {
        console.log(`✓ ${label}`);
      }
    }
  }
}
await browser.close();
if (failures) {
  console.error(`\n${failures} strict check(s) failed.`);
  process.exit(1);
}
console.log('\nAll strict routes fit at every width.');
```

- [ ] **Step 3: Run it**

1. Start the API and app (Task 0, step 3).
2. Run: `pnpm --filter @unclutterdesk/app check:layout`.
   Use `CHROME_PATH` if Playwright's browser is not installed, for example the Chrome for Testing binary under `~/Library/Caches/ms-playwright/`.

Expected:
- every STRICT line shows ✓;
- REPORT lines may show `·` (those are the pages for PRs 2–5);
- exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/app/scripts/check-layout.mjs apps/app/package.json pnpm-lock.yaml
git commit -m "Add a layout check that loads pages at four widths and fails on sideways scrolling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verify and open PR 1

- [ ] **Step 1: Run the full suites**

Run: `pnpm --recursive run typecheck && pnpm --filter @unclutterdesk/api test && pnpm --filter @unclutterdesk/ui test && pnpm --filter @unclutterdesk/app test && pnpm --filter @unclutterdesk/app build`
Expected: all pass, and the build succeeds.

- [ ] **Step 2: Confirm Tailwind generated the container queries**

Run: `grep -o "@container page (width >= 480px)" apps/app/dist/assets/*.css | head -1; grep -c "@container" apps/app/dist/assets/*.css`

Expected: a match, and a non-zero count.

If there is no match, the `@source` line from Task 1 is not being picked up. Check its relative path from `apps/app/src/index.css` to `packages/ui/src`. Don't carry on until the classes are in the CSS.

- [ ] **Step 3: Layout check and desktop comparison**

1. Run `pnpm --filter @unclutterdesk/app check:layout`. Expected: exit 0.
2. Take 1280×900 screenshots of the same three pages as Task 0 and compare them with `before-*.png`.

Expected differences, and no others:
- the pages no longer overflow;
- the client page header uses the shared header: a larger title, and "Export file" is still inline;
- the Overview booking-link field sits in the header's secondary actions.

- [ ] **Step 4: Push and open the PR**

```bash
git push origin dev
gh pr create --base main --head dev --title "Responsive layout, part 1: shared shell, icon rail and the three worst pages" --body "$(cat <<'EOF'
## What
- **Shared shell:** the practice workspace now runs on shared components in `packages/ui`. The sidebar is full on desktop, becomes a 76px icon rail on tablets (768–1279px) that expands over the page, and on phones sits behind **More** in the bottom bar.
- **Phone bottom bar:** Today, Schedule, Clients, Notifications, More. Every page, and the account menu, can now be reached on a phone, and moving between pages no longer reloads the app.
- **Shared layout pieces:** `Page` (the only place width is set), `PageHeader` (actions wrap; secondary actions fold into a "⋯" menu on narrow pages), `Grid` (columns follow the page's own width) and `StatTile`/`MetricTile`.
- **Pages fixed:** the client page and Analytics no longer force 1192px, and Overview no longer overlaps or cuts off at tablet width.

## Checks
- New package tests (Vitest), now run in CI.
- A layout rule test: migrated pages may not set their own width or use a bare multi-column grid. Other pages are reported until PRs 2–5.
- `pnpm --filter @unclutterdesk/app check:layout`: loads pages at 390, 820, 1024 and 1280px and fails on sideways scroll. Passed locally for the migrated pages.
- Desktop at 1280px compared before and after: only overflow and header changes.

Spec: `docs/superpowers/specs/2026-09-28-responsive-layout-shared-components-design.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
