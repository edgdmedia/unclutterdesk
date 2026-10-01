import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';
import { ImageField } from '../settings/ImageField';

const PREV = 'data:image/png;base64,QUJDRA==';

function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function pick(name = 'pic.png', type = 'image/png', bytes = new Uint8Array([1, 2, 3])) {
  fireEvent.change(screen.getByLabelText(/Upload /), {
    target: { files: [new File([bytes], name, { type })] },
  });
}

afterEach(cleanup);

describe('ImageField', () => {
  it('shows saving then saved, and hands the shrunk image to onSave', async () => {
    const save = deferred();
    const onSave = vi.fn().mockReturnValue(save.promise);
    renderWithApp(<ImageField label="logo" value="" onChange={() => undefined} onSave={onSave} />);
    pick();
    await waitFor(() =>
      expect(screen.queryAllByRole('status').some((el) => el.tagName === 'P' && el.textContent?.includes('Saving…'))).toBe(true),
    );
    await act(async () => {
      save.resolve();
    });
    await screen.findByText('Saved');
    expect(onSave).toHaveBeenCalledWith(expect.stringMatching(/^data:image\//));
  });

  it('shows the server’s message and keeps the previous image when saving fails', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error('Too large'));
    renderWithApp(<ImageField label="logo" value={PREV} onChange={onChange} onSave={onSave} />);
    pick();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch('Too large'));
    // The previous image is restored: onChange went back to what was showing.
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(PREV));
    expect((screen.getByRole('img') as HTMLImageElement).src).toBe(PREV);
  });

  it('refuses a non-image and calls nothing', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    renderWithApp(<ImageField label="logo" value="" onChange={onChange} onSave={onSave} />);
    pick('notes.txt', 'text/plain');
    expect(screen.getByRole('alert').textContent).toMatch(/Choose an image file/);
    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('remove clears the value and saves the empty state when it saves on its own', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithApp(<ImageField label="logo" value={PREV} onChange={onChange} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    expect(onChange).toHaveBeenCalledWith('');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''));
  });

  it('renders a circle preview when asked', () => {
    renderWithApp(<ImageField label="profile photo" shape="circle" value={PREV} onChange={() => undefined} />);
    expect(screen.getByRole('img').className).toContain('rounded-full');
  });
});
