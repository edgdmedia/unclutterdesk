import React, { useEffect, useRef, useState } from 'react';
import { Copy, Eye, Loader2, Trash2, X } from 'lucide-react';
import { Eyebrow, useFocusTrap, useToast } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

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

type Question = { id?: string; label?: string; type?: string; required?: boolean };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PRIVATE: { text: 'Private', cls: 'bg-[#F1F5F9] text-[#475569]' },
  PENDING: { text: 'In review', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { text: 'Shared', cls: 'bg-emerald-100 text-emerald-800' },
  DECLINED: { text: 'Not approved', cls: 'bg-rose-100 text-rose-700' },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function PreviewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  const [template, setTemplate] = useState<(TemplateView & { schemaJson?: Question[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<TemplateView & { schemaJson?: Question[] }>(`/v1/intake/templates/${id}`)
      .then(setTemplate)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the template'));
  }, [id]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
      <div ref={ref} className="w-full max-w-[520px] max-h-[85vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="template-preview-title" className="text-[16px] font-bold text-[#0F172A]">{template?.title ?? 'Template'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? <p className="text-[13px] font-medium text-rose-700">{error}</p> : null}
        {!template && !error ? <Loader2 className="h-5 w-5 animate-spin text-[#64748B]" /> : null}
        {template?.description ? <p className="text-[13px] text-[#475569]">{template.description}</p> : null}
        <ol className="space-y-2">
          {(template?.schemaJson ?? []).map((q, i) => (
            <li key={q.id ?? i} className="rounded-[12px] border border-[#E2E8F0] px-3.5 py-2.5">
              <p className="text-[13.5px] font-semibold text-[#0F172A]">{i + 1}. {q.label}</p>
              <p className="text-[11.5px] text-[#64748B]">{(q.type ?? 'text').replace(/_/g, ' ')}{q.required ? ' · required' : ''}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

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
      {previewId ? <PreviewDialog id={previewId} onClose={() => setPreviewId(null)} /> : null}
    </section>
  );
}
