import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { brandTokens } from '@unclutterdesk/ui';
import { cleanup, fireEvent, renderWithApp, screen } from '../../../../test/renderWithApp';
import { AppearancePicker } from '../AppearancePicker';

/* Task 7: the Custom swatch, its colour input, the contrast note and the plan gate. Only the network is absent here — the picker takes no API calls of its own. */

vi.mock('../../../../config/domains', () => ({
  profilePath: (handle: string) => `https://profiles.test/${handle}`,
}));

afterEach(cleanup);

function render(over: Partial<React.ComponentProps<typeof AppearancePicker>> = {}) {
  const onChange = vi.fn();
  renderWithApp(
    <AppearancePicker
      layoutKey="classic"
      themeKey="calm"
      brandColor={null}
      name="Ada Obi"
      kindLabel="Counsellor"
      headline="Calm support"
      handle="ada-obi"
      onChange={onChange}
      {...over}
    />,
  );
  return onChange;
}

describe('the appearance picker', () => {
  it('shows six palettes: the five presets and Custom', () => {
    render();
    const radios = screen.getAllByRole('radio');
    // Four layout radios, then five palettes and Custom.
    expect(radios.filter((r) => r.getAttribute('aria-checked') !== null)).toHaveLength(10);
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeTruthy();
  });

  it('below Starter, Custom carries an Upgrade tag and sends nothing', () => {
    const onChange = render({ customLocked: true });
    const upgrade = screen.getByText('Upgrade');
    expect(upgrade).toBeTruthy();
    const link = screen.getByRole('link', { name: /Custom colour/ });
    expect(link.getAttribute('href')).toBe('/dashboard/settings/subscription');
    fireEvent.click(link);
    expect(onChange).not.toHaveBeenCalled();
    // There is no Custom radio to choose, and no colour field.
    expect(screen.queryByRole('radio', { name: 'Custom' })).toBeNull();
    expect(screen.queryByLabelText('Brand colour hex')).toBeNull();
  });

  it('on Starter, choosing Custom and a colour saves both the theme and the colour', () => {
    const onChange = render();
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    const hex = screen.getByLabelText('Brand colour hex') as HTMLInputElement;
    fireEvent.change(hex, { target: { value: '#2a56a8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save colour' }));
    expect(onChange).toHaveBeenCalledWith({ themeKey: 'custom', brandColor: '#2A56A8' });
  });

  it('accepts a short #RGB colour', () => {
    const onChange = render();
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Brand colour hex'), { target: { value: '#28a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save colour' }));
    expect(onChange).toHaveBeenCalledWith({ themeKey: 'custom', brandColor: '#2288AA' });
  });

  it('says when the colour was adjusted, and names the readable one', () => {
    render({ themeKey: 'custom', brandColor: '#FFD400' });
    const expected = brandTokens('#FFD400');
    expect(expected?.adjusted).toBe(true);
    expect(screen.getByText(/Adjusted to/)).toBeTruthy();
    expect(screen.getByText(expected!.accent)).toBeTruthy();
  });

  it('does not claim adjustment for a colour that already reads', () => {
    render({ themeKey: 'custom', brandColor: '#2A56A8' });
    expect(screen.queryByText(/Adjusted to/)).toBeNull();
  });

  it('an invalid hex disables Save', () => {
    render({ themeKey: 'custom', brandColor: '#2A56A8' });
    const hex = screen.getByLabelText('Brand colour hex') as HTMLInputElement;
    fireEvent.change(hex, { target: { value: '#12' } });
    const save = screen.getByRole('button', { name: 'Save colour' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/Enter a colour/);
  });
});