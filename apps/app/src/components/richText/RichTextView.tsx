import React from 'react';
import { parseRich, type RichBlock, type RichInline } from './richDoc';

/** An item's words, to name its tick-box. */
const plain = (nodes: RichBlock[]): string =>
  nodes
    .map((b) => (b.type === 'paragraph' || b.type === 'heading' ? (b.content ?? []).map((i) => (i.type === 'text' ? i.text : ' ')).join('') : ''))
    .join(' ')
    .trim();

/**
 * Formatted text, read-only: a note on the client page, a recap in the portal.
 * Built from the stored document as React elements, so nothing in it is ever
 * read as markup.
 *
 * Tick-box items show their saved state; pass `ticks` and `onTick` to let the
 * reader tick them (the portal's recap), counted in reading order.
 */
export function RichTextView({
  value,
  className = '',
  ticks,
  onTick,
  empty = null,
}: {
  value: string | null | undefined;
  className?: string;
  ticks?: boolean[];
  onTick?: (index: number, checked: boolean) => void;
  empty?: React.ReactNode;
}) {
  const doc = parseRich(value);
  if (!doc) return <>{empty}</>;
  let task = 0;

  const inline = (nodes: RichInline[] | undefined) =>
    (nodes ?? []).map((n, i) => {
      if (n.type === 'hardBreak') return <br key={i} />;
      let el: React.ReactNode = n.text;
      for (const m of n.marks ?? []) {
        el = m.type === 'bold' ? <strong>{el}</strong> : m.type === 'italic' ? <em>{el}</em> : <u>{el}</u>;
      }
      return <React.Fragment key={i}>{el}</React.Fragment>;
    });

  const blocks = (nodes: RichBlock[]): React.ReactNode =>
    nodes.map((b, i) => {
      switch (b.type) {
        case 'paragraph':
          return <p key={i}>{inline(b.content)}</p>;
        case 'heading':
          return b.attrs?.level === 3 ? <h3 key={i}>{inline(b.content)}</h3> : <h2 key={i}>{inline(b.content)}</h2>;
        case 'bulletList':
          return <ul key={i}>{b.content.map((item, j) => <li key={j}>{blocks(item.content)}</li>)}</ul>;
        case 'orderedList':
          return <ol key={i} start={b.attrs?.start}>{b.content.map((item, j) => <li key={j}>{blocks(item.content)}</li>)}</ol>;
        case 'taskList':
          return (
            <ul key={i} data-type="taskList">
              {b.content.map((item, j) => {
                const index = task++;
                const checked = ticks?.[index] ?? item.attrs?.checked === true;
                return (
                  <li key={j} data-checked={checked}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={plain(item.content) || `Item ${index + 1}`}
                        disabled={!onTick}
                        onChange={(e) => onTick?.(index, e.target.checked)}
                      />
                    </label>
                    <div>{blocks(item.content)}</div>
                  </li>
                );
              })}
            </ul>
          );
        default:
          return null;
      }
    });

  return <div className={`rich-text ${className}`}>{blocks(doc.content)}</div>;
}
