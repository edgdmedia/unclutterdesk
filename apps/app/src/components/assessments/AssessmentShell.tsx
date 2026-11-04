import type { ReactNode } from 'react';
import type { PracticeBrand } from '../../utils/assessments';

/** A plain page in the practice's colours, for completing an assessment on a phone. */
export function AssessmentShell({ practice, children, back }: { practice?: PracticeBrand | null; children: ReactNode; back?: ReactNode }) {
  const color = practice?.primaryColor || '#0F3A53';
  return (
    <div className="min-h-screen bg-[var(--desk-surface)]">
      <header className="bg-white border-b border-[var(--desk-border)]">
        <div className="max-w-[680px] mx-auto px-4 h-16 flex items-center gap-3">
          {practice?.logoUrl ? (
            <img src={practice.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: color }} aria-hidden />
          )}
          <span className="text-[15px] font-bold text-[var(--desk-text)]">{practice?.name ?? ''}</span>
          {back ? <div className="ml-auto">{back}</div> : null}
        </div>
      </header>
      <main className="max-w-[680px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export function AssessmentMessage({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="bg-white rounded-[20px] border border-[var(--desk-border)] p-6 text-center">
      <h1 className="text-[18px] font-bold text-[var(--desk-text)]">{title}</h1>
      <p className="mt-2 text-sm text-[var(--desk-text-body)] leading-relaxed">{body}</p>
    </div>
  );
}
