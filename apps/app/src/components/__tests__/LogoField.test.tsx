import { describe, expect, it, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';
import { LogoField } from '../settings/LogoField';

afterEach(cleanup);

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <LogoField value={value} onChange={setValue} />
      <output data-testid="value">{value || 'empty'}</output>
    </>
  );
}

const pick = (bytes: number, type = 'image/png') =>
  fireEvent.change(screen.getByLabelText('Upload logo'), { target: { files: [new File([new Uint8Array(bytes)], 'logo.png', { type })] } });

describe('LogoField', () => {
  it('shows the saved logo', () => {
    renderWithApp(<Harness initial="data:image/png;base64,QUJD" />);
    expect((screen.getByRole('img', { name: 'Practice logo' }) as HTMLImageElement).src).toBe('data:image/png;base64,QUJD');
  });

  it('takes a small image as the new logo', async () => {
    renderWithApp(<Harness />);
    pick(2_000);
    await waitFor(() => expect(screen.getByTestId('value').textContent).toMatch(/^data:image\/png;base64,/));
  });

  it('refuses a file that is not an image', async () => {
    renderWithApp(<Harness />);
    pick(2_000, 'application/pdf');
    expect(await screen.findByText(/choose an image/i)).toBeTruthy();
    expect(screen.getByTestId('value').textContent).toBe('empty');
  });

  it('explains when an image is too large to use', async () => {
    renderWithApp(<Harness />);
    // jsdom cannot shrink images, so a large file stays large and is refused with a reason.
    pick(400_000);
    expect(await screen.findByText(/too large/i)).toBeTruthy();
    expect(screen.getByTestId('value').textContent).toBe('empty');
  });

  it('removes the logo', () => {
    renderWithApp(<Harness initial="data:image/png;base64,QUJD" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    expect(screen.getByTestId('value').textContent).toBe('empty');
  });
});
