import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useFocusTrap } from '@unclutterdesk/ui';

type Question = { id?: string; label?: string; type?: string; required?: boolean };
export type TemplateQuestions = { title: string; description?: string | null; practiceName?: string; schemaJson?: Question[] };

/** FRM-01: a read-only look at a form template's questions, for practices and platform admins. */
export function TemplateQuestionsDialog({ load, onClose }: { load: () => Promise<TemplateQuestions>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  const [template, setTemplate] = useState<TemplateQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then(setTemplate)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the template'));
    // load is a fresh closure each render; the dialog loads once when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="template-questions-title">
      <div ref={ref} className="w-full max-w-[520px] max-h-[85vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="template-questions-title" className="text-[16px] font-bold text-[#0F172A]">{template?.title ?? 'Template'}</h2>
            {template?.practiceName ? <p className="text-[12px] text-[#64748B]">Shared by {template.practiceName}</p> : null}
          </div>
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
