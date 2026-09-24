import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Lock, Send } from 'lucide-react';
import { Card, Eyebrow, useBrand, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';
import { REQUEST_STATUS_LABEL, type AssessmentRequestRow, type LibraryEntry } from '../../utils/assessments';

const inputCls =
  'w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none focus:border-[#94A3B8]';
const labelCls = 'text-[11.5px] font-bold text-[#475569]';

/**
 * Standard assessments. These are the platform's validated instruments, the
 * same wording for every practice, so there is nothing to edit: a practice
 * switches the ones it uses on, and sends them from a client's page.
 */
export function AssessmentsPage() {
  const toast = useToast();
  const brand = useBrand();
  const { profile } = useAuth();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const canManage = profile?.role === 'OWNER' || profile?.role === 'ADMIN';

  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [requests, setRequests] = useState<AssessmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [requestName, setRequestName] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<LibraryEntry[]>('/v1/assessments/library'),
      canManage ? api.get<AssessmentRequestRow[]>('/v1/assessments/requests') : Promise.resolve([]),
    ])
      .then(([lib, reqs]) => {
        if (cancelled) return;
        setLibrary(lib);
        setRequests(reqs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load assessments.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  async function toggle(entry: LibraryEntry) {
    setBusyKey(entry.key);
    try {
      await api.post(`/v1/assessments/${entry.key}/${entry.enabled ? 'disable' : 'enable'}`, {});
      setLibrary((current) => current.map((e) => (e.key === entry.key ? { ...e, enabled: !e.enabled } : e)));
      toast.success(entry.enabled ? `${entry.shortName} switched off` : `${entry.shortName} is ready to send`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the assessment');
    } finally {
      setBusyKey(null);
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setRequesting(true);
    try {
      const created = await api.post<AssessmentRequestRow>('/v1/assessments/requests', {
        name: requestName,
        details: requestDetails || undefined,
      });
      setRequests((current) => [
        { details: requestDetails || null, adminNote: null, createdAt: new Date().toISOString(), ...created },
        ...current,
      ]);
      setRequestName('');
      setRequestDetails('');
      toast.success('Request sent. We will let you know when it is added.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the request');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">
      <header className="min-h-[72px] md:h-[88px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] py-3 flex items-center shrink-0">
        <div>
          <Eyebrow>CLINICAL</Eyebrow>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Assessments</h1>
          <p className="hidden md:block text-xs text-[#64748B] font-medium">
            Standard, scored questionnaires. Switch on the ones you use, then send them from a client's page.
          </p>
        </div>
      </header>

      <main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
        <div className="lg:col-span-7 space-y-3">
          {error ? (
            <div role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <Card padding="p-[22px]"><p className="text-sm font-medium text-[#64748B]">Loading assessments…</p></Card>
          ) : (
            library.map((entry) => (
              <Card key={entry.key} padding="p-[18px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-[#0F172A]">{entry.shortName}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] bg-[#F1F5F9] rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Standard
                      </span>
                      {entry.enabled ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                          On
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#475569]">{entry.name}</p>
                    <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                      {entry.measures} · {entry.items.length} questions · about {entry.estimatedMinutes} min
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreview(preview === entry.key ? null : entry.key)}
                      className="mt-2 text-xs font-bold cursor-pointer"
                      style={{ color: primaryColor }}
                    >
                      {preview === entry.key ? 'Hide questions' : 'See the questions'}
                    </button>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      disabled={busyKey === entry.key}
                      onClick={() => void toggle(entry)}
                      role="switch"
                      aria-checked={entry.enabled}
                      aria-label={`${entry.enabled ? 'Switch off' : 'Switch on'} ${entry.shortName}`}
                      className="relative h-6 w-11 rounded-full transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      style={{ backgroundColor: entry.enabled ? primaryColor : '#CBD5E1' }}
                    >
                      <span
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                        style={{ left: entry.enabled ? 22 : 2 }}
                      />
                    </button>
                  ) : null}
                </div>
                {preview === entry.key ? (
                  <div className="mt-3 border-t border-[#E2E8F0] pt-3">
                    <p className="text-xs text-[#475569] leading-relaxed">{entry.instructions}</p>
                    <ol className="mt-2 space-y-1 list-decimal pl-5 text-xs text-[#0F172A]">
                      {entry.items.map((item) => <li key={item.id}>{item.text}</li>)}
                    </ol>
                    <p className="mt-2 text-[11px] text-[#64748B]">Answers: {entry.scale.join(' · ')}</p>
                  </div>
                ) : null}
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card padding="p-[22px]">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[#475569]" />
              <h2 className="text-[14px] font-bold text-[#0F172A]">Sending one</h2>
            </div>
            <p className="mt-2 text-xs text-[#64748B] leading-relaxed">
              Open a client from Clients and choose <strong>Send assessment</strong>. They get a link by email, answer on
              their phone, and the scored result appears on their page. A risky answer, like thoughts of self-harm, alerts
              you straight away.
            </p>
          </Card>

          {canManage ? (
            <Card padding="p-[22px]">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-[#475569]" />
                <h2 className="text-[14px] font-bold text-[#0F172A]">Need another assessment?</h2>
              </div>
              <p className="mt-2 text-xs text-[#64748B] leading-relaxed">
                Tell us which instrument you use. We add validated ones to the library for every practice.
              </p>
              <form onSubmit={submitRequest} className="mt-3 space-y-3">
                <label className="block space-y-1.5">
                  <span className={labelCls}>Assessment</span>
                  <input className={inputCls} value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="e.g. EPDS, AUDIT, ORS" required />
                </label>
                <label className="block space-y-1.5">
                  <span className={labelCls}>Anything we should know (optional)</span>
                  <textarea
                    className={`${inputCls} h-auto min-h-[80px] py-2.5`}
                    value={requestDetails}
                    onChange={(e) => setRequestDetails(e.target.value)}
                    placeholder="Who you use it with, or a link to the published version"
                  />
                </label>
                <button
                  type="submit"
                  disabled={requesting || requestName.trim().length < 2}
                  className="h-10 px-4 rounded-[12px] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {requesting ? 'Sending…' : 'Send request'}
                </button>
              </form>
              {requests.length ? (
                <ul className="mt-4 border-t border-[#E2E8F0] pt-3 space-y-2">
                  {requests.map((r) => (
                    <li key={r.id} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F172A]">{r.name}</span>
                        <span className="font-bold text-[#475569]">{REQUEST_STATUS_LABEL[r.status]}</span>
                      </div>
                      {r.adminNote ? <p className="mt-0.5 text-[#64748B]">{r.adminNote}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
