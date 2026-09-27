import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const apiPatch = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { patch: (...a: unknown[]) => apiPatch(...a) } }));

const { EmergencyContactCard } = await import('../clients/EmergencyContactCard');

describe('EmergencyContactCard', () => {
  beforeEach(() => apiPatch.mockReset());
  afterEach(cleanup);

  it('shows the contact with a tap-to-call number', () => {
    render(<EmergencyContactCard clientId="40" contact={{ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' }} onSaved={() => {}} />);
    expect(screen.getByText('Tolu Ade')).toBeTruthy();
    expect(screen.getByText('Sister')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+2348010000000' }).getAttribute('href')).toBe('tel:+2348010000000');
  });

  it('says so when none is recorded', () => {
    render(<EmergencyContactCard clientId="40" contact={null} onSaved={() => {}} />);
    expect(screen.getByText('Not recorded')).toBeTruthy();
  });

  it('saves an edit and hands back the new contact', async () => {
    const saved = { name: 'Bola', relationship: 'Friend', phone: '0802' };
    apiPatch.mockResolvedValue({ emergencyContact: saved });
    const onSaved = vi.fn();
    render(<EmergencyContactCard clientId="40" contact={null} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit emergency contact' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bola' } });
    fireEvent.change(screen.getByLabelText('Relationship'), { target: { value: 'Friend' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0802' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(apiPatch).toHaveBeenCalledWith('/v1/tenant/clients/40', { emergencyContact: { name: 'Bola', relationship: 'Friend', phone: '0802' } });
  });

  it('shows the server’s message when saving fails', async () => {
    apiPatch.mockRejectedValue(new Error('Add the emergency contact’s name too.'));
    render(<EmergencyContactCard clientId="40" contact={null} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit emergency contact' }));
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0802' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Add the emergency contact’s name too.')).toBeTruthy());
  });
});
