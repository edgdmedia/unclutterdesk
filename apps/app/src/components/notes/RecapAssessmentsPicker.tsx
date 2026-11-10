import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { api } from '../../utils/apiClient';
import type { LibraryEntry } from '../../utils/assessments';

export interface SentAssessment {
  id: string;
  key: string;
  shortName: string;
  status: 'SENT' | 'COMPLETED';
}

/**
 * Questionnaires to send with a session's recap. They are assigned for the
 * session when the recap is sent, and the client starts them from the recap
 * (email and portal page). Only what the practice has switched on, and its
 * plan includes, can be chosen.
 */
export function RecapAssessmentsPicker({
  value,
  onChange,
  sent,
  disabled = false,
}: {
  value: string[];
  onChange: (keys: string[]) => void;
  /** Already sent for this session, with how far the client got. */
  sent: SentAssessment[];
  disabled?: boolean;
}) {
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<LibraryEntry[]>('/v1/assessments/library')
      .then((l) => live && setLibrary(l))
      .catch(() => live && setLibrary([]));
    return () => {
      live = false;
    };
  }, []);

  const usable = (library ?? []).filter((e) => e.enabled && e.onPlan);
  const nameOf = (key: string) => (library ?? []).find((e) => e.key === key)?.shortName ?? sent.find((s) => s.key === key)?.shortName ?? key;
  const sentFor = (key: string) => sent.find((s) => s.key === key);
  const addable = usable.filter((e) => !value.includes(e.key));

  return (
    <div className="space-y-2">
      <div className="text-[11.5px] font-bold text-slate-500 uppercase">Questionnaires to send with the recap</div>
      {value.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Questionnaires attached to the recap">
          {value.map((key) => {
            const s = sentFor(key);
            return (
              <li key={key} className="h-[30px] pl-3 pr-1.5 rounded-full border border-[var(--desk-border)] bg-white inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--desk-text)]">
                {nameOf(key)}
                <span className="text-[11px] font-semibold text-[var(--desk-text-muted)]">
                  {s?.status === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-0.5 text-[var(--desk-active)]"><CheckCircle2 className="h-3 w-3" /> Done</span>
                  ) : s ? 'Sent' : 'Goes with the recap'}
                </span>
                {!disabled ? (
                  <button
                    type="button"
                    aria-label={`Remove ${nameOf(key)}`}
                    onClick={() => onChange(value.filter((k) => k !== key))}
                    className="h-5 w-5 rounded-full hover:bg-[var(--desk-surface-muted)] inline-flex items-center justify-center text-[var(--desk-text-muted)] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {library === null ? null : addable.length && !disabled ? (
        <select
          aria-label="Add a questionnaire"
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
          className="h-[34px] px-2.5 rounded-[10px] border border-[var(--desk-border)] bg-white text-[12.5px] font-semibold text-[var(--desk-text)] cursor-pointer"
        >
          <option value="">Add a questionnaire…</option>
          {addable.map((e) => (
            <option key={e.key} value={e.key}>
              {e.shortName}: {e.measures} (about {e.estimatedMinutes} min)
            </option>
          ))}
        </select>
      ) : !usable.length ? (
        <p className="text-[12px] text-[var(--desk-text-muted)] font-medium">
          Switch questionnaires on in <Link to="/dashboard/assessments" className="font-bold underline">Assessments</Link> to send them with a recap.
        </p>
      ) : null}
    </div>
  );
}
