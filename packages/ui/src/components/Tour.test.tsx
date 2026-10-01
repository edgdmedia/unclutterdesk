import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Tour, type TourStep } from './Tour';

const STEPS: TourStep[] = [
  { anchor: 'one', title: 'First stop', body: 'Look here first.' },
  { anchor: 'two', title: 'Second stop', body: 'And here next.' },
];

function Host({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div data-tour="one">One</div>
      <div data-tour="two">Two</div>
      {children}
    </div>
  );
}

it('shows the first step beside its anchor', () => {
  render(
    <Host>
      <Tour steps={STEPS} open onDone={() => undefined} />
    </Host>,
  );
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('First stop')).toBeTruthy();
  expect(dialog.getAttribute('aria-modal')).toBe('true');
});

it('Next moves on and Back goes back', () => {
  render(
    <Host>
      <Tour steps={STEPS} open onDone={() => undefined} />
    </Host>,
  );
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('1 of 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(within(screen.getByRole('dialog')).getByText('Second stop')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(within(screen.getByRole('dialog')).getByText('First stop')).toBeTruthy();
});

it('skips a step whose anchor is not on screen', () => {
  render(
    <div>
      <div data-tour="two">Two</div>
      <Tour steps={STEPS} open onDone={() => undefined} />
    </div>,
  );
  expect(within(screen.getByRole('dialog')).getByText('Second stop')).toBeTruthy();
  expect(within(screen.getByRole('dialog')).getByText('1 of 1')).toBeTruthy();
});

it('Esc skips the tour', () => {
  const onDone = vi.fn();
  render(
    <Host>
      <Tour steps={STEPS} open onDone={onDone} />
    </Host>,
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onDone).toHaveBeenCalledWith('skipped');
});

it('Done on the last step finishes the tour', () => {
  const onDone = vi.fn();
  render(
    <Host>
      <Tour steps={STEPS} open onDone={onDone} />
    </Host>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(onDone).toHaveBeenCalledWith('finished');
});

it('closes when open is false', () => {
  render(
    <Host>
      <Tour steps={STEPS} open={false} onDone={() => undefined} />
    </Host>,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});
