import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';

type Field = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  text?: string;
};

type Form = {
  id: string;
  title: string;
  description: string | null;
  schemaJson: Field[];
};

const INPUT = 'w-full h-11 px-3.5 rounded-[12px] border border-[#CBD5E1] bg-white text-[14px] outline-none focus:border-[#0F3A53]';
const LABEL = 'block text-[13.5px] font-bold text-[#0F172A] mb-1.5';

/** A form the practice asked the client to complete (BKG-06), on the practice host. */
export function ClientFormPage() {
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const bookingId = search.get('booking') ?? undefined;
  const brand = useBrand();
  const { profile } = useAuth();
  const primaryColor = brand.primaryColor || '#0F3A53';

  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Form[]>('/v1/intake/public/forms')
      .then((forms) => {
        if (cancelled) return;
        const found = forms.find((f) => f.id === id) ?? null;
        setForm(found);
        if (!found) setError('This form could not be found. It may have been retired by the practice.');
        else {
          setAnswers(
            found.schemaJson.reduce<Record<string, string | string[]>>((acc, field) => {
              if (field.type !== 'text_block') acc[field.id] = field.type === 'multiple_choice' ? [] : '';
              return acc;
            }, {}),
          );
        }
      })
      .catch(() => !cancelled && setError('The form could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const answerable = useMemo(() => (form?.schemaJson ?? []).filter((f) => f.type !== 'text_block'), [form]);

  function set(fieldId: string, value: string | string[]) {
    setAnswers((a) => ({ ...a, [fieldId]: value }));
  }

  async function submit() {
    if (!form) return;
    const missing = answerable.find((f) => f.required && (Array.isArray(answers[f.id]) ? answers[f.id].length === 0 : !answers[f.id]));
    if (missing) {
      setError(`Please answer “${missing.label}”.`);
      document.getElementById(`f-${missing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/v1/intake/public/submissions', {
        formId: form.id,
        bookingId,
        clientProfileId: profile?.id,
        clientEmail: profile?.email,
        answersJson: answers,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your answers could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const back = (
    <Link to="/portal" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#475569]">
      <ArrowLeft className="h-3.5 w-3.5" /> My bookings
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#FCFDFE] text-[#0F172A] font-outfit flex justify-center px-4 py-8">
      <div className="w-full max-w-[640px]">
        {back}
        <div className="mt-4 bg-white border border-[#E2E8F0] rounded-[24px] p-6 space-y-5">
          {!form && !error ? <p className="text-sm text-[#64748B]">Loading…</p> : null}
          {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
          {done ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-10 w-10 mx-auto text-[#16A34A]" />
              <h1 className="text-xl font-bold">Thank you — that’s saved.</h1>
              <p className="text-sm text-[#64748B]">The practice has been told it arrived.</p>
            </div>
          ) : form ? (
            <>
              <div>
                <h1 className="text-[20px] font-bold tracking-[-0.02em]">{form.title}</h1>
                {form.description ? <p className="mt-1 text-[13.5px] text-[#64748B]">{form.description}</p> : null}
              </div>
              {profile ? null : (
                <p className="text-[13px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-[12px] px-3.5 py-2.5">
                  <a href="/login" className="font-bold underline">Sign in</a> first, so the practice knows whose answers these are.
                </p>
              )}
              {form.schemaJson.map((field) => {
                if (field.type === 'text_block') {
                  return (
                    <div key={field.id} className="rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3.5">
                      <p className="text-[13px] font-bold">{field.label}</p>
                      <p className="mt-1 text-[13.5px] leading-[1.55] text-[#475569]">{field.text}</p>
                    </div>
                  );
                }
                return (
                  <div key={field.id} id={`f-${field.id}`}>
                    <label className={LABEL} htmlFor={`i-${field.id}`}>
                      {field.label}
                      {field.required ? <span className="text-red-500"> *</span> : null}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea id={`i-${field.id}`} rows={4} className={INPUT + ' h-auto py-2.5'} value={String(answers[field.id] ?? '')} onChange={(e) => set(field.id, e.target.value)} />
                    ) : field.type === 'single_choice' ? (
                      <div className="space-y-1.5">
                        {(field.options ?? []).map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-[14px] cursor-pointer">
                            <input type="radio" name={field.id} value={opt} checked={answers[field.id] === opt} onChange={() => set(field.id, opt)} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'multiple_choice' ? (
                      <div className="space-y-1.5">
                        {(field.options ?? []).map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-[14px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Array.isArray(answers[field.id]) && (answers[field.id] as string[]).includes(opt)}
                              onChange={(e) => {
                                const list = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : [];
                                set(field.id, e.target.checked ? [...list, opt] : list.filter((x) => x !== opt));
                              }}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        id={`i-${field.id}`}
                        type={field.type === 'signature' ? 'text' : 'text'}
                        placeholder={field.type === 'signature' ? 'Type your full name to sign' : undefined}
                        className={INPUT}
                        value={String(answers[field.id] ?? '')}
                        onChange={(e) => set(field.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="h-12 w-full rounded-[14px] text-white text-[14.5px] font-bold cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ClientFormPage;
