# Live SOAP Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship reliable live SOAP note autosave in the telehealth workflow, with clear save-state feedback and safe handling for note creation, updates, failures, and locked notes.

**Architecture:** Keep the existing notes API as the source of truth and add debounced autosave behavior in the telehealth room page. Introduce the smallest possible shared autosave state model in the UI, avoid changing note semantics on the backend unless required, and add just enough test infrastructure to verify autosave logic without pretending the repo already has it.

**Tech Stack:** React 18, Vite, TypeScript, NestJS, Prisma, existing `apiClient`, minimal Vitest setup for frontend unit coverage.

---

## File Structure

### Existing files to modify

1. `apps/app/package.json`
   - Add minimal test dependencies and scripts for frontend unit tests.
2. `apps/app/src/pages/TelehealthVideoRoomPage.tsx`
   - Add debounced autosave behavior, save-state UI, and lock-aware behavior.
3. `apps/api/src/modules/notes/notes.service.ts`
   - Tighten note update behavior only if autosave exposes gaps around repeated save calls.
4. `apps/api/src/modules/notes/notes.controller.ts`
   - Only modify if request/response shape needs small support for autosave metadata.

### New files to create

1. `apps/app/vitest.config.ts`
   - Minimal Vitest config for app-level unit tests.
2. `apps/app/src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx`
   - Tests for autosave timing, UI state changes, and lock behavior.
3. `apps/app/src/test/setup.ts`
   - Shared test bootstrap for jsdom environment if needed.

### Optional extraction if `TelehealthVideoRoomPage.tsx` becomes unwieldy

1. `apps/app/src/pages/telehealth/useSoapAutosave.ts`
   - Extract autosave state and debounce behavior into a focused hook.

Do not create this extraction unless the page becomes hard to reason about during implementation.

---

## Task 1: Add Minimal Frontend Test Harness

**Files:**
- Modify: `apps/app/package.json`
- Create: `apps/app/vitest.config.ts`
- Create: `apps/app/src/test/setup.ts`

- [ ] **Step 1: Write the failing test command expectation into the plan context**

Target command after setup:

```bash
pnpm --filter @unclutterdesk/app exec vitest run
```

Expected before setup:

```text
Command fails because Vitest is not installed or configured.
```

- [ ] **Step 2: Run the command to verify the test runner is missing**

Run:

```bash
pnpm --filter @unclutterdesk/app exec vitest run
```

Expected:

```text
FAIL because `vitest` is not found or not configured.
```

- [ ] **Step 3: Add minimal test dependencies and scripts**

Update `apps/app/package.json` to include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "deploy": "wrangler pages deploy dist --project-name=unclutter-desk",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@rollup/rollup-darwin-arm64": "^4.62.4",
    "@tailwindcss/postcss": "^4.3.3",
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.5.4",
    "jsdom": "^26.1.0",
    "postcss": "^8.5.26",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 4: Add minimal Vitest config**

Create `apps/app/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 5: Add minimal shared test setup**

Create `apps/app/src/test/setup.ts`:

```ts
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
```

- [ ] **Step 6: Run the test command to verify the harness loads**

Run:

```bash
pnpm --filter @unclutterdesk/app test
```

Expected:

```text
PASS with zero or no discovered tests, but the Vitest runner starts successfully.
```

- [ ] **Step 7: Commit**

```bash
git add apps/app/package.json apps/app/vitest.config.ts apps/app/src/test/setup.ts
git commit -m "test: add app vitest harness"
```

---

## Task 2: Write Failing Autosave Tests

**Files:**
- Create: `apps/app/src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx`

- [ ] **Step 1: Write a failing test for debounced autosave**

Create `apps/app/src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx` with this initial test set:

```tsx
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TelehealthVideoRoomPage } from '../TelehealthVideoRoomPage';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

describe('TelehealthVideoRoomPage autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockResolvedValue({
      booking: {
        id: '42',
        clientProfileId: '7',
        clientName: 'Ada Okafor',
        clientEmail: 'ada@example.com',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
        serviceTitle: 'Therapy Session',
        status: 'CONFIRMED',
        videoRoomLink: 'https://meet.jit.si/test-room',
      },
      latestNote: null,
      submissions: [],
    });
    postMock.mockResolvedValue({ id: 'note-1', isLocked: false });
    patchMock.mockResolvedValue({ id: 'note-1', isLocked: true });
  });

  test('autosaves after note input settles', async () => {
    render(
      <MemoryRouter initialEntries={['/session/42']}>
        <Routes>
          <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('SOAP Notes');

    const subjectiveField = screen.getByDisplayValue('');
    fireEvent.change(subjectiveField, { target: { value: 'Client reports improved sleep.' } });

    vi.advanceTimersByTime(2500);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    });
  });

  test('does not autosave when note is locked', async () => {
    getMock.mockResolvedValueOnce({
      booking: {
        id: '42',
        clientProfileId: '7',
        clientName: 'Ada Okafor',
        clientEmail: 'ada@example.com',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
        serviceTitle: 'Therapy Session',
        status: 'CONFIRMED',
        videoRoomLink: 'https://meet.jit.si/test-room',
      },
      latestNote: {
        id: 'note-1',
        subjective: 'Existing',
        objective: '',
        assessment: '',
        plan: '',
        isLocked: true,
        createdAt: new Date().toISOString(),
      },
      submissions: [],
    });

    render(
      <MemoryRouter initialEntries={['/session/42']}>
        <Routes>
          <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('SOAP Notes');

    vi.advanceTimersByTime(2500);

    expect(postMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the autosave tests to verify they fail for the correct reason**

Run:

```bash
pnpm --filter @unclutterdesk/app exec vitest run "src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx"
```

Expected:

```text
FAIL because autosave does not exist yet, not because the file cannot load.
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx
git commit -m "test: add failing soap autosave tests"
```

---

## Task 3: Implement Debounced Autosave in the Telehealth Page

**Files:**
- Modify: `apps/app/src/pages/TelehealthVideoRoomPage.tsx`

- [ ] **Step 1: Add autosave state to the component**

Inside `TelehealthVideoRoomPage`, add:

```tsx
const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
```

- [ ] **Step 2: Update manual save to return the saved note and state**

Change `saveNote()` so it becomes:

```tsx
async function saveNote() {
  if (!payload || noteLocked) return null;
  setSaveState('saving');
  try {
    const saved = await api.post<{ id: string; isLocked: boolean; subjective?: string; objective?: string; assessment?: string; plan?: string }>('/v1/notes', {
      bookingId: payload.booking.id,
      clientProfileId: payload.booking.clientProfileId,
      subjective,
      objective,
      assessment,
      plan,
    });
    setNoteId(saved.id);
    setNoteLocked(saved.isLocked);
    setLastSavedAt(new Date().toISOString());
    setSaveState('saved');
    return saved;
  } catch (error) {
    setSaveState('error');
    throw error;
  }
}
```

- [ ] **Step 3: Mark note content as dirty when editable fields change**

Add one effect:

```tsx
useEffect(() => {
  if (!payload || noteLocked) return;
  setSaveState((current) => (current === 'idle' || current === 'saved' ? 'dirty' : current));
}, [subjective, objective, assessment, plan, payload, noteLocked]);
```

Then immediately guard against first-load false dirtiness by also adding:

```tsx
useEffect(() => {
  if (!payload) return;
  setSaveState('idle');
}, [payload?.booking.id]);
```

If this causes false dirty transitions after load, replace the above with a `hydrated` ref and only mark dirty after the initial payload is set.

- [ ] **Step 4: Add debounced autosave effect**

Add:

```tsx
useEffect(() => {
  if (!payload || noteLocked || saveState !== 'dirty') return;

  const timeout = window.setTimeout(() => {
    void saveNote().catch(() => {
      // saveNote already moves state to error
    });
  }, 2500);

  return () => window.clearTimeout(timeout);
}, [payload, noteLocked, saveState, subjective, objective, assessment, plan]);
```

- [ ] **Step 5: Keep lock behavior explicit and safe**

Update `lockNote()` to ensure the latest content is saved before patching lock state:

```tsx
async function lockNote() {
  const saved = await saveNote();
  const targetNoteId = saved?.id || noteId;
  if (targetNoteId) {
    await api.patch(`/v1/notes/${targetNoteId}/lock`, {});
    setNoteLocked(true);
    setSaveState('saved');
  }
}
```

- [ ] **Step 6: Add save-state UI in the notes drawer**

Inside the SOAP notes drawer header area, add a lightweight status label:

```tsx
<div className="flex items-center gap-2 text-[11px] font-bold">
  {saveState === 'saving' ? <span className="text-[#B45309]">Saving...</span> : null}
  {saveState === 'saved' ? <span className="text-[#15803D]">Saved{lastSavedAt ? ` · ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(lastSavedAt))}` : ''}</span> : null}
  {saveState === 'error' ? <span className="text-[#DC2626]">Autosave failed</span> : null}
  {noteLocked ? <span className="text-[#475569]">Locked</span> : null}
</div>
```

- [ ] **Step 7: Run the autosave test file to verify it passes**

Run:

```bash
pnpm --filter @unclutterdesk/app exec vitest run "src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx"
```

Expected:

```text
PASS for autosave timing and locked-note protection.
```

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/pages/TelehealthVideoRoomPage.tsx
git commit -m "feat: add live soap autosave"
```

---

## Task 4: Tighten Autosave Coverage for Error and Status Behavior

**Files:**
- Modify: `apps/app/src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx`

- [ ] **Step 1: Add a failing test for autosave error state**

Extend the test file with:

```tsx
test('shows autosave failure when save request rejects', async () => {
  postMock.mockRejectedValueOnce(new Error('Network error'));

  render(
    <MemoryRouter initialEntries={['/session/42']}>
      <Routes>
        <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('SOAP Notes');

  const subjectiveField = screen.getByDisplayValue('');
  fireEvent.change(subjectiveField, { target: { value: 'Autosave should fail.' } });

  vi.advanceTimersByTime(2500);

  await screen.findByText('Autosave failed');
});
```

- [ ] **Step 2: Run the test file to verify the new test fails first**

Run:

```bash
pnpm --filter @unclutterdesk/app exec vitest run "src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx"
```

Expected:

```text
FAIL because the page does not yet expose the exact error state or message expected by the test.
```

- [ ] **Step 3: Adjust UI or autosave state transitions minimally to satisfy the test**

If needed, refine `saveNote()` and the status label so `Autosave failed` is reliably visible after a rejected save and not immediately overwritten by a stale state change.

Keep the logic minimal; do not add retry queues or background sync in this task.

- [ ] **Step 4: Run the test file again to verify all autosave tests pass**

Run:

```bash
pnpm --filter @unclutterdesk/app exec vitest run "src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx"
```

Expected:

```text
PASS for all autosave tests.
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx apps/app/src/pages/TelehealthVideoRoomPage.tsx
git commit -m "test: cover soap autosave failure states"
```

---

## Task 5: Verify the Full App Surface Still Builds

**Files:**
- Modify: none expected unless build/typecheck exposes a real issue

- [ ] **Step 1: Run app typecheck**

Run:

```bash
pnpm --filter @unclutterdesk/app typecheck
```

Expected:

```text
PASS with no TypeScript errors.
```

- [ ] **Step 2: Run app build**

Run:

```bash
pnpm --filter @unclutterdesk/app build
```

Expected:

```text
PASS with successful Vite production build.
```

- [ ] **Step 3: Run app tests again as final regression check**

Run:

```bash
pnpm --filter @unclutterdesk/app test
```

Expected:

```text
PASS with all autosave tests green.
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/package.json apps/app/vitest.config.ts apps/app/src/test/setup.ts apps/app/src/pages/TelehealthVideoRoomPage.tsx apps/app/src/pages/__tests__/TelehealthVideoRoomPage.autosave.test.tsx
git commit -m "chore: verify live soap autosave build"
```

---

## Self-Review

### Spec coverage

This plan covers:

1. debounced autosave
2. visible save-state UI
3. lock-aware behavior
4. error-state handling
5. minimal frontend test setup
6. verification through typecheck, tests, and build

### Placeholder scan

No `TBD`, `TODO`, or deferred implementation placeholders remain in task steps.

### Type consistency

The plan keeps the existing `api.post('/v1/notes', ...)` note-save contract and does not invent new backend endpoints.

---

## Execution Handoff

Plan complete and saved to `docs/LIVE_SOAP_AUTOSAVE_IMPLEMENTATION_PLAN.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
