/**
 * Formatted text for session notes, summaries and recaps.
 *
 * The app's editor (TipTap) saves a small JSON document. Only what a therapist
 * needs is kept: paragraphs, two heading sizes, bold/italic/underline, bullet,
 * numbered and tick-box lists, and line breaks. Anything else is dropped on
 * save (plain text is trimmed), so stored text is always this shape and renders safely anywhere: the
 * email HTML is built here from that shape, with every piece of text escaped,
 * never from markup someone sent.
 *
 * Text written before the editor (or by an older client) is plain text, and
 * stays readable: it is read as paragraphs.
 */

export type RichMark = { type: 'bold' | 'italic' | 'underline' };
export type RichInline = { type: 'text'; text: string; marks?: RichMark[] } | { type: 'hardBreak' };
export type RichBlock =
  | { type: 'paragraph'; content?: RichInline[] }
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: RichInline[] }
  | { type: 'bulletList'; content: RichListItem[] }
  | { type: 'orderedList'; attrs?: { start: number }; content: RichListItem[] }
  | { type: 'taskList'; content: RichTaskItem[] };
export type RichListItem = { type: 'listItem'; content: RichBlock[] };
export type RichTaskItem = { type: 'taskItem'; attrs: { checked: boolean }; content: RichBlock[] };
export interface RichDoc {
  type: 'doc';
  content: RichBlock[];
}

/** A generous ceiling: a long SOAP section is a few thousand characters. */
export const RICH_TEXT_MAX_CHARS = 200_000;
const MAX_DEPTH = 6;
const MARKS = new Set(['bold', 'italic', 'underline']);

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Stored text that is one of these documents, rather than plain text. */
export function isRichJson(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && /^\s*\{\s*"type"\s*:\s*"doc"/.test(stored);
}

function inline(nodes: unknown): RichInline[] {
  if (!Array.isArray(nodes)) return [];
  const out: RichInline[] = [];
  for (const n of nodes) {
    if (!isObj(n)) continue;
    if (n.type === 'hardBreak') out.push({ type: 'hardBreak' });
    else if (n.type === 'text' && typeof n.text === 'string' && n.text.length) {
      const marks = Array.isArray(n.marks)
        ? [...new Set(n.marks.filter((m: unknown) => isObj(m) && MARKS.has(m.type)).map((m: any) => m.type as RichMark['type']))].map((type) => ({ type }))
        : [];
      out.push(marks.length ? { type: 'text', text: n.text, marks } : { type: 'text', text: n.text });
    }
  }
  return out;
}

type TextBlock = Extract<RichBlock, { type: 'paragraph' | 'heading' }>;

function withContent<T extends TextBlock>(node: T, content: RichInline[]): T {
  return content.length ? { ...node, content } : node;
}

function blocks(nodes: unknown, depth: number): RichBlock[] {
  if (!Array.isArray(nodes) || depth > MAX_DEPTH) return [];
  const out: RichBlock[] = [];
  for (const n of nodes) {
    if (!isObj(n)) continue;
    switch (n.type) {
      case 'paragraph':
        out.push(withContent<TextBlock>({ type: 'paragraph' }, inline(n.content)));
        break;
      case 'heading': {
        const level = n.attrs?.level === 3 ? 3 : 2;
        out.push(withContent<TextBlock>({ type: 'heading', attrs: { level } }, inline(n.content)));
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const items = (Array.isArray(n.content) ? n.content : [])
          .filter((i: unknown) => isObj(i) && i.type === 'listItem')
          .map((i: any): RichListItem => ({ type: 'listItem', content: blocks(i.content, depth + 1) }));
        if (!items.length) break;
        if (n.type === 'bulletList') out.push({ type: 'bulletList', content: items });
        else {
          const start = Number.isInteger(n.attrs?.start) && n.attrs.start > 1 && n.attrs.start < 10_000 ? n.attrs.start : null;
          out.push(start ? { type: 'orderedList', attrs: { start }, content: items } : { type: 'orderedList', content: items });
        }
        break;
      }
      case 'taskList': {
        const items = (Array.isArray(n.content) ? n.content : [])
          .filter((i: unknown) => isObj(i) && i.type === 'taskItem')
          .map((i: any): RichTaskItem => ({ type: 'taskItem', attrs: { checked: i.attrs?.checked === true }, content: blocks(i.content, depth + 1) }));
        if (items.length) out.push({ type: 'taskList', content: items });
        break;
      }
      // Anything else (tables, images, code, quotes, links...) is not kept.
    }
  }
  return out;
}

/** Plain text, as written before the editor: blank lines part paragraphs, single newlines are line breaks. */
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
      return withContent<TextBlock>({ type: 'paragraph' }, content);
    }),
  };
}

const hasText = (doc: RichDoc) => richToText(doc).trim().length > 0;

/** Any stored value as a document: JSON is cleaned to the allowed shape, plain text becomes paragraphs. */
export function parseRich(stored: string | null | undefined): RichDoc | null {
  if (stored === null || stored === undefined || !stored.trim()) return null;
  if (isRichJson(stored)) {
    try {
      const raw = JSON.parse(stored);
      return { type: 'doc', content: blocks(raw?.content, 0) };
    } catch {
      // Not valid JSON after all: keep what was written, as text.
    }
  }
  return fromPlainText(stored);
}

/**
 * What to store for a value an editor sent: a document is cleaned and saved
 * as JSON, plain text is kept as it is, and an empty one is null.
 */
export function normaliseRichInput(value: unknown, what = 'This text'): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new RangeError(`${what} must be text.`);
  if (value.length > RICH_TEXT_MAX_CHARS) throw new RangeError(`${what} is too long.`);
  if (!isRichJson(value)) return value.trim() || null;
  const doc = parseRich(value);
  return doc && hasText(doc) ? JSON.stringify(doc) : null;
}

// ── Rendering ──────────────────────────────────────────────────────────

function inlineText(nodes: RichInline[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === 'hardBreak' ? '\n' : n.text)).join('');
}

/** Readable plain text: for the text part of an email, previews and search. */
export function richToText(doc: RichDoc | null): string {
  if (!doc) return '';
  const lines: string[] = [];
  const walk = (nodes: RichBlock[], indent: string) => {
    for (const b of nodes) {
      if (b.type === 'paragraph' || b.type === 'heading') {
        const t = inlineText(b.content);
        if (t.trim()) lines.push(indent + t.split('\n').join(`\n${indent}`));
      } else if (b.type === 'bulletList' || b.type === 'orderedList') {
        const start = b.type === 'orderedList' ? (b.attrs?.start ?? 1) : 1;
        b.content.forEach((item, i) => {
          const marker = b.type === 'orderedList' ? `${start + i}. ` : '- ';
          const before = lines.length;
          walk(item.content, indent + '   ');
          if (lines.length > before) lines[before] = indent + marker + lines[before].trimStart();
        });
      } else {
        for (const item of b.content) {
          const before = lines.length;
          walk(item.content, indent + '   ');
          if (lines.length > before) lines[before] = indent + (item.attrs.checked ? '[x] ' : '[ ] ') + lines[before].trimStart();
        }
      }
    }
  };
  walk(doc.content, '');
  return lines.join('\n');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const TAG: Record<RichMark['type'], [string, string]> = {
  bold: ['<strong>', '</strong>'],
  italic: ['<em>', '</em>'],
  underline: ['<u>', '</u>'],
};

function inlineHtml(nodes: RichInline[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === 'hardBreak') return '<br>';
      const marks = n.marks ?? [];
      return marks.map((m) => TAG[m.type][0]).join('') + esc(n.text) + [...marks].reverse().map((m) => TAG[m.type][1]).join('');
    })
    .join('');
}

/** Inline styles only: email clients drop style sheets. */
const S = {
  p: 'margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;',
  h2: 'margin:20px 0 8px;font-size:18px;line-height:1.35;font-weight:700;color:#0f172a;',
  h3: 'margin:16px 0 6px;font-size:16px;line-height:1.4;font-weight:700;color:#0f172a;',
  list: 'margin:0 0 12px;padding-left:22px;font-size:15px;line-height:1.7;color:#334155;',
  li: 'margin:0 0 4px;',
  task: 'margin:0 0 12px;padding:0;list-style:none;font-size:15px;line-height:1.7;color:#334155;',
  box: 'display:inline-block;width:14px;height:14px;margin-right:8px;border:1.5px solid #64748b;border-radius:3px;vertical-align:-2px;text-align:center;font-size:11px;line-height:13px;color:#0f766e;',
};

/** The document as email-safe HTML. Lists inside list items keep their spacing tight. */
export function richToEmailHtml(doc: RichDoc | null): string {
  if (!doc) return '';
  const render = (nodes: RichBlock[], inItem: boolean): string =>
    nodes
      .map((b) => {
        const tight = inItem ? 'margin:0;' : '';
        switch (b.type) {
          case 'paragraph':
            return `<p style="${S.p}${tight}">${inlineHtml(b.content) || '&nbsp;'}</p>`;
          case 'heading':
            return `<h${b.attrs.level} style="${b.attrs.level === 2 ? S.h2 : S.h3}">${inlineHtml(b.content)}</h${b.attrs.level}>`;
          case 'bulletList':
            return `<ul style="${S.list}${tight}">${b.content.map((i) => `<li style="${S.li}">${render(i.content, true)}</li>`).join('')}</ul>`;
          case 'orderedList':
            return `<ol${b.attrs?.start ? ` start="${b.attrs.start}"` : ''} style="${S.list}${tight}">${b.content.map((i) => `<li style="${S.li}">${render(i.content, true)}</li>`).join('')}</ol>`;
          case 'taskList':
            return `<ul style="${S.task}${tight}">${b.content
              .map((i) => {
                // The item's first line sits beside its box; anything under it follows.
                const [first, ...rest] = i.content;
                const head = first?.type === 'paragraph' ? `<span>${inlineHtml(first.content)}</span>` : render(first ? [first] : [], true);
                return `<li style="${S.li}"><span style="${S.box}">${i.attrs.checked ? '&#10003;' : '&nbsp;'}</span>${head}${render(rest, true)}</li>`;
              })
              .join('')}</ul>`;
        }
      })
      .join('');
  return render(doc.content, false);
}

/** How many tick-box items the document has, in reading order (the portal keeps the client's ticks by position). */
export function countTasks(doc: RichDoc | null): number {
  if (!doc) return 0;
  let n = 0;
  const walk = (nodes: RichBlock[]) => {
    for (const b of nodes) {
      if (b.type === 'taskList') for (const i of b.content) { n++; walk(i.content); }
      else if (b.type === 'bulletList' || b.type === 'orderedList') for (const i of b.content) walk(i.content);
    }
  };
  walk(doc.content);
  return n;
}
