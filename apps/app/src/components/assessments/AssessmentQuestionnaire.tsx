import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import type { AssessmentDefinition } from '../../utils/assessments';

interface Props {
  assessment: AssessmentDefinition;
  color: string;
  firstName?: string | null;
  /** The practitioner's note to the client. */
  message?: string | null;
  /** Resolves when stored; rejects with a message to show. */
  onSubmit: (answers: Record<string, number>) => Promise<void>;
}

/** The questions, one card each, with a sticky send bar. Used by the emailed link and the portal. */
export function AssessmentQuestionnaire({ assessment, color, firstName, message, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = useMemo(() => Object.keys(answers).length, [answers]);

  async function submit() {
    const missing = assessment.items.find((item) => answers[item.id] === undefined);
    if (missing) {
      setError('Please answer every question.');
      document.getElementById(`q-${missing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(answers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your answers could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color }}>{assessment.shortName}</p>
        <h1 className="mt-1 text-[18px] font-bold text-[#0F172A]">
          {firstName ? `Hi ${firstName}, ` : ''}a few questions before we talk
        </h1>
        {message ? (
          <div className="mt-3 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">From your practitioner</p>
            <p className="mt-1 text-sm text-[#0F172A] whitespace-pre-line">{message}</p>
          </div>
        ) : null}
        <p className="mt-3 text-sm text-[#0F172A] leading-relaxed">{assessment.instructions}</p>
        <p className="mt-3 text-xs text-[#64748B] inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> About {assessment.estimatedMinutes} minutes · only your practitioner sees your answers
        </p>
      </div>

      <ol className="mt-4 space-y-3">
        {assessment.items.map((item, index) => (
          <li key={item.id} id={`q-${item.id}`} className="bg-white rounded-[18px] border border-[#E2E8F0] p-4">
            <fieldset>
              <legend className="text-sm font-semibold text-[#0F172A] leading-relaxed">
                <span className="text-[#94A3B8] mr-1.5">{index + 1}.</span>
                {item.text}
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {assessment.scale.map((choice) => {
                  const selected = answers[item.id] === choice.value;
                  return (
                    <label
                      key={choice.value}
                      className="flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-[13px] font-medium cursor-pointer transition-colors"
                      style={
                        selected
                          ? { borderColor: color, backgroundColor: `${color}12`, color: '#0F172A' }
                          : { borderColor: '#E2E8F0', color: '#334155' }
                      }
                    >
                      <input
                        type="radio"
                        name={item.id}
                        value={choice.value}
                        checked={selected}
                        onChange={() => setAnswers((current) => ({ ...current, [item.id]: choice.value }))}
                        className="h-4 w-4"
                        style={{ accentColor: color }}
                      />
                      {choice.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 mt-4 -mx-4 px-4 py-3 bg-[#F8FAFC]/95 backdrop-blur border-t border-[#E2E8F0]">
        {error ? <p role="alert" className="mb-2 text-sm font-medium text-rose-700">{error}</p> : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#475569]">{answered} of {assessment.items.length} answered</span>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="h-11 px-6 rounded-[12px] text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: color }}
          >
            {submitting ? 'Sending…' : 'Send my answers'}
          </button>
        </div>
      </div>
    </>
  );
}
