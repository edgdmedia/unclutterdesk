import { describe, expect, it } from 'vitest';
import { countTasks, isRichJson, normaliseRichInput, parseRich, richToEmailHtml, richToText, type RichDoc } from './rich-text';

/**
 * Formatted notes and recaps: only a small, safe shape is ever stored, and
 * it renders to email HTML and plain text without trusting any markup.
 */
const t = (text: string, ...marks: Array<'bold' | 'italic' | 'underline'>) =>
  marks.length ? { type: 'text', text, marks: marks.map((type) => ({ type })) } : { type: 'text', text };
const p = (...content: any[]) => ({ type: 'paragraph', content });
const doc = (...content: any[]) => JSON.stringify({ type: 'doc', content });

describe('storing formatted text', () => {
  it('keeps headings, marks and the three kinds of list', () => {
    const input = doc(
      { type: 'heading', attrs: { level: 2 }, content: [t('Your next steps')] },
      p(t('Anger as a learned skill.', 'bold'), t(' It worked then.')),
      { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('Honest'))] }] },
      { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p(t('First'))] }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p(t('Day 1'))] }] },
    );
    const stored = normaliseRichInput(input)!;
    expect(JSON.parse(stored)).toEqual(JSON.parse(input.replace('"attrs":{"start":1},', '')));
  });

  it('drops what the notes do not use: tables, links, code, images, odd attributes', () => {
    const input = doc(
      { type: 'table', content: [{ type: 'tableRow', content: [] }] },
      { type: 'image', attrs: { src: 'https://evil.example/x.png' } },
      p({ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'bold' }] }),
      { type: 'heading', attrs: { level: 1, onclick: 'x' }, content: [t('Big')] },
    );
    expect(JSON.parse(normaliseRichInput(input)!)).toEqual({
      type: 'doc',
      content: [p(t('click', 'bold')), { type: 'heading', attrs: { level: 2 }, content: [t('Big')] }],
    });
  });

  it('keeps plain text from before the editor as it was', () => {
    expect(normaliseRichInput('Client was engaged.\nReflective.')).toBe('Client was engaged.\nReflective.');
    expect(normaliseRichInput('   ')).toBeNull();
    expect(normaliseRichInput(null)).toBeNull();
  });

  it('an editor left empty stores nothing', () => {
    expect(normaliseRichInput(doc(p()))).toBeNull();
  });

  it('refuses what is not text, and what is far too long', () => {
    expect(() => normaliseRichInput({ type: 'doc' })).toThrow(RangeError);
    expect(() => normaliseRichInput('x'.repeat(200_001))).toThrow(RangeError);
  });

  it('tells a document from text that merely starts with a brace', () => {
    expect(isRichJson(doc(p(t('x'))))).toBe(true);
    expect(isRichJson('{client said "doc"}')).toBe(false);
  });
});

describe('reading stored text', () => {
  it('reads plain text as paragraphs, keeping its line breaks', () => {
    expect(parseRich('One\nline two\n\nThree')).toEqual({
      type: 'doc',
      content: [p(t('One'), { type: 'hardBreak' }, t('line two')), p(t('Three'))],
    });
  });

  it('reads a damaged document as the text it is', () => {
    expect(parseRich('{"type":"doc", broken')).toEqual({ type: 'doc', content: [p(t('{"type":"doc", broken'))] });
  });
});

describe('rendering', () => {
  const sample = parseRich(
    doc(
      { type: 'heading', attrs: { level: 3 }, content: [t('1. Days 1–5')] },
      p(t('Breathe '), t('slowly', 'italic'), t(' <now>')),
      { type: 'orderedList', content: [{ type: 'listItem', content: [p(t('When did I feel most like myself?'))] }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('Day 1'))] }, { type: 'taskItem', attrs: { checked: false }, content: [p(t('Day 2'))] }] },
    ),
  ) as RichDoc;

  it('as email HTML, escaping every piece of text', () => {
    const html = richToEmailHtml(sample);
    expect(html).toContain('<h3 style=');
    expect(html).toContain('<em>slowly</em>');
    expect(html).toContain('&lt;now&gt;');
    expect(html).not.toContain('<now>');
    expect(html).toContain('<ol style=');
    expect(html).toMatch(/&#10003;<\/span><span>Day 1<\/span>/);
  });

  it('as plain text, with list markers and boxes', () => {
    expect(richToText(sample)).toBe(['1. Days 1–5', 'Breathe slowly <now>', '1. When did I feel most like myself?', '[x] Day 1', '[ ] Day 2'].join('\n'));
  });

  it('counts the tick-box items', () => {
    expect(countTasks(sample)).toBe(2);
    expect(countTasks(parseRich('just text'))).toBe(0);
  });
});
