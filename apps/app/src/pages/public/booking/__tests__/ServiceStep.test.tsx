import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen } from '../../../../test/renderWithApp';
import { ServiceStep } from '../ServiceStep';

afterEach(cleanup);

const services = [
  { id: '1', title: 'Initial consultation', description: 'A first conversation.', durationMinutes: 30, priceKobo: '1500000' },
  { id: '2', title: 'Individual therapy', description: 'One-to-one.', durationMinutes: 50, priceKobo: '3500000' },
];
const slots = [
  { id: 'a', serviceId: null, therapistName: 'S', startsAt: '2026-10-06T08:00:00Z', endsAt: '', channel: 'VIDEO' },
  { id: 'b', serviceId: '2', therapistName: 'S', startsAt: '2026-10-06T12:00:00Z', endsAt: '', channel: 'IN_PERSON' },
];

describe('ServiceStep', () => {
  it('lists each service with its price, length and formats, and marks the chosen one', () => {
    const onChoose = vi.fn();
    renderWithApp(<ServiceStep status="ready" services={services} slots={slots} selectedId="2" onChoose={onChoose} practiceEmail="hi@smith.ng" />);
    const individual = screen.getByRole('button', { name: /Individual therapy/ });
    expect(individual.getAttribute('aria-pressed')).toBe('true');
    expect(individual.textContent).toContain('₦35,000');
    expect(individual.textContent).toContain('50 min');
    expect(individual.textContent).toContain('Online');
    expect(individual.textContent).toContain('In person');
    expect(screen.getByRole('button', { name: /Initial consultation/ }).textContent).not.toContain('In person');
    fireEvent.click(screen.getByRole('button', { name: /Initial consultation/ }));
    expect(onChoose).toHaveBeenCalledWith('1');
  });

  it('shows skeletons while loading', () => {
    const { container } = renderWithApp(<ServiceStep status="loading" services={[]} slots={[]} selectedId={null} onChoose={() => {}} />);
    expect(container.querySelectorAll('[data-skeleton]').length).toBe(3);
  });

  it('says so when nothing is open for booking, with a way to contact the practice', () => {
    renderWithApp(<ServiceStep status="ready" services={[]} slots={[]} selectedId={null} onChoose={() => {}} practiceEmail="hi@smith.ng" />);
    expect(screen.getByText('No sessions open for booking')).toBeTruthy();
    expect(screen.getByRole('link', { name: /hi@smith.ng/ }).getAttribute('href')).toBe('mailto:hi@smith.ng');
  });
});
