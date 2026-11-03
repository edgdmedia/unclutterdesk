import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, renderWithApp, screen } from '../../test/renderWithApp';
import { SchedulePage } from '../practice/SchedulePage';

/* The schedule opens on the current week, not on a fixed date. */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the schedule', () => {
  it('opens on the week of today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 4, 10, 0)); // Wednesday 4 November 2026, local time
    renderWithApp(<SchedulePage sessions={[]} setSessions={() => {}} clients={[]} />);
    expect(screen.getByText(/2 — 6 November 2026|2 Nov — 6 Nov 2026|November 2026/)).toBeTruthy();
    expect(screen.queryByText(/August 2026/)).toBeNull();
  });
});
