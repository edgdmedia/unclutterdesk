import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { api } from '../../utils/apiClient';
import type { AssessmentDefinition } from '../../utils/assessments';

interface Practice {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

type Opened =
  | { status: 'OPEN'; practice: Practice; firstName: string | null; message: string | null; assessment: AssessmentDefinition }
  | { status: 'COMPLETED' | 'EXPIRED'; practice: Practice };

/**
 * What a client sees when they open the link in their email. Branded as the
 * practice, and shows no score: results are for the clinician to interpret
 * with the client, not to deliver by web page.
 */
export function AssessmentPage() {
  const { token = '' } = useParams();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Opened>(`/v1/assessments/public/${encodeURIComponent(token)}`)
      .then((data) => {
        if (!cancelled) setOpened(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'This link could not be opened.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const color = opened?.practice.primaryColor || '#0F3A53';
  const assessment = opened?.status === 'OPEN' ? opened.assessment : null;
  const answered = useMemo(() => Object.keys(answers).length, [answers]);
  const total = assessment?.items.length ?? 0;

  async function submit() {
    if (!assessment) return;
    const missing = assessment.items.find((item) => answers[item.id] === undefined);
    if (missing) {
      setSubmitError('Please answer every question.');
      document.getElementById(`q-${missing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(`/v1/assessments/public/${encodeURIComponent(token)}`, { answers });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Your answers could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: ReactNode) => (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-[680px] mx-auto px-4 h-16 flex items-center gap-3">
          {opened?.practice.logoUrl ? (
            <img src={opened.practice.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: color }} aria-hidden />
          )}
          <span className="text-[15px] font-bold text-[#0F172A]">{opened?.practice.name ?? ''}</span>
        </div>
      </header>
      <main className="max-w-[680px] mx-auto px-4 py-6">{children}</main>
    </div>
  );

  const message = (title: string, body: string, icon = false) =>
    shell(
      <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 text-center">
        {icon ? <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color }} /> : null}
        <h1 className="text-[18px] font-bold text-[#0F172A]">{title}</h1>
        <p className="mt-2 text-sm text-[#475569] leading-relaxed">{body}</p>
      </div>,
    );

  if (loadError) return message('This link is not working', `${loadError} Ask your practitioner to send a new one.`);
  if (!opened) return shell(<p className="text-sm text-[#64748B]">Loading…</p>);
  if (done || opened.status === 'COMPLETED') {
    return message(
      'Thank you',
      `Your answers have gone to ${opened.practice.name}. Your practitioner will go through them with you.`,
      true,
    );
  }
  if (opened.status !== 'OPEN' || !assessment) {
    return message('This link has expired', `Ask ${opened.practice.name} to send you a new one.`);
  }

  return shell(
    <>
      <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color }}>{assessment.shortName}</p>
        <h1 className="mt-1 text-[18px] font-bold text-[#0F172A]">
          {opened.firstName ? `Hi ${opened.firstName}, ` : ''}a few questions before we talk
        </h1>
        {opened.message ? <p className="mt-2 text-sm text-[#475569] whitespace-pre-line">{opened.message}</p> : null}
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
                {assessment.scale.map((label, value) => {
                  const selected = answers[item.id] === value;
                  return (
                    <label
                      key={value}
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
                        value={value}
                        checked={selected}
                        onChange={() => setAnswers((current) => ({ ...current, [item.id]: value }))}
                        className="h-4 w-4"
                        style={{ accentColor: color }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 mt-4 -mx-4 px-4 py-3 bg-[#F8FAFC]/95 backdrop-blur border-t border-[#E2E8F0]">
        {submitError ? <p role="alert" className="mb-2 text-sm font-medium text-rose-700">{submitError}</p> : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#475569]">{answered} of {total} answered</span>
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
    </>,
  );
}
