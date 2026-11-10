import { parseRich, type RichBlock, type RichInline, type RichListItem, type RichTaskItem } from '../richText/richDoc';

/**
 * A practitioner's Journal plan (docs/design/journal-integration.md §3), as
 * the session page edits it. The API checks it with the same rules Journal
 * uses; the limits here only keep the editor honest while typing.
 */
export type PlanStep = { kind: 'repeat'; days: number; prompt: string } | { kind: 'sequence'; prompts: string[] };

export interface JournalPlan {
  title: string;
  intro: string | null;
  steps: PlanStep[];
  cadence: 'daily';
}

export const MAX_PLAN_DAYS = 60;
export const MAX_REPEAT_DAYS = 30;
export const MAX_PROMPT_CHARS = 600;
export const MAX_TITLE_CHARS = 120;
export const MAX_INTRO_CHARS = 1000;

export const planDays = (steps: PlanStep[]) => steps.reduce((n, s) => n + (s.kind === 'repeat' ? s.days : s.prompts.length), 0);

export const emptyPlan = (): JournalPlan => ({ title: '', intro: null, steps: [{ kind: 'sequence', prompts: [''] }], cadence: 'daily' });

const textOf = (inline: RichInline[] | undefined) =>
  (inline ?? []).map((n) => (n.type === 'text' ? n.text : ' ')).join('').replace(/\s+/g, ' ').trim();

/** The recap's tick-box items, in reading order. */
export function recapTasks(stored: string | null | undefined): string[] {
  const out: string[] = [];
  const walk = (nodes: Array<RichBlock | RichListItem | RichTaskItem>) => {
    for (const n of nodes) {
      if (n.type === 'taskItem') {
        const first = n.content.find((b) => b.type === 'paragraph' || b.type === 'heading') as { content?: RichInline[] } | undefined;
        const text = textOf(first?.content);
        if (text) out.push(text);
        walk(n.content.filter((b) => b !== first));
      } else if ('content' in n && Array.isArray(n.content) && n.type !== 'paragraph' && n.type !== 'heading') {
        walk(n.content as Array<RichBlock | RichListItem | RichTaskItem>);
      }
    }
  };
  walk(parseRich(stored)?.content ?? []);
  return out;
}

/** "Days 1–5: sit quietly" (or "Day 3 – …", any dash) → a repeat over those days. */
const DAY_RANGE = /^days?\s*(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\s*[:.,–—-]?\s*(.+)$/i;
const ONE_DAY = /^day\s*(\d{1,2})\s*[:.,–—-]\s*(.+)$/i;

/**
 * The recap's tick-box items as plan steps, so the practice is written once.
 * "Days 1–5: …" becomes the same prompt for five days; every other item is
 * one day's prompt, in order (consecutive ones share a step).
 */
export function stepsFromRecap(stored: string | null | undefined): PlanStep[] {
  const steps: PlanStep[] = [];
  for (const task of recapTasks(stored)) {
    const range = DAY_RANGE.exec(task);
    if (range) {
      const days = Number(range[2]) - Number(range[1]) + 1;
      if (days >= 1 && days <= MAX_REPEAT_DAYS) {
        steps.push({ kind: 'repeat', days, prompt: range[3].trim().slice(0, MAX_PROMPT_CHARS) });
        continue;
      }
    }
    const prompt = (ONE_DAY.exec(task)?.[2] ?? task).trim().slice(0, MAX_PROMPT_CHARS);
    const last = steps[steps.length - 1];
    if (last?.kind === 'sequence') last.prompts.push(prompt);
    else steps.push({ kind: 'sequence', prompts: [prompt] });
  }
  return steps;
}
