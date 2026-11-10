/**
 * The practitioner's Journal plan for a session (docs/design/journal-integration.md §3).
 *
 * Desk is the plan's source of truth; Journal keeps a private copy as a series
 * and delivers one prompt a day. The rules here match the Suite's own check
 * (apps/api/src/modules/desk-integration/desk-plan.ts there), so a plan Desk
 * accepts is one Journal accepts: the practitioner hears about a problem while
 * writing, never when the client adds it.
 *
 *  - "repeat": the same prompt on several days (Days 1–5: sit quietly);
 *  - "sequence": one prompt a day, in order.
 */

export const MAX_PLAN_PROMPTS = 60;
export const MAX_REPEAT_DAYS = 30;
export const MAX_PROMPT_CHARS = 600;
export const MAX_TITLE_CHARS = 120;
export const MAX_INTRO_CHARS = 1000;
export const DEFAULT_DELIVERY_TIME = '08:00';

export type PlanStep = { kind: 'repeat'; days: number; prompt: string } | { kind: 'sequence'; prompts: string[] };

export interface JournalPlan {
  title: string;
  intro: string | null;
  steps: PlanStep[];
  cadence: 'daily';
}

export class PlanError extends Error {}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : '');

/** Checks a plan and returns it cleaned. Throws PlanError saying, in plain words, what is wrong. */
export function validatePlan(raw: unknown): JournalPlan {
  const p = raw as Record<string, any>;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new PlanError('The plan is missing.');
  const title = clean(p.title);
  if (!title) throw new PlanError('The plan needs a title.');
  if (title.length > MAX_TITLE_CHARS) throw new PlanError(`The title can be at most ${MAX_TITLE_CHARS} characters.`);
  const intro = clean(p.intro) || null;
  if (intro && intro.length > MAX_INTRO_CHARS) throw new PlanError(`The introduction can be at most ${MAX_INTRO_CHARS} characters.`);
  if ((p.cadence ?? 'daily') !== 'daily') throw new PlanError('Plans are daily for now.');
  if (!Array.isArray(p.steps) || p.steps.length === 0) throw new PlanError('The plan needs at least one step.');
  if (p.steps.length > MAX_PLAN_PROMPTS) throw new PlanError(`A plan can have at most ${MAX_PLAN_PROMPTS} days of prompts.`);

  const prompt = (v: unknown, where: string) => {
    const text = clean(v);
    if (!text) throw new PlanError(`${where} needs a prompt.`);
    if (text.length > MAX_PROMPT_CHARS) throw new PlanError(`${where}: a prompt can be at most ${MAX_PROMPT_CHARS} characters.`);
    return text;
  };

  const steps: PlanStep[] = p.steps.map((s: any, i: number): PlanStep => {
    const where = `Step ${i + 1}`;
    if (s?.kind === 'repeat') {
      if (!Number.isInteger(s.days) || s.days < 1 || s.days > MAX_REPEAT_DAYS) {
        throw new PlanError(`${where}: choose between 1 and ${MAX_REPEAT_DAYS} days.`);
      }
      return { kind: 'repeat', days: s.days, prompt: prompt(s.prompt, where) };
    }
    if (s?.kind === 'sequence') {
      if (!Array.isArray(s.prompts) || s.prompts.length === 0) throw new PlanError(`${where} needs at least one prompt.`);
      if (s.prompts.length > MAX_PLAN_PROMPTS) throw new PlanError(`A plan can have at most ${MAX_PLAN_PROMPTS} days of prompts.`);
      return { kind: 'sequence', prompts: s.prompts.map((x: unknown, j: number) => prompt(x, `${where}, prompt ${j + 1}`)) };
    }
    throw new PlanError(`${where} is not a kind of step this plan understands.`);
  });

  if (planDays({ title, intro, steps, cadence: 'daily' }) > MAX_PLAN_PROMPTS) {
    throw new PlanError(`A plan can have at most ${MAX_PLAN_PROMPTS} days of prompts.`);
  }
  return { title, intro, steps, cadence: 'daily' };
}

/** How many days of prompts the plan delivers. */
export function planDays(plan: JournalPlan): number {
  return plan.steps.reduce((n, s) => n + (s.kind === 'repeat' ? s.days : s.prompts.length), 0);
}

/** A stored plan read back; null when there is none or it no longer passes (never thrown at a reader). */
export function storedPlan(raw: unknown): JournalPlan | null {
  if (raw === null || raw === undefined) return null;
  try {
    return validatePlan(raw);
  } catch {
    return null;
  }
}

/** HH:MM, 24-hour. */
export function validLocalTime(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** The reference Journal files this plan under, within her link to this practice. */
export const planRef = (bookingId: bigint) => `s${bookingId.toString()}`;

/** The booking a plan reference names, or null when it is not one of ours. */
export function bookingIdOfPlanRef(ref: unknown): bigint | null {
  return typeof ref === 'string' && /^s\d{1,19}$/.test(ref) ? BigInt(ref.slice(1)) : null;
}
