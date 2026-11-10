import { act } from '@testing-library/react';
import type { Editor } from '@tiptap/core';

/**
 * Writing in a formatted-text field (components/richText/RichTextEditor).
 *
 * jsdom has no real typing for contenteditable, so this goes through the
 * editor's own input commands, the path a keystroke takes, on the real editor
 * the page mounted (TipTap keeps it on the field's element).
 */
export function editorOf(field: HTMLElement): Editor {
  const editor = (field as HTMLElement & { editor?: Editor }).editor;
  if (!editor) throw new Error('Not a formatted-text field');
  return editor;
}

/** Replaces what the field holds with `text`, as one paragraph. */
export function writeIn(field: HTMLElement, text: string) {
  act(() => {
    editorOf(field).chain().focus().selectAll().deleteSelection().insertContent(text).run();
  });
}

/** What a field shows, as plain text. */
export function textOf(field: HTMLElement): string {
  return editorOf(field).getText();
}

/** Whether a field can be written in. */
export function isEditable(field: HTMLElement): boolean {
  return editorOf(field).isEditable;
}

/** The stored value an editor reports for one paragraph of plain text. */
export const docOf = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
