import { useCallback, useEffect, useState } from 'react';
import { Clock, Download, FileText, Pencil, Target, Trash2 } from 'lucide-react';
import { Card, Eyebrow, useBrand, useToast, Page, PageHeader, ResponsiveTable, byDate, byNumber, byText, type Column } from '@unclutterdesk/ui';
import { api, apiDownload } from '../../utils/apiClient';

type Category = 'DIRECT_CLIENT' | 'GROUP' | 'SUPERVISION' | 'INDIRECT' | 'OTHER';

const CATEGORY_LABEL: Record<Category, string> = {
  DIRECT_CLIENT: 'Direct client work',
  GROUP: 'Group work',
  SUPERVISION: 'Supervision',
  INDIRECT: 'Indirect (notes, prep, training)',
  OTHER: 'Other',
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

interface HoursEntry {
  id: string;
  date: string;
  durationMinutes: number;
  category: Category;
  source: 'BOOKING' | 'MANUAL';
  clientName: string | null;
  notes: string | null;
  supervisorName: string | null;
}

interface HoursLog {
  totals: { totalMinutes: number; clientMinutes: number; supervisionMinutes: number; byCategory: Record<Category, number> };
  target: { label: string | null; totalTargetHours: number | null; supervisionTargetHours: number | null } | null;
  entries: HoursEntry[];
}

const hours = (minutes: number) => {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = { date: today(), durationMinutes: 50, category: 'SUPERVISION' as Category, supervisorName: '', notes: '' };

function Progress({ label, minutes, targetHours, color }: { label: string; minutes: number; targetHours: number | null | undefined; color: string }) {
  const pct = targetHours ? Math.min(100, (minutes / 60 / targetHours) * 100) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold text-[#475569]">{label}</span>
        <span className="text-[13px] font-extrabold text-[#0F172A]">
          {hours(minutes)} h{targetHours ? <span className="font-semibold text-[#64748B]"> of {targetHours} h</span> : null}
        </span>
      </div>
      {pct !== null ? (
        <div className="mt-1.5 h-2 rounded-full bg-[#EEF2F7] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The signed-in practitioner's hours: completed sessions are logged
 * automatically, anything else (supervision, group work, training) is added
 * by hand. Exports to CSV or a PDF with signature lines for a supervisor.
 */
export function HoursLogPage() {
  const toast = useToast();
  const brand = useBrand();
  const primary = brand.primaryColor || '#0F3A53';

  const [log, setLog] = useState<HoursLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [targetForm, setTargetForm] = useState({ label: '', totalTargetHours: '', supervisionTargetHours: '' });
  const [showTarget, setShowTarget] = useState(false);
  const [fullNames, setFullNames] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<HoursLog>('/v1/hours');
      setLog(data);
      setTargetForm({
        label: data.target?.label ?? '',
        totalTargetHours: data.target?.totalTargetHours?.toString() ?? '',
        supervisionTargetHours: data.target?.supervisionTargetHours?.toString() ?? '',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your hours');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = editingId ? log?.entries.find((e) => e.id === editingId) ?? null : null;
  const isSessionEdit = editing?.source === 'BOOKING';

  async function saveEntry() {
    setSaving(true);
    try {
      if (editingId) {
        const body = isSessionEdit
          ? { category: form.category, notes: form.notes, supervisorName: form.supervisorName }
          : { ...form, durationMinutes: Number(form.durationMinutes) };
        await api.patch(`/v1/hours/${editingId}`, body);
        toast.success('Entry updated');
      } else {
        await api.post('/v1/hours', { ...form, durationMinutes: Number(form.durationMinutes) });
        toast.success('Hours added');
      }
      setForm({ ...EMPTY_FORM, date: today() });
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: HoursEntry) {
    setEditingId(entry.id);
    setForm({
      date: entry.date.slice(0, 10),
      durationMinutes: entry.durationMinutes,
      category: entry.category,
      supervisorName: entry.supervisorName ?? '',
      notes: entry.notes ?? '',
    });
  }

  async function removeEntry(entry: HoursEntry) {
    if (!window.confirm(`Delete ${hours(entry.durationMinutes)} h on ${day(entry.date)}?`)) return;
    try {
      await api.delete(`/v1/hours/${entry.id}`);
      toast.success('Entry deleted');
      if (editingId === entry.id) setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  async function saveTarget() {
    try {
      await api.put('/v1/hours/target', {
        label: targetForm.label,
        totalTargetHours: targetForm.totalTargetHours === '' ? null : Number(targetForm.totalTargetHours),
        supervisionTargetHours: targetForm.supervisionTargetHours === '' ? null : Number(targetForm.supervisionTargetHours),
      });
      toast.success('Target saved');
      setShowTarget(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the target');
    }
  }

  async function download(kind: 'csv' | 'pdf') {
    setDownloading(kind);
    try {
      const stamp = today();
      await apiDownload(`/v1/hours/export.${kind}${fullNames ? '?names=full' : ''}`, `hours-log-${stamp}.${kind}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  const inputClass = 'w-full h-[40px] px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none disabled:opacity-60';

  const clientLabel = (e: HoursEntry) => e.clientName ?? (e.source === 'MANUAL' ? '—' : 'Client');
  const detailText = (e: HoursEntry) => [e.supervisorName, e.notes].filter(Boolean).join(' · ');
  const columns: Column<HoursEntry>[] = [
    { key: 'date', header: 'Date', cell: (e) => <span className="whitespace-nowrap font-semibold text-[#0F172A]">{day(e.date)}</span>, sort: byDate((e) => e.date) },
    {
      key: 'category',
      header: 'Category',
      cell: (e) => (
        <>
          {CATEGORY_LABEL[e.category] ?? e.category}
          {e.source === 'BOOKING' ? <span className="ml-1.5 text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] rounded-full px-1.5 py-0.5">Session</span> : null}
        </>
      ),
      sort: byText((e) => CATEGORY_LABEL[e.category] ?? e.category),
    },
    { key: 'hours', header: 'Hours', align: 'end', cell: (e) => <span className="font-bold text-[#0F172A]">{hours(e.durationMinutes)}</span>, sort: byNumber((e) => e.durationMinutes) },
    { key: 'client', header: 'Client', priority: 'md', cell: clientLabel, sort: byText((e) => e.clientName) },
    { key: 'notes', header: 'Notes', priority: 'lg', className: 'max-w-[220px] truncate', cell: (e) => <span title={detailText(e)}>{detailText(e)}</span> },
  ];

  return (
    <Page
      header={
        <PageHeader
          eyebrow="CLINICAL"
          title="Hours log"
          actions={
            <>
              <button type="button" onClick={() => void download('csv')} disabled={downloading !== null} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                <Download className="h-3.5 w-3.5" /> {downloading === 'csv' ? 'Preparing…' : 'CSV'}
              </button>
              <button type="button" onClick={() => void download('pdf')} disabled={downloading !== null} className="h-9 px-3 rounded-[10px] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50" style={{ backgroundColor: primary }}>
                <FileText className="h-3.5 w-3.5" /> {downloading === 'pdf' ? 'Preparing…' : 'PDF'}
              </button>
            </>
          }
          secondaryActions={
            <label className="flex items-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-[#64748B] cursor-pointer">
              <input type="checkbox" checked={fullNames} onChange={(e) => setFullNames(e.target.checked)} />
              Full client names
            </label>
          }
        />
      }
    >
      <p className="text-xs text-[#64748B] font-medium -mt-1">
        Completed sessions are logged for you. Add supervision, group work and training by hand.
      </p>
      <div className="grid grid-cols-1 @min-[1200px]/page:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 md:gap-6 items-start">
        {error ? (
          <div role="alert" className="@min-[1200px]/page:col-span-2 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
        ) : null}

        <div className="space-y-4 min-w-0">
          <Card padding="p-[22px]" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#475569]" />
                <h2 className="text-[14px] font-bold text-[#0F172A]">{log?.target?.label || 'Your totals'}</h2>
              </div>
              <button type="button" onClick={() => setShowTarget((v) => !v)} className="text-xs font-bold cursor-pointer" style={{ color: primary }}>
                {showTarget ? 'Close' : log?.target ? 'Edit target' : 'Set a target'}
              </button>
            </div>

            {showTarget ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input aria-label="Target name" placeholder="e.g. Diploma practicum" value={targetForm.label} onChange={(e) => setTargetForm((t) => ({ ...t, label: e.target.value }))} className={inputClass} />
                <input aria-label="Total target hours" type="number" min={0} placeholder="Total hours" value={targetForm.totalTargetHours} onChange={(e) => setTargetForm((t) => ({ ...t, totalTargetHours: e.target.value }))} className={inputClass} />
                <input aria-label="Supervision target hours" type="number" min={0} placeholder="Supervision hours" value={targetForm.supervisionTargetHours} onChange={(e) => setTargetForm((t) => ({ ...t, supervisionTargetHours: e.target.value }))} className={inputClass} />
                <button type="button" onClick={() => void saveTarget()} className="sm:col-span-3 h-9 rounded-[10px] text-white text-xs font-bold cursor-pointer" style={{ backgroundColor: primary }}>Save target</button>
              </div>
            ) : null}

            {log ? (
              <div className="space-y-3">
                <Progress label="All hours" minutes={log.totals.totalMinutes} targetHours={log.target?.totalTargetHours} color={primary} />
                <Progress label="Client hours (direct and group)" minutes={log.totals.clientMinutes} targetHours={null} color={primary} />
                <Progress label="Supervision" minutes={log.totals.supervisionMinutes} targetHours={log.target?.supervisionTargetHours} color="#B45309" />
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">Loading…</p>
            )}
          </Card>

          <Card padding="p-0" className="overflow-hidden">
            <ResponsiveTable<HoursEntry>
              caption="Hours log entries"
              rows={log?.entries ?? []}
              rowKey={(e) => e.id}
              rowLabel={(e) => `${day(e.date)}, ${CATEGORY_LABEL[e.category] ?? e.category}`}
              columns={columns}
              state={log ? 'ready' : 'loading'}
              empty="No hours yet. Completed sessions appear here automatically."
              filter={{
                placeholder: 'Search hours',
                match: (e, q) => [clientLabel(e), detailText(e), CATEGORY_LABEL[e.category] ?? e.category].some((v) => v.toLowerCase().includes(q)),
              }}
              actions={(e) => (
                <>
                  <button type="button" aria-label="Edit entry" onClick={() => startEdit(e)} className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
                  {e.source === 'MANUAL' ? (
                    <button type="button" aria-label="Delete entry" onClick={() => void removeEntry(e)} className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                  ) : null}
                </>
              )}
            />
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          <Card padding="p-[22px]" className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#475569]" />
              <h2 className="text-[14px] font-bold text-[#0F172A]">{editingId ? (isSessionEdit ? 'Edit session entry' : 'Edit entry') : 'Log hours'}</h2>
            </div>
            {isSessionEdit ? (
              <p className="text-[11.5px] text-[#64748B] leading-relaxed">The date, length and client come from the booking. You can change the category and notes.</p>
            ) : null}
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-[#475569]">Date</span>
              <input type="date" max={today()} value={form.date} disabled={isSessionEdit} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputClass} />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-[#475569]">Minutes</span>
              <input type="number" min={5} max={720} value={form.durationMinutes} disabled={isSessionEdit} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} className={inputClass} />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-[#475569]">Category</span>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-[#475569]">Supervisor (optional)</span>
              <input value={form.supervisorName} onChange={(e) => setForm((f) => ({ ...f, supervisorName: e.target.value }))} className={inputClass} />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-[#475569]">Notes (optional)</span>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none resize-none" />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => void saveEntry()} disabled={saving || !form.date} className="flex-1 h-10 rounded-[12px] text-white text-xs font-bold cursor-pointer disabled:opacity-50" style={{ backgroundColor: primary }}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add hours'}
              </button>
              {editingId ? (
                <button type="button" onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, date: today() }); }} className="h-10 px-3 rounded-[12px] border border-[#E2E8F0] bg-white text-xs font-bold cursor-pointer">Cancel</button>
              ) : null}
            </div>
          </Card>

          <Card padding="p-[22px]">
            <p className="text-[11.5px] text-[#64748B] leading-relaxed">
              Exports use client initials unless you tick <span className="font-bold">Full client names</span>. The PDF includes lines
              for you and your supervisor to sign.
            </p>
          </Card>
        </div>
      </div>
    </Page>
  );
}
