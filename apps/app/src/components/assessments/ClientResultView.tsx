import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ClientResult } from '../../utils/assessments';

interface Props {
  result: ClientResult | null | undefined;
  color: string;
  practiceName: string;
  /** Show the thank-you heading (straight after submitting). */
  thankYou?: boolean;
}

/**
 * The client's side of a result: only what the instrument allows them to see,
 * in the wording written for them. Any "get help now" message comes first.
 */
export function ClientResultView({ result, color, practiceName, thankYou }: Props) {
  const messages = result?.messages ?? [];
  const showsAnything = result && result.show !== 'none' && (result.summary || result.headline || result.subscales?.length);
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m} role="alert" className="flex items-start gap-2.5 rounded-[16px] bg-[var(--desk-danger-bg)] border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-px" />
          <span>{m}</span>
        </div>
      ))}
      <div className="bg-white rounded-[20px] border border-[var(--desk-border)] p-5">
        {thankYou ? (
          <div className="text-center mb-2">
            <CheckCircle2 className="h-9 w-9 mx-auto mb-2" style={{ color }} />
            <h2 className="text-[18px] font-bold text-[var(--desk-text)]">Thank you</h2>
            <p className="mt-1 text-sm text-[var(--desk-text-body)]">Your answers have gone to {practiceName}.</p>
          </div>
        ) : null}
        {showsAnything ? (
          <div className={thankYou ? 'mt-4 border-t border-[var(--desk-border)] pt-4' : ''}>
            {result.headline ? <p className="text-[15px] font-bold text-[var(--desk-text)]">{result.headline}</p> : null}
            {result.summary ? <p className="mt-1 text-sm text-[var(--desk-text-body)] leading-relaxed">{result.summary}</p> : null}
            {result.show === 'score_and_summary' && result.score !== undefined ? (
              <p className="mt-2 text-xs font-semibold text-[var(--desk-text-muted)]">Score: {result.score}{result.maxScore ? ` out of ${result.maxScore}` : ''}</p>
            ) : null}
            {result.subscales?.length ? (
              <ul className="mt-3 space-y-1.5">
                {result.subscales.map((s) => (
                  <li key={s.label} className="text-sm text-[var(--desk-text-body)]"><strong className="text-[var(--desk-text)]">{s.label}:</strong> {s.text}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <p className={`${showsAnything || thankYou ? 'mt-4' : ''} text-xs text-[var(--desk-text-muted)] leading-relaxed`}>
          This is a screening questionnaire, not a diagnosis. Your practitioner will go through it with you.
        </p>
      </div>
    </div>
  );
}
