import { describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RichTextEditor } from './RichTextEditor';
import { RichTextView } from './RichTextView';
import { editorOf, textOf, writeIn } from '../../test/richText';

/** Formatted writing for notes and recaps, and reading it back. */
function Harness({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return <RichTextEditor label="Plan" value={value} onChange={(v) => { setValue(v); onChange?.(v); }} />;
}

describe('the formatted-text editor', () => {
  it('opens plain text written before the editor as paragraphs', () => {
    render(<Harness initial={'Breathing practice\n\nReview next week'} />);
    expect(textOf(screen.getByLabelText('Plan'))).toBe('Breathing practice\n\nReview next week');
  });

  it('reports a document, and nothing for an empty field', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = screen.getByLabelText('Plan');
    writeIn(field, 'Days 1–5');
    expect(JSON.parse(onChange.mock.lastCall![0])).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Days 1–5' }] }] });
    act(() => { editorOf(field).commands.clearContent(true); });
    expect(onChange.mock.lastCall![0]).toBe('');
  });

  it('turns lines into a tick-box list from the toolbar', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    writeIn(screen.getByLabelText('Plan'), 'Day 1');
    fireEvent.click(screen.getByRole('button', { name: 'Tick-box list' }));
    expect(JSON.parse(onChange.mock.lastCall![0]).content[0]).toMatchObject({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false } }] });
    expect(screen.getByRole('button', { name: 'Tick-box list' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers only what the notes keep: no tables, links, quotes or code', () => {
    render(<Harness />);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Heading', 'Subheading', 'Bold', 'Italic', 'Underline', 'Bullet list', 'Numbered list', 'Tick-box list', 'Undo', 'Redo']);
  });

  it('has no toolbar when it cannot be written in', () => {
    render(<RichTextEditor label="Plan" value="Signed." onChange={() => undefined} disabled />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(editorOf(screen.getByLabelText('Plan')).isEditable).toBe(false);
  });
});

describe('reading formatted text', () => {
  const recap = JSON.stringify({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Your next steps' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Anger as a learned skill.', marks: [{ type: 'bold' }] }] },
    { type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Day 1' }] }] },
      { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Day 2' }] }] },
    ] },
  ] });

  it('shows headings, marks and tick-boxes', () => {
    render(<RichTextView value={recap} />);
    expect(screen.getByRole('heading', { name: 'Your next steps' })).toBeTruthy();
    expect(screen.getByText('Anger as a learned skill.').tagName).toBe('STRONG');
    expect((screen.getByRole('checkbox', { name: 'Day 1' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('lets the reader tick items when asked, counted in reading order', () => {
    const onTick = vi.fn();
    render(<RichTextView value={recap} ticks={[false, true]} onTick={onTick} />);
    expect((screen.getByRole('checkbox', { name: 'Day 2' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Day 1' }));
    expect(onTick).toHaveBeenCalledWith(0, true);
  });

  it('never reads stored text as markup', () => {
    const { container } = render(<RichTextView value={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror="alert(1)">');
  });

  it('shows the fallback when nothing is written', () => {
    render(<RichTextView value="" empty={<p>No plan saved.</p>} />);
    expect(screen.getByText('No plan saved.')).toBeTruthy();
  });
});
