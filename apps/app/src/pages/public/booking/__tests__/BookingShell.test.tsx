import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen } from '../../../../test/renderWithApp';
import { BookingHeader, BookingProgress, StepCard, StickyActionBar, SummaryCard } from '../BookingShell';

afterEach(cleanup);

describe('booking header', () => {
  it('shows the logo when the practice has one', () => {
    renderWithApp(<BookingHeader name="Smith Therapy & Wellness" logoUrl="https://x/logo.png" rating={null} profileHref="/" />);
    expect((screen.getByRole('img', { name: 'Smith Therapy & Wellness logo' }) as HTMLImageElement).src).toBe('https://x/logo.png');
  });

  it('shows initials when there is no logo, and links the rating to the profile', () => {
    renderWithApp(<BookingHeader name="Smith Therapy & Wellness" logoUrl={null} rating={{ average: 4.9, count: 32 }} profileHref="/" />);
    expect(screen.getByText('ST')).toBeTruthy();
    expect(screen.getByRole('link', { name: /4.9 · 32 reviews/ }).getAttribute('href')).toBe('/');
    expect(screen.getByText('Secure booking')).toBeTruthy();
  });

  it('hides the rating when there are no reviews', () => {
    renderWithApp(<BookingHeader name="Calm" logoUrl={null} rating={{ average: 0, count: 0 }} profileHref="/" />);
    expect(screen.queryByText(/reviews/)).toBeNull();
  });
});

describe('booking progress', () => {
  it('lets the client jump back to a finished step but not ahead', () => {
    const onGoTo = vi.fn();
    renderWithApp(<BookingProgress step={3} onGoTo={onGoTo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Service' }));
    expect(onGoTo).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(onGoTo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Details' }).getAttribute('aria-current')).toBe('step');
  });
});

describe('step card', () => {
  it('labels the step, and offers Back when there is somewhere to go back to', () => {
    const onBack = vi.fn();
    renderWithApp(<StepCard step={2} title="Pick a time" sub="Each time is either online or in person." onBack={onBack}>body</StepCard>);
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('summary card', () => {
  it('shows placeholders until there is a value, then the total', () => {
    renderWithApp(<SummaryCard cancellationHours={24} />);
    expect(screen.getByText('Choose a session')).toBeTruthy();
    expect(screen.getByText('Pick a time')).toBeTruthy();
    cleanup();
    renderWithApp(<SummaryCard therapist={{ name: 'Sarah Smith', title: 'PhD, LCSW' }} practiceName="Smith Therapy" serviceLabel="Individual therapy · 50 min" totalKobo="3500000" cancellationHours={24} />);
    expect(screen.getByText('₦35,000')).toBeTruthy();
    expect(screen.getByText('PhD, LCSW · Smith Therapy')).toBeTruthy();
    expect(screen.getByText(/Free cancellation up to 24 hours before/)).toBeTruthy();
  });
});

describe('sticky action bar', () => {
  it('shows the total and stays disabled until the step is valid', () => {
    const onClick = vi.fn();
    renderWithApp(<StickyActionBar totalKobo="3500000" label="Continue" disabled onClick={onClick} />);
    expect(screen.getByText('₦35,000')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
