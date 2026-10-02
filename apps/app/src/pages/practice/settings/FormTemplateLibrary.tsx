import React, { useEffect, useState } from 'react';
import { Copy, Eye, Trash2 } from 'lucide-react';
import { Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { TemplateQuestionsDialog, type TemplateQuestions } from '../../../components/TemplateQuestionsDialog';

export type TemplateView = {
  id: string;
  title: string;
  description: string | null;
  targetType: string;
  questionCount: number;
  shareStatus: 'PRIVATE' | 'PENDING' | 'APPROVED' | 'DECLINED' | string;
  sharedBy: string | null;
  mine: boolean;
  timesUsed: number;
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PRIVATE: { text: 'Private', cls: 'bg-[#F1F5F9] text-[#475569]' },
  PENDING: { text: 'In review', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { text: 'Shared', cls: 'bg-emerald-100 text-emerald-800' },
  DECLINED: { text: 'Not approved', cls: 'bg-rose-100 text-rose-700' },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * FRM-01: the practice's own templates and the ones other practices shared
 * (approved by the platform). Using one copies it into the practice's forms.
 */
export function FormTemplateLibrary({ onUsed }: { onUsed: (formId: string) => void }) {
  const toast = useToast();
  const [library, setLibrary] = useState<{ mine: TemplateView[]; shared: TemplateView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ mine: TemplateView[]; shared: TemplateView[] }>('/v1/intake/templates')
      .then(setLibrary)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load templates'));
  }, []);

  async function use(t: TemplateView) {
    setBusyId(t.id);
    try {
      const { formId } = await api.post<{ formId: string }>(`/v1/intake/templates/${t.id}/use`, {});
      toast.success('Added to your forms.');
      onUsed(formId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use the template');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t: TemplateView) {
    if (!window.confirm(`Delete the template "${t.title}"? Forms already made from it stay.`)) return;
    setBusyId(t.id);
    try {
      await api.delete(`/v1/intake/templates/${t.id}`);
      setLibrary((cur) => (cur ? { ...cur, mine: cur.mine.filter((x) => x.id !== t.id) } : cur));
      toast.success('Template deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the template');
    } finally {
      setBusyId(null);
    }
  }

  const actionCls =
    'h-9 px-3 rounded-[12px] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60';

  function Row({ t }: { t: TemplateView }) {
    const status = STATUS_LABEL[t.shareStatus] ?? STATUS_LABEL.PRIVATE;
    return (
      <li className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[#E2E8F0] bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-[#0F172A] truncate">{t.title}</p>
          <p className="text-[12px] text-[#64748B]">
            {plural(t.questionCount, 'question')}
            {t.mine ? null : <> · Shared by {t.sharedBy} · Used {plural(t.timesUsed, 'time')}</>}
          </p>
        </div>
        {t.mine ? <span className={`h-6 px-2.5 inline-flex items-center rounded-full text-[11px] font-bold ${status.cls}`}>{status.text}</span> : null}
        {t.mine ? null : (
          <button type="button" onClick={() => setPreviewId(t.id)} className={`${actionCls} bg-[#F1F5F9] text-[#0F172A]`}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
        )}
        <button type="button" disabled={busyId === t.id} onClick={() => void use(t)} className={`${actionCls} bg-[#0F3A53] text-white`}>
          <Copy className="h-3.5 w-3.5" /> Use
        </button>
        {t.mine ? (
          <button type="button" disabled={busyId === t.id} onClick={() => void remove(t)} aria-label={`Delete ${t.title}`} className={`${actionCls} bg-white border border-[#E2E8F0] text-rose-700`}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        ) : null}
      </li>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="template-library-title">
      <div>
        <Eyebrow>TEMPLATE LIBRARY</Eyebrow>
        <h2 id="template-library-title" className="text-[16px] font-bold text-[#0F172A]">Reuse a form</h2>
      </div>
      {error ? <p className="text-[13px] font-medium text-rose-700">{error}</p> : null}
      {!library && !error ? <p className="text-[13px] text-[#64748B]">Loading templates...</p> : null}
      {library ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-[#475569]">Your templates</h3>
            {library.mine.length ? (
              <ul className="space-y-2">{library.mine.map((t) => <Row key={t.id} t={t} />)}</ul>
            ) : (
              <p className="text-[13px] text-[#64748B]">Save a form as a template to reuse it.</p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-[#475569]">From other practices</h3>
            {library.shared.length ? (
              <ul className="space-y-2">{library.shared.map((t) => <Row key={t.id} t={t} />)}</ul>
            ) : (
              <p className="text-[13px] text-[#64748B]">No shared templates yet.</p>
            )}
          </div>
        </div>
      ) : null}
      {previewId ? (
        <TemplateQuestionsDialog load={() => api.get<TemplateQuestions>(`/v1/intake/templates/${previewId}`)} onClose={() => setPreviewId(null)} />
      ) : null}
    </section>
  );
}
