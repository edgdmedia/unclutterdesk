import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Star } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

type ReviewField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type ReviewForm = {
  id: string;
  title: string;
  description: string | null;
  targetType: string;
  schemaJson: ReviewField[];
};

export function PublicReviewFormPage() {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const secondaryColor = brand.secondaryColor || '#E3B341';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadForms() {
      setLoading(true);
      setError(null);
      try {
        const forms = await api.get<ReviewForm[]>('/v1/intake/public/forms?targetType=REVIEW');
        if (cancelled) return;
        const firstForm = forms[0] || null;
        setForm(firstForm);
        if (firstForm) {
          const initialAnswers = firstForm.schemaJson.reduce<Record<string, string | string[]>>((acc, field) => {
            acc[field.id] = field.type === 'multiple_choice' ? [] : '';
            return acc;
          }, {});
          setAnswers(initialAnswers);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load review form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForms();
    return () => {
      cancelled = true;
    };
  }, []);

  function setAnswer(fieldId: string, value: string | string[]) {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
  }

  async function handleSubmit() {
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/v1/intake/public/submissions', {
        formId: form.id,
        clientName: fullName,
        clientEmail: email,
        answersJson: answers,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  const isDisabled = !form || !fullName.trim() || !email.trim();

  return (
    <div className="min-h-screen bg-[var(--desk-surface-alt)] text-[var(--desk-text)] font-outfit flex justify-center px-6 py-10">
      <div className="w-full max-w-[860px] rounded-[32px] border border-[var(--desk-border)] bg-white shadow-[0_24px_70px_rgba(15,23,42,.08)] overflow-hidden">
        <div
          className="border-b px-8 py-8"
          style={{
            background: `linear-gradient(120deg, ${primaryColor}14, ${secondaryColor}22)`,
            borderColor: `${primaryColor}33`,
          }}
        >
          <Link to="/book" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--desk-text-body)] hover:text-[var(--desk-text)]">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to practice page</span>
          </Link>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-12 w-12 rounded-[16px] bg-white shadow-sm flex items-center justify-center text-amber-500">
              <Star className="h-6 w-6 fill-current" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primaryColor }}>PUBLIC REVIEW</div>
              <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-[var(--desk-text)]">Share your experience with the practice</h1>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          {loading ? (
            <div className="rounded-[18px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-5 py-8 text-sm font-medium text-[var(--desk-text-muted)]">Loading review form...</div>
          ) : error ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
          ) : !form ? (
            <div className="rounded-[18px] border border-dashed border-[var(--desk-pine-200)] bg-[var(--desk-surface)] px-5 py-8 text-sm font-medium text-[var(--desk-text-muted)]">
              This practice has not published a review form yet.
            </div>
          ) : submitted ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h2 className="mt-4 text-[22px] font-bold text-[var(--desk-text)]">Thank you for your feedback</h2>
              <p className="mt-2 text-sm font-medium text-[var(--desk-text-body)]">
                Your review has been submitted. If this practice requires approval, it will appear on the landing page once approved.
              </p>
              <Link
                to="/book"
                className="mt-5 inline-flex h-[44px] items-center justify-center rounded-[14px] px-5 text-sm font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Return to practice page
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--desk-text)]">{form.title}</h2>
                <p className="mt-2 text-sm font-medium text-[var(--desk-text-muted)]">{form.description || 'Tell this practice what stood out about your experience.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-bold text-[var(--desk-text-body)]">Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full h-[46px] px-3.5 rounded-[14px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-[14px] font-medium text-[var(--desk-text)] outline-none focus:bg-white focus:border-[var(--desk-border-strong)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-bold text-[var(--desk-text-body)]">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full h-[46px] px-3.5 rounded-[14px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-[14px] font-medium text-[var(--desk-text)] outline-none focus:bg-white focus:border-[var(--desk-border-strong)]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {form.schemaJson.map((field, fieldIndex) => (
                  <div key={field.id} className="rounded-[20px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-5 py-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">Question {fieldIndex + 1}</div>
                    <label className="mt-2 block text-[15px] font-bold text-[var(--desk-text)]">{field.label}</label>

                    {(field.type === 'scale' || field.type === 'LIKERT') && (
                      <div className="mt-4 grid grid-cols-5 gap-2">
                        {(field.options && field.options.length > 0 ? field.options : ['1', '2', '3', '4', '5']).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setAnswer(field.id, option)}
                            className={`h-[44px] rounded-[14px] border text-sm font-bold ${answers[field.id] === option ? 'border-[var(--desk-pine-600)] bg-[var(--desk-pine-600)] text-white' : 'border-[var(--desk-border)] bg-white text-[var(--desk-text)]'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={5}
                        value={typeof answers[field.id] === 'string' ? answers[field.id] : ''}
                        onChange={(event) => setAnswer(field.id, event.target.value)}
                        className="mt-4 w-full rounded-[16px] border border-[var(--desk-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--desk-text)] outline-none"
                      />
                    )}

                    {field.type === 'text' && (
                      <input
                        type="text"
                        value={typeof answers[field.id] === 'string' ? answers[field.id] : ''}
                        onChange={(event) => setAnswer(field.id, event.target.value)}
                        className="mt-4 w-full h-[46px] rounded-[14px] border border-[var(--desk-border)] bg-white px-4 text-sm font-medium text-[var(--desk-text)] outline-none"
                      />
                    )}

                    {field.type === 'single_choice' && (
                      <div className="mt-4 grid gap-2">
                        {(field.options || []).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setAnswer(field.id, option)}
                            className={`h-[44px] rounded-[14px] border px-4 text-left text-sm font-bold ${answers[field.id] === option ? 'border-[var(--desk-pine-600)] bg-[var(--desk-pine-100)] text-[var(--desk-pine-600)]' : 'border-[var(--desk-border)] bg-white text-[var(--desk-text)]'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}

                    {field.type === 'multiple_choice' && (
                      <div className="mt-4 grid gap-2">
                        {(field.options || []).map((option) => {
                          const values = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : [];
                          const selected = values.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                const next = selected ? values.filter((value) => value !== option) : [...values, option];
                                setAnswer(field.id, next);
                              }}
                              className={`h-[44px] rounded-[14px] border px-4 text-left text-sm font-bold ${selected ? 'border-[var(--desk-pine-600)] bg-[var(--desk-pine-100)] text-[var(--desk-pine-600)]' : 'border-[var(--desk-border)] bg-white text-[var(--desk-text)]'}`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={isDisabled || submitting}
                onClick={() => void handleSubmit()}
                className="h-[50px] rounded-[16px] px-6 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? 'Submitting review...' : 'Submit review'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
