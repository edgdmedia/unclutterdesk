import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import { Card, Eyebrow, useBrand, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import {
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
  type PlatformRequestRow,
  type RequestType,
} from '../../utils/assessments';

const TYPES: RequestType[] = ['FEATURE', 'ASSESSMENT', 'SERVICE', 'FEEDBACK', 'OTHER'];

const PLACEHOLDER: Record<RequestType, { subject: string; details: string }> = {
  ASSESSMENT: { subject: 'e.g. EPDS, AUDIT, ORS', details: 'Who you use it with, or a link to the published version' },
  FEATURE: { subject: 'e.g. Group sessions', details: 'What you want to do, and what gets in the way today' },
  SERVICE: { subject: 'e.g. Help setting up my booking page', details: 'What you need from us' },
  FEEDBACK: { subject: 'e.g. Booking was confusing for a client', details: 'What happened, or what you like and dislike' },
  OTHER: { subject: 'A short title', details: 'Tell us more' },
};

const inputCls =
  'w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none focus:border-[#94A3B8]';
const labelCls = 'text-[11.5px] font-bold text-[#475569]';

/** Ask Unclutter Desk for something (a feature, an assessment, a service) or send feedback, and follow it. */
export function RequestsPage() {
  const toast = useToast();
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const [params] = useSearchParams();
  const initialType = (TYPES as string[]).includes(params.get('type') ?? '') ? (params.get('type') as RequestType) : 'FEATURE';

  const [type, setType] = useState<RequestType>(initialType);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState<PlatformRequestRow[] | null>(null);

  useEffect(() => {
    api
      .get<PlatformRequestRow[]>('/v1/requests')
      .then(setRequests)
      .catch(() => setRequests([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const created = await api.post<PlatformRequestRow>('/v1/requests', { type, subject, details: details || undefined });
      setRequests((current) => [created, ...(current ?? [])]);
      setSubject('');
      setDetails('');
      toast.success('Sent. We will let you know when it moves.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your request');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">
      <header className="min-h-[72px] md:h-[88px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] py-3 flex items-center shrink-0">
        <div>
          <Eyebrow>HELP</Eyebrow>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Requests & feedback</h1>
          <p className="hidden md:block text-xs text-[#64748B] font-medium">
            Ask us for a feature, an assessment or a service, or tell us what you think.
          </p>
        </div>
      </header>

      <main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
        <Card padding="p-[22px]" className="lg:col-span-6">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-[#475569]" />
            <h2 className="text-[14px] font-bold text-[#0F172A]">New request</h2>
          </div>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of request">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => setType(t)}
                  className="h-8 px-3 rounded-full border text-xs font-bold cursor-pointer"
                  style={type === t ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' } : { borderColor: '#E2E8F0', color: '#475569' }}
                >
                  {REQUEST_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className={labelCls}>Title</span>
              <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={PLACEHOLDER[type].subject} maxLength={160} required />
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Details (optional)</span>
              <textarea
                className={`${inputCls} h-auto min-h-[110px] py-2.5`}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={PLACEHOLDER[type].details}
              />
            </label>
            <button
              type="submit"
              disabled={sending || subject.trim().length < 2}
              className="h-10 px-4 rounded-[12px] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </Card>

        <Card padding="p-[22px]" className="lg:col-span-6">
          <h2 className="text-[14px] font-bold text-[#0F172A]">Your requests</h2>
          {requests === null ? (
            <p className="mt-3 text-sm text-[#64748B]">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="mt-3 text-sm text-[#64748B]">Nothing yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#F1F5F9]">
              {requests.map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#0F172A]">{r.subject}</span>
                    <span className="text-[11px] font-bold text-[#475569] bg-[#F1F5F9] rounded-full px-2 py-0.5 shrink-0">{REQUEST_STATUS_LABEL[r.status]}</span>
                  </div>
                  <p className="text-[11.5px] text-[#94A3B8] font-medium">
                    {REQUEST_TYPE_LABEL[r.type]} · {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {r.adminNote ? <p className="mt-1 text-xs text-[#334155]"><strong>Unclutter Desk:</strong> {r.adminNote}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
