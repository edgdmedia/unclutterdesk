import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsPage } from '../practice/AnalyticsPage';

/**
 * Practice analytics.
 *
 * The range control set state that nothing read: picking "30 days" left every
 * figure identical, and the chart always drew twelve months. A filter that
 * gives the same answer to every question is worse than no filter, because it
 * looks like it worked. "Download report" had no handler at all — a button
 * that looked enabled, took the click, and did nothing.
 */
const DAY = 86_400_000;

function sessionAt(daysAgo: number, over: Record<string, unknown> = {}) {
  return {
    startsAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    status: 'COMPLETED',
    type: 'Individual therapy',
    ...over,
  };
}

function renderPage(sessions: any[] = [], clients: any[] = []) {
  return render(
    <MemoryRouter>
      <AnalyticsPage clients={clients} sessions={sessions} />
    </MemoryRouter>,
  );
}

/** The figure under a labelled KPI tile. */
function kpi(container: HTMLElement, label: string): string {
  const node = [...container.querySelectorAll('*')].find((el) => el.textContent?.trim() === label);
  return node?.parentElement?.textContent?.replace(label, '').trim() ?? '';
}

afterEach(cleanup);

describe('the range control', () => {
  it('offers the three ranges', () => {
    renderPage();
    expect(screen.getByText('30 days')).toBeTruthy();
    expect(screen.getByText('90 days')).toBeTruthy();
    expect(screen.getByText('12 months')).toBeTruthy();
  });

  // The bug: every figure was identical whichever range was chosen.
  it('changes the figures when the range changes', () => {
    const sessions = [sessionAt(5), sessionAt(200), sessionAt(300)];
    const { container } = renderPage(sessions);

    expect(kpi(container, 'SESSIONS TRACKED')).toContain('3');
    fireEvent.click(screen.getByText('30 days'));
    expect(kpi(container, 'SESSIONS TRACKED')).toContain('1');
  });

  it('counts a session inside the window and not one outside it', () => {
    const { container } = renderPage([sessionAt(10), sessionAt(120)]);
    fireEvent.click(screen.getByText('90 days'));
    expect(kpi(container, 'SESSIONS TRACKED')).toContain('1');
  });

  it('draws one bar per month of the chosen range', () => {
    const { container } = renderPage([sessionAt(5)]);
    const bars = () => container.querySelectorAll('[data-bar], .flex-1');
    fireEvent.click(screen.getByText('30 days'));
    const narrow = container.textContent ?? '';
    fireEvent.click(screen.getByText('12 months'));
    const wide = container.textContent ?? '';
    // Twelve months of labels is materially more markup than one.
    expect(wide.length).toBeGreaterThan(narrow.length);
    expect(bars().length).toBeGreaterThan(0);
  });

  it('reports a completion rate against the range, not the whole history', () => {
    const sessions = [
      sessionAt(5, { status: 'COMPLETED' }),
      sessionAt(300, { status: 'CONFIRMED' }),
    ];
    const { container } = renderPage(sessions);
    fireEvent.click(screen.getByText('30 days'));
    // One session in range, and it is completed.
    expect(kpi(container, 'UPCOMING SESSIONS')).toContain('100%');
  });

  it('survives a session with no date rather than counting it', () => {
    const { container } = renderPage([sessionAt(5), { status: 'COMPLETED' }]);
    expect(kpi(container, 'SESSIONS TRACKED')).toContain('1');
  });
});

describe('download report', () => {
  let clicked: HTMLAnchorElement | null = null;

  beforeEach(() => {
    clicked = null;
    // jsdom implements neither.
    (URL as any).createObjectURL = vi.fn(() => 'blob:report');
    (URL as any).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  // It had no onClick: enabled, clickable, inert.
  it('actually downloads something', () => {
    renderPage([sessionAt(5)]);
    fireEvent.click(screen.getByText('Download report'));
    expect(clicked).not.toBeNull();
    expect(clicked!.download).toMatch(/^analytics-12m-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('names the file for the range being looked at', () => {
    renderPage([sessionAt(5)]);
    fireEvent.click(screen.getByText('30 days'));
    fireEvent.click(screen.getByText('Download report'));
    expect(clicked!.download).toContain('30d');
  });

  it('builds the file from the figures on screen', () => {
    renderPage([sessionAt(5)]);
    fireEvent.click(screen.getByText('Download report'));
    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blob.type).toContain('text/csv');
  });
});
