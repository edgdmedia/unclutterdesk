import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import {
  MAX_INTRO_CHARS,
  MAX_PLAN_DAYS,
  MAX_PROMPT_CHARS,
  MAX_REPEAT_DAYS,
  MAX_TITLE_CHARS,
  emptyPlan,
  planDays,
  stepsFromRecap,
  type JournalPlan,
  type PlanStep,
} from './journalPlan';

interface SharedEntry {
  id: string;
  promptText: string | null;
  content: string | null;
  writtenAt: string;
  updatedAt: string;
  sharedAt: string;
  withdrawnAt: string | null;
}

type JournalView =
  | { available: false }
  | {
      available: true;
      plan: JournalPlan | null;
      addedAt: string | null;
      deliveryTime: string | null;
      link: { profileName: string | null; since: string } | null;
      progress: { status: string; total: number; delivered: number; responded: number; lastRespondedAt: string | null; nextDeliveryAt: string | null } | null;
      syncError: string | null;
      shared: SharedEntry[];
    };

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const field = 'w-full px-3 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[13.5px] text-[var(--desk-text)] outline-none focus:border-[var(--desk-pine-600)]';
const label = 'text-[11.5px] font-bold text-slate-500 uppercase';
const quiet = 'h-[34px] px-3 rounded-[10px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50';

/**
 * The session's Journal plan (docs/design/journal-integration.md): a daily
 * practice the client adds to her own Unclutter Journal from her recap.
 * Clinical staff only; hidden unless the practice has Journal switched on.
 * Shows how far she has got and the entries she chooses to share.
 */
export function JournalPlanPanel({ bookingId, clientFirstName, recap }: { bookingId: string; clientFirstName: string; recap: string }) {
  const toast = useToast();
  const [view, setView] = useState<JournalView | null>(null);
  const [plan, setPlan] = useState<JournalPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const v = await api.get<JournalView>(`/v1/consult/practice/sessions/${bookingId}/journal`);
    setView(v);
    if (v.available) setPlan(v.plan);
  }

  useEffect(() => {
    load().catch(() => setView({ available: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (!view || !view.available) return null;
  const who = view.link?.profileName || clientFirstName || 'The client';
  const days = plan ? planDays(plan.steps) : 0;

  function change(next: Partial<JournalPlan>) {
    setPlan((p) => ({ ...(p ?? emptyPlan()), ...next }));
    setError(null);
  }
  function setStep(i: number, step: PlanStep) {
    if (!plan) return;
    change({ steps: plan.steps.map((s, j) => (j === i ? step : s)) });
  }

  async function save(next: JournalPlan | null) {
    setBusy(true);
    setError(null);
    try {
      const out = await api.put<{ syncError: string | null }>(`/v1/consult/practice/sessions/${bookingId}/journal-plan`, { plan: next });
      await load();
      if (out.syncError) toast.error(out.syncError);
      else toast.success(next ? 'Journal plan saved' : 'Journal plan removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The plan was not saved.');
    } finally {
      setBusy(false);
    }
  }

  function fromRecap() {
    const steps = stepsFromRecap(recap);
    if (!steps.length) {
      setError('The recap has no tick-box items to use yet.');
      return;
    }
    change({ steps, title: plan?.title || 'Your practice after our session' });
  }

  return (
    <Card padding="p-[22px]" className="space-y-4">
      <div className="flex items-start gap-3">
        <BookOpen className="h-5 w-5 text-[var(--desk-pine-600)] shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-1 min-w-0">
          <Eyebrow>JOURNAL PLAN</Eyebrow>
          <p className="text-[12.5px] text-[var(--desk-text-muted)] leading-relaxed">
            A daily practice, one prompt a day, in {who}’s own Unclutter Journal. Nothing is sent until {who} adds it from the recap.
          </p>
        </div>
      </div>

      <Status view={view} who={who} />

      {plan ? (
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className={label}>Title</span>
            <input className={`${field} h-[40px]`} value={plan.title} maxLength={MAX_TITLE_CHARS} onChange={(e) => change({ title: e.target.value })} placeholder="Reflection practice after our session" />
          </label>
          <label className="block space-y-1.5">
            <span className={label}>Introduction (optional, shown once)</span>
            <textarea className={`${field} py-2 min-h-[64px]`} value={plan.intro ?? ''} maxLength={MAX_INTRO_CHARS} onChange={(e) => change({ intro: e.target.value || null })} />
          </label>

          <ol className="space-y-2.5">
            {plan.steps.map((step, i) => (
              <li key={i} className="rounded-[14px] border border-[var(--desk-border)] p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-bold text-[var(--desk-text)]">Step {i + 1}</span>
                  <select
                    aria-label={`Step ${i + 1} kind`}
                    className={`${field} h-[34px] w-auto`}
                    value={step.kind}
                    onChange={(e) =>
                      setStep(i, e.target.value === 'repeat'
                        ? { kind: 'repeat', days: 5, prompt: step.kind === 'sequence' ? step.prompts[0] ?? '' : step.prompt }
                        : { kind: 'sequence', prompts: [step.kind === 'repeat' ? step.prompt : ''] })
                    }
                  >
                    <option value="repeat">The same prompt for several days</option>
                    <option value="sequence">A different prompt each day</option>
                  </select>
                  {plan.steps.length > 1 ? (
                    <button type="button" className={`${quiet} ml-auto`} aria-label={`Remove step ${i + 1}`} onClick={() => change({ steps: plan.steps.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                {step.kind === 'repeat' ? (
                  <>
                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--desk-text)]">
                      For
                      <input
                        type="number"
                        min={1}
                        max={MAX_REPEAT_DAYS}
                        aria-label={`Step ${i + 1} days`}
                        className={`${field} h-[34px] w-[72px]`}
                        value={step.days}
                        onChange={(e) => setStep(i, { ...step, days: Math.max(1, Math.min(MAX_REPEAT_DAYS, Number(e.target.value) || 1)) })}
                      />
                      days
                    </label>
                    <textarea
                      aria-label={`Step ${i + 1} prompt`}
                      className={`${field} py-2 min-h-[56px]`}
                      maxLength={MAX_PROMPT_CHARS}
                      value={step.prompt}
                      placeholder="Sit quietly for ten minutes. What did you notice?"
                      onChange={(e) => setStep(i, { ...step, prompt: e.target.value })}
                    />
                  </>
                ) : (
                  <div className="space-y-1.5">
                    {step.prompts.map((p, j) => (
                      <div key={j} className="flex gap-2 items-start">
                        <span className="text-[11.5px] text-[var(--desk-text-muted)] font-bold pt-2.5 w-[42px] shrink-0">Day {j + 1}</span>
                        <textarea
                          aria-label={`Step ${i + 1} prompt ${j + 1}`}
                          className={`${field} py-2 min-h-[44px]`}
                          maxLength={MAX_PROMPT_CHARS}
                          value={p}
                          onChange={(e) => setStep(i, { ...step, prompts: step.prompts.map((x, k) => (k === j ? e.target.value : x)) })}
                        />
                        {step.prompts.length > 1 ? (
                          <button type="button" className={quiet} aria-label={`Remove prompt ${j + 1}`} onClick={() => setStep(i, { ...step, prompts: step.prompts.filter((_, k) => k !== j) })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button type="button" className={quiet} disabled={days >= MAX_PLAN_DAYS} onClick={() => setStep(i, { ...step, prompts: [...step.prompts, ''] })}>
                      <Plus className="h-3.5 w-3.5" /> Add a day
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className={quiet} disabled={days >= MAX_PLAN_DAYS} onClick={() => change({ steps: [...plan.steps, { kind: 'sequence', prompts: [''] }] })}>
              <Plus className="h-3.5 w-3.5" /> Add a step
            </button>
            <button type="button" className={quiet} onClick={fromRecap}>
              <Wand2 className="h-3.5 w-3.5" /> Use the recap’s tick-box items
            </button>
            <span className={`text-[12px] font-semibold ${days > MAX_PLAN_DAYS ? 'text-rose-700' : 'text-[var(--desk-text-muted)]'}`}>
              {days} {days === 1 ? 'day' : 'days'}, one prompt a day{days > MAX_PLAN_DAYS ? ` (at most ${MAX_PLAN_DAYS})` : ''}
            </span>
          </div>

          {error ? <p role="alert" className="text-[12px] font-semibold text-rose-700">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(plan)}
              className="h-[38px] px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {view.addedAt ? `Save and update ${who}’s Journal` : 'Save plan'}
            </button>
            {view.plan ? (
              <button type="button" disabled={busy} onClick={() => void save(null)} className="h-[38px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12.5px] font-bold cursor-pointer disabled:opacity-50">
                {view.addedAt ? `Remove, and end it in ${who}’s Journal` : 'Remove plan'}
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => setPlan(null)} className="h-[38px] px-4 rounded-[12px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12.5px] font-bold cursor-pointer disabled:opacity-50">
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={quiet} onClick={() => setPlan(emptyPlan())}>
            <Plus className="h-3.5 w-3.5" /> Write a Journal plan
          </button>
          <button type="button" className={quiet} onClick={fromRecap}>
            <Wand2 className="h-3.5 w-3.5" /> Start from the recap’s tick-box items
          </button>
          {error ? <p role="alert" className="w-full text-[12px] font-semibold text-rose-700">{error}</p> : null}
        </div>
      )}

      <SharedEntries entries={view.shared} who={who} />
    </Card>
  );
}

function Status({ view, who }: { view: Extract<JournalView, { available: true }>; who: string }) {
  const p = view.progress;
  let text: string;
  if (view.addedAt) {
    text = `In ${who}’s Journal since ${day(view.addedAt)}, prompt at ${view.deliveryTime ?? '08:00'}.`;
    if (p) text += ` ${p.responded} of ${p.total} days answered${p.lastRespondedAt ? `, last on ${day(p.lastRespondedAt)}` : ''}.`;
    if (p?.status === 'completed') text += ' The plan has finished.';
  } else if (view.link) {
    text = view.plan ? `${who}’s Journal is connected. ${who} has not added this plan yet.` : `${who}’s Journal is connected.`;
  } else {
    text = view.plan ? `${who} adds it from the recap page, once the recap is sent.` : '';
  }
  return (
    <>
      {text ? <p className="text-[12.5px] font-semibold text-[var(--desk-text)]" aria-live="polite">{text}</p> : null}
      {view.syncError ? (
        <p className="text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2">
          {view.syncError} What is shown is from the last time Desk could reach it.
        </p>
      ) : null}
    </>
  );
}

function SharedEntries({ entries, who }: { entries: SharedEntry[]; who: string }) {
  if (!entries.length) return null;
  return (
    <div className="space-y-2 border-t border-[var(--desk-border)] pt-3">
      <div className={label}>Shared by {who} (clinical staff only)</div>
      <ul className="space-y-2">
        {entries.map((e) =>
          e.withdrawnAt ? (
            <li key={e.id} className="text-[12px] text-[var(--desk-text-muted)] italic">
              An entry shared on {day(e.sharedAt)} was withdrawn on {day(e.withdrawnAt)}.
            </li>
          ) : (
            <li key={e.id} className="rounded-[12px] bg-[var(--desk-surface)] border border-[var(--desk-border)] px-3.5 py-2.5 space-y-1">
              {e.promptText ? <p className="text-[12px] font-semibold text-[var(--desk-text-muted)]">{e.promptText}</p> : null}
              <p className="text-[13.5px] text-[var(--desk-text)] whitespace-pre-line leading-relaxed">{e.content}</p>
              <p className="text-[11px] text-[var(--desk-text-muted)]">Written {day(e.writtenAt)}{e.updatedAt !== e.writtenAt ? `, edited ${day(e.updatedAt)}` : ''}</p>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
