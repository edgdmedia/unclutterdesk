import { describe, expect, it, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen } from '../../test/renderWithApp';
import { PracticeLogo } from '../public/PracticeLogo';

afterEach(cleanup);

describe('PracticeLogo', () => {
  it('shows the logo', () => {
    renderWithApp(<PracticeLogo name="Calm Rooms" logoUrl="https://x/logo.png" />);
    expect((screen.getByRole('img', { name: 'Calm Rooms logo' }) as HTMLImageElement).src).toBe('https://x/logo.png');
  });
  it('falls back to initials when there is none, or it will not load', () => {
    renderWithApp(<PracticeLogo name="Calm Rooms" logoUrl="https://x/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Calm Rooms logo' }));
    expect(screen.getByText('CR')).toBeTruthy();
    cleanup();
    renderWithApp(<PracticeLogo name="Calm Rooms" />);
    expect(screen.getByText('CR')).toBeTruthy();
  });
});
