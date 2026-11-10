/**
 * The formatted-text document notes, summaries and recaps are saved as.
 *
 * The API decides what is kept (apps/api/src/common/rich-text.ts) and cleans
 * every save; this side only reads what the API stored. Text written before
 * the editor is plain text and reads as paragraphs.
 */
export type RichMark = { type: 'bold' | 'italic' | 'underline' };
export type RichInline = { type: 'text'; text: string; marks?: RichMark[] } | { type: 'hardBreak' };
export type RichBlock =
  | { type: 'paragraph'; content?: RichInline[] }
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: RichInline[] }
  | { type: 'bulletList'; content: RichListItem[] }
  | { type: 'orderedList'; attrs?: { start?: number }; content: RichListItem[] }
  | { type: 'taskList'; content: RichTaskItem[] };
export type RichListItem = { type: 'listItem'; content: RichBlock[] };
export type RichTaskItem = { type: 'taskItem'; attrs: { checked: boolean }; content: RichBlock[] };
export interface RichDoc {
  type: 'doc';
  content: RichBlock[];
}

export function isRichJson(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && /^\s*\{\s*"type"\s*:\s*"doc"/.test(stored);
}

function fromPlainText(text: string): RichDoc {
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n{2,}/).filter((p) => p.trim().length);
  return {
    type: 'doc',
    content: paragraphs.map((p) => {
      const content: RichInline[] = [];
      p.split('\n').forEach((line, i) => {
        if (i > 0) content.push({ type: 'hardBreak' });
        if (line.length) content.push({ type: 'text', text: line });
      });
      return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
    }),
  };
}

/** A stored value as a document, or null when there is nothing written. */
export function parseRich(stored: string | null | undefined): RichDoc | null {
  if (!stored || !stored.trim()) return null;
  if (isRichJson(stored)) {
    try {
      const doc = JSON.parse(stored);
      if (doc?.type === 'doc' && Array.isArray(doc.content)) return doc as RichDoc;
    } catch {
      // Fall through: show what was written.
    }
  }
  return fromPlainText(stored);
}

/** Whether a stored value has any words in it. */
export function hasRichText(stored: string | null | undefined): boolean {
  const doc = parseRich(stored);
  if (!doc) return false;
  const walk = (nodes: Array<RichBlock | RichListItem | RichTaskItem>): boolean =>
    nodes.some((n) =>
      n.type === 'paragraph' || n.type === 'heading'
        ? (n.content ?? []).some((i) => i.type === 'text' && i.text.trim().length > 0)
        : walk(n.content as Array<RichBlock | RichListItem | RichTaskItem>),
    );
  return walk(doc.content);
}

/** A stored value as one line of plain text, for previews. */
export function richPreview(stored: string | null | undefined): string {
  const doc = parseRich(stored);
  if (!doc) return '';
  const words: string[] = [];
  const walk = (nodes: Array<RichBlock | RichListItem | RichTaskItem>) => {
    for (const n of nodes) {
      if (n.type === 'paragraph' || n.type === 'heading') words.push((n.content ?? []).map((i) => (i.type === 'text' ? i.text : ' ')).join(''));
      else walk(n.content as Array<RichBlock | RichListItem | RichTaskItem>);
    }
  };
  walk(doc.content);
  return words.join(' ').replace(/\s+/g, ' ').trim();
}
