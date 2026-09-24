import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Lock, Send } from 'lucide-react';
import { Card, Eyebrow, useBrand, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';
import { PLAN_LABEL, severityStyle, type LibraryEntry, type PracticeAssignment } from '../../utils/assessments';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Standard assessments. These are the platform's validated instruments, the
 * same for every practice, so there is nothing to edit: a practice switches
 * the ones it uses on, sends them from a client's page, and follows them here.
 */
export function AssessmentsPage() {
  const toast = useToast();
  const brand = useBrand();
  const { profile } = useAuth();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const canManage = profile?.role === 'OWNER' || profile?.role === 'ADMIN';
  const clinical = canManage || profile?.role === 'THERAPIST';

  const [tab, setTab] = useState<'library' | 'sent'>('library');
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [sent, setSent] = useState<PracticeAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<LibraryEntry[]>('/v1/assessments/library')
      .then((lib) => {
        if (!cancelled) setLibrary(lib);
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
  }, []);

  useEffect(() => {
    if (tab !== 'sent' || sent || !clinical) return;
    api
      .get<PracticeAssignment[]>('/v1/assessments/assignments')
      .then(setSent)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not load sent assessments'));
  }, [tab, sent, clinical, toast]);

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

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">
      <header className="min-h-[72px] md:h-[88px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <Eyebrow>CLINICAL</Eyebrow>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Assessments</h1>
          <p className="hidden md:block text-xs text-[#64748B] font-medium">
            Standard, scored questionnaires. Switch on the ones you use, then send them from a client's page.
          </p>
        </div>
        {clinical ? (
          <div className="h-[40px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex gap-1 border border-[#E2E8F0] shrink-0">
            {(['library', 'sent'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 rounded-[10px] text-xs font-bold cursor-pointer ${tab === t ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}
              >
                {t === 'library' ? 'Library' : 'Sent'}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
        <div className="lg:col-span-7 space-y-3">
          {error ? (
            <div role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {tab === 'sent' ? (
            sent === null ? (
              <Card padding="p-[22px]"><p className="text-sm font-medium text-[#64748B]">Loading…</p></Card>
            ) : sent.length === 0 ? (
              <Card padding="p-[22px]"><p className="text-sm font-medium text-[#64748B]">Nothing sent yet. Open a client and choose the Assessments tab.</p></Card>
            ) : (
              <Card padding="p-0" className="overflow-hidden">
                {sent.map((a, i) => (
                  <Link
                    key={a.id}
                    to={`/dashboard/clients/${a.client.id}`}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] ${i ? 'border-t border-[#F1F5F9]' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-[#0F172A] truncate">{a.client.name} <span className="font-medium text-[#64748B]">· {a.shortName}</span></p>
                      <p className="text-[11.5px] text-[#94A3B8] font-medium">
                        Sent {date(a.sentAt)}{a.completedAt ? ` · answered ${date(a.completedAt)}` : ''}
                      </p>
                    </div>
                    {a.result?.hasFlags ? <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" aria-label="Needs attention" /> : null}
                    {a.result ? (
                      <span
                        className="text-[11px] font-bold rounded-full px-2.5 py-0.5 shrink-0"
                        style={{ backgroundColor: severityStyle(a.result.severityLevel).bg, color: severityStyle(a.result.severityLevel).fg }}
                      >
                        {a.result.totalScore} · {a.result.severity}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-[#FFFBEB] text-[#B45309] shrink-0">Waiting</span>
                    )}
                  </Link>
                ))}
              </Card>
            )
          ) : loading ? (
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
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">On</span>
                      ) : null}
                      {!entry.onPlan ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#92400E] bg-[#FEF3C7] rounded-full px-2 py-0.5">
                          {PLAN_LABEL[entry.tier]}
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
                  {canManage && entry.onPlan ? (
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
                      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: entry.enabled ? 22 : 2 }} />
                    </button>
                  ) : canManage ? (
                    <Link to="/dashboard/settings/subscription" className="text-xs font-bold shrink-0" style={{ color: primaryColor }}>
                      Upgrade to {PLAN_LABEL[entry.tier]}
                    </Link>
                  ) : null}
                </div>
                {preview === entry.key ? (
                  <div className="mt-3 border-t border-[#E2E8F0] pt-3">
                    <p className="text-xs text-[#475569] leading-relaxed">{entry.instructions}</p>
                    <ol className="mt-2 space-y-1 list-decimal pl-5 text-xs text-[#0F172A]">
                      {entry.items.map((item) => <li key={item.id}>{item.text}</li>)}
                    </ol>
                    <p className="mt-2 text-[11px] text-[#64748B]">Answers: {entry.scale.map((s) => s.label).join(' · ')}</p>
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
              Open a client from Clients and choose the <strong>Assessments</strong> tab. Add a note if you like: the client
              sees it with the questions, by email and in their portal. The result appears on their page with your analysis;
              the client sees a plain-language summary. A risky answer, like thoughts of self-harm, alerts you straight away.
            </p>
          </Card>

          <Card padding="p-[22px]">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#475569]" />
              <h2 className="text-[14px] font-bold text-[#0F172A]">Need another assessment?</h2>
            </div>
            <p className="mt-2 text-xs text-[#64748B] leading-relaxed">
              Tell us which one you use. We add validated instruments to the library for every practice.
            </p>
            <Link
              to="/dashboard/requests?type=ASSESSMENT"
              className="mt-3 inline-flex h-10 px-4 items-center rounded-[12px] text-white text-xs font-bold hover:brightness-110"
              style={{ backgroundColor: primaryColor }}
            >
              Request an assessment
            </Link>
          </Card>
        </div>
      </main>
    </div>
  );
}
