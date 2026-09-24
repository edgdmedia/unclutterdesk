import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Copy, Send, X } from 'lucide-react';
import { Card, useToast } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';
import {
  severityStyle,
  type AssessmentResultRow,
  type LibraryEntry,
  type PendingAssessment,
} from '../utils/assessments';

interface Props {
  clientId: string;
  clientName: string;
  primaryColor: string;
}

/** A score over time, oldest to newest, scaled to the instrument's maximum. */
function Trend({ points, max, color }: { points: number[]; max: number; color: string }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 32;
  const step = w / (points.length - 1);
  const y = (v: number) => h - 2 - (v / Math.max(max, 1)) * (h - 4);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`Scores over time: ${points.join(', ')}`} role="img">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((v, i) => <circle key={i} cx={i * step} cy={y(v)} r={2.5} fill={color} />)}
    </svg>
  );
}

function Badge({ level, children }: { level: number; children: ReactNode }) {
  const s = severityStyle(level);
  return (
    <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ backgroundColor: s.bg, color: s.fg }}>
      {children}
    </span>
  );
}

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function ClientAssessmentsPanel({ clientId, clientName, primaryColor }: Props) {
  const toast = useToast();
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [results, setResults] = useState<AssessmentResultRow[]>([]);
  const [pending, setPending] = useState<PendingAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [lib, data] = await Promise.all([
        api.get<LibraryEntry[]>('/v1/assessments/library'),
        api.get<{ results: AssessmentResultRow[]; pending: PendingAssessment[] }>(`/v1/assessments/clients/${clientId}/results`),
      ]);
      setLibrary(lib);
      setResults(data.results);
      setPending(data.pending);
      setError(null);
      setChoice((current) => current || lib.find((e) => e.enabled)?.key || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assessments.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabled = library.filter((e) => e.enabled);
  const itemText = useMemo(
    () => Object.fromEntries(library.flatMap((e) => e.items.map((i) => [i.id, i.text]))),
    [library],
  );
  const scaleFor = (key: string) => library.find((e) => e.key === key)?.scale ?? [];

  // Newest result per instrument, with its history for the trend line.
  const byInstrument = useMemo(() => {
    const groups = new Map<string, AssessmentResultRow[]>();
    for (const r of results) groups.set(r.instrumentKey, [...(groups.get(r.instrumentKey) ?? []), r]);
    return [...groups.values()].map((rows) => ({ latest: rows[rows.length - 1], history: rows }));
  }, [results]);

  async function send() {
    if (!choice) return;
    setSending(true);
    setFallbackLink(null);
    try {
      const sent = await api.post<{ emailSent: boolean; link: string; instrumentKey: string; id: string; expiresAt: string }>(
        '/v1/assessments/assignments',
        { instrumentKey: choice, clientProfileId: clientId, message: note || undefined },
      );
      const name = library.find((e) => e.key === choice)?.shortName ?? choice;
      if (sent.emailSent) {
        toast.success(`${name} sent to ${clientName}`);
      } else {
        setFallbackLink(sent.link);
        toast.error('The email did not go out. Copy the link below and send it another way.');
      }
      setNote('');
      setPending((current) => [
        { id: sent.id, instrumentKey: sent.instrumentKey, shortName: name, sentAt: new Date().toISOString(), expiresAt: sent.expiresAt },
        ...current,
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the assessment');
    } finally {
      setSending(false);
    }
  }

  async function cancel(p: PendingAssessment) {
    try {
      await api.post(`/v1/assessments/assignments/${p.id}/cancel`, {});
      setPending((current) => current.filter((x) => x.id !== p.id));
      toast.success(`${p.shortName} link cancelled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  if (loading) {
    return <Card padding="p-[24px_26px]"><p className="text-xs font-semibold text-slate-400">Loading assessments…</p></Card>;
  }
  if (error) {
    return <Card padding="p-[24px_26px]"><p role="alert" className="text-sm font-medium text-rose-700">{error}</p></Card>;
  }

  return (
    <div className="space-y-4">
      <Card padding="p-[20px_24px]" className="bg-white border border-slate-100 shadow-sm rounded-2xl">
        {enabled.length === 0 ? (
          <p className="text-sm text-[#475569]">
            No assessments are switched on yet.{' '}
            <Link to="/dashboard/assessments" className="font-bold" style={{ color: primaryColor }}>Choose which ones to use</Link>.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1.5">
              <span className="text-[11.5px] font-bold text-[#475569] block">Send assessment</span>
              <select
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="h-[40px] px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A]"
              >
                {enabled.map((e) => <option key={e.key} value={e.key}>{e.shortName} · {e.measures}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 flex-1 min-w-[220px]">
              <span className="text-[11.5px] font-bold text-[#475569] block">Note to the client (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Please fill this in before our next session."
                className="w-full h-[40px] px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A]"
              />
            </label>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !choice}
              className="h-[40px] px-4 rounded-[12px] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              <Send className="h-3.5 w-3.5" /> {sending ? 'Sending…' : 'Send by email'}
            </button>
          </div>
        )}
        {fallbackLink ? (
          <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-[#FFFBEB] border border-amber-200 px-3 py-2">
            <code className="text-[11px] text-[#92400E] truncate flex-1">{fallbackLink}</code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(fallbackLink).then(() => toast.success('Link copied'))}
              className="text-xs font-bold text-[#92400E] flex items-center gap-1 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        ) : null}
        {pending.length ? (
          <ul className="mt-4 border-t border-[#E2E8F0] pt-3 space-y-1.5">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">
                  <strong className="text-[#0F172A]">{p.shortName}</strong> sent {date(p.sentAt)}, waiting for answers
                </span>
                <button type="button" onClick={() => void cancel(p)} className="text-[#64748B] hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {byInstrument.length === 0 ? (
        <Card padding="p-[24px_26px]" className="text-center text-slate-400 text-xs font-semibold bg-white border border-slate-100 shadow-sm rounded-2xl">
          No completed assessments yet.
        </Card>
      ) : (
        byInstrument.map(({ latest, history }) => (
          <Card key={latest.instrumentKey} padding="p-[20px_24px]" className="bg-white border border-slate-100 shadow-sm rounded-2xl space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-bold text-[#0F172A]">{latest.shortName}</h3>
                  <Badge level={latest.severityLevel}>{latest.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-[#64748B]">
                  Latest {latest.totalScore}{latest.maxScore ? ` / ${latest.maxScore}` : ''} on {date(latest.completedAt)}
                  {history.length > 1 ? ` · ${history.length} results` : ''}
                </p>
              </div>
              <Trend points={history.map((r) => r.totalScore)} max={latest.maxScore ?? 0} color={primaryColor} />
            </div>

            {latest.flags.length ? (
              <div className="flex items-start gap-2 rounded-[12px] bg-[#FEF2F2] border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
                <span>{latest.flags.map((f) => f.message).join(' ')}</span>
              </div>
            ) : null}

            {latest.subscales.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {latest.subscales.map((s) => (
                  <div key={s.key} className="p-3 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[11px] font-bold text-[#475569] block">{s.label}</span>
                    <span className="text-[15px] font-extrabold text-[#0F172A]">{s.score}</span>
                    <span className="text-[11px] text-[#94A3B8]"> / {s.max}</span>
                    <div className="mt-1"><Badge level={s.severity.level}>{s.severity.label}</Badge></div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="border-t border-[#E2E8F0] pt-2">
              {history
                .slice()
                .reverse()
                .map((r) => (
                  <div key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpenResult(openResult === r.id ? null : r.id)}
                      className="w-full flex items-center justify-between py-1.5 text-xs cursor-pointer"
                    >
                      <span className="font-semibold text-[#475569]">{date(r.completedAt)}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-[#0F172A]">{r.totalScore}</span>
                        <Badge level={r.severityLevel}>{r.severity}</Badge>
                      </span>
                    </button>
                    {openResult === r.id ? (
                      <ol className="mb-2 space-y-1 text-xs list-decimal pl-5">
                        {Object.entries(r.answers).map(([itemId, value]) => (
                          <li key={itemId} className="text-[#0F172A]">
                            {itemText[itemId] ?? itemId}{' '}
                            <strong className="text-[#475569]">{scaleFor(r.instrumentKey)[value] ?? value}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
