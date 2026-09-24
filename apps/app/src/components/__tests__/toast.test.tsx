import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@unclutterdesk/ui';

function Saver({ fail = false }: { fail?: boolean }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => (fail ? toast.error('Could not save') : toast.success('Service saved'))}>
      Save
    </button>
  );
}

describe('toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('confirms a save, then goes away on its own', () => {
    render(<ToastProvider><Saver /></ToastProvider>);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Service saved')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText('Service saved')).toBeNull();
  });

  // Errors need reading, so they stay longer and are announced as alerts.
  it('keeps an error up longer, as an alert', () => {
    render(<ToastProvider><Saver fail /></ToastProvider>);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByRole('alert').textContent).toContain('Could not save');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText('Could not save')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(screen.queryByText('Could not save')).toBeNull();
  });

  it('can be dismissed', () => {
    render(<ToastProvider><Saver /></ToastProvider>);
    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Service saved')).toBeNull();
  });

  it('shows at most three at once', () => {
    render(<ToastProvider><Saver /></ToastProvider>);
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Save'));
    expect(screen.getAllByText('Service saved')).toHaveLength(3);
  });

  it('does nothing, rather than crash, outside a provider', () => {
    render(<Saver />);
    expect(() => fireEvent.click(screen.getByText('Save'))).not.toThrow();
  });
});
