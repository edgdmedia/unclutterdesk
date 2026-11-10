import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { RichTextEditor } from '../richText/RichTextEditor';

export interface SessionNoteValue {
  id?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  isLocked?: boolean;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * One session's SOAP note: written, autosaved and signed against the booking.
 *
 * The same editor sits in the session room and on the session page, so a
 * note started during a call is finished in the same place hours later —
 * after a session held in Google Meet the room is never opened again.
 */
export function SessionNoteEditor({
  bookingId,
  clientProfileId,
  note,
  eyebrow = 'SESSION NOTE',
  onClose,
  onChange,
}: {
  bookingId: string;
  clientProfileId: string;
  /** This session's own note, or null before one is written. Never another session's. */
  note: SessionNoteValue | null;
  eyebrow?: string;
  /** Shows a close button (the room's drawer). */
  onClose?: () => void;
  /** After a save or a lock, for pages that show the note's state elsewhere. */
  onChange?: (n: { id: string; isLocked: boolean }) => void;
}) {
  const toast = useToast();
  const [noteId, setNoteId] = useState<string | null>(note?.id ?? null);
  const [locked, setLocked] = useState(Boolean(note?.isLocked));
  const [subjective, setSubjective] = useState(note?.subjective ?? '');
  const [objective, setObjective] = useState(note?.objective ?? '');
  const [assessment, setAssessment] = useState(note?.assessment ?? '');
  const [plan, setPlan] = useState(note?.plan ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const typed = useRef(false);

  async function save() {
    if (locked) return null;
    setSaveState('saving');
    try {
      const saved = await api.post<{ id: string; isLocked: boolean }>('/v1/notes', {
        bookingId,
        clientProfileId,
        subjective,
        objective,
        assessment,
        plan,
      });
      setNoteId(saved.id);
      setLocked(saved.isLocked);
      setLastSavedAt(new Date().toISOString());
      setSaveState('saved');
      onChange?.({ id: saved.id, isLocked: saved.isLocked });
      return saved;
    } catch (error) {
      setSaveState('error');
      throw error;
    }
  }

  async function signAndLock() {
    try {
      const saved = await save();
      const id = saved?.id || noteId;
      if (!id) return;
      await api.patch(`/v1/notes/${id}/lock`, {});
      setLocked(true);
      setSaveState('saved');
      onChange?.({ id, isLocked: true });
      toast.success('Note signed and locked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not sign the note');
    }
  }

  // Typing marks the note dirty; it saves once the typing settles.
  useEffect(() => {
    if (!typed.current || locked) return;
    setSaveState((s) => (s === 'idle' || s === 'saved' ? 'dirty' : s));
  }, [subjective, objective, assessment, plan, locked]);

  useEffect(() => {
    if (locked || saveState !== 'dirty') return;
    const t = window.setTimeout(() => void save().catch(() => undefined), 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, saveState, subjective, objective, assessment, plan]);

  const sections = [
    { chip: 'S', title: 'Subjective', val: subjective, set: setSubjective },
    { chip: 'O', title: 'Objective', val: objective, set: setObjective },
    { chip: 'A', title: 'Assessment', val: assessment, set: setAssessment },
    { chip: 'P', title: 'Plan', val: plan, set: setPlan },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--desk-border)] pb-3">
        <div>
          <span className="os-eyebrow block">{eyebrow}</span>
          <h3 className="text-[17px] font-bold text-[var(--desk-text)]">SOAP Notes</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-bold" aria-live="polite">
            {saveState === 'saving' ? <span className="text-[var(--desk-pending)]">Saving...</span> : null}
            {saveState === 'saved' ? (
              <span className="text-[var(--desk-active)]">
                Saved{lastSavedAt ? ` · ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(lastSavedAt))}` : ''}
              </span>
            ) : null}
            {saveState === 'error' ? <span className="text-[var(--desk-danger)]">Autosave failed</span> : null}
            {locked ? <span className="text-[var(--desk-text-body)]">Locked</span> : null}
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close notes" className="h-8 w-8 rounded-full bg-[var(--desk-surface-muted)] hover:bg-slate-200 text-[var(--desk-text-muted)] flex items-center justify-center font-bold text-xs cursor-pointer">✕</button>
          ) : null}
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.chip} className="p-3.5 rounded-[18px] bg-white border border-[var(--desk-border)] space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-[8px] bg-[var(--desk-pine-600)] text-[var(--ds-sky)] font-black text-xs flex items-center justify-center">{s.chip}</span>
            <span className="text-[12.5px] font-bold text-[var(--desk-text)] tracking-tight">{s.title}</span>
          </div>
          <RichTextEditor
            label={s.title}
            disabled={locked}
            value={s.val}
            minHeight={72}
            onChange={(v) => {
              typed.current = true;
              s.set(v);
            }}
          />
        </div>
      ))}

      <div className="pt-3 border-t border-[var(--desk-border)] flex items-center justify-between gap-2">
        <button type="button" onClick={() => void save().catch(() => undefined)} disabled={locked} className="h-9 px-3 rounded-[12px] bg-[var(--desk-surface-muted)] text-[var(--desk-text)] text-xs font-bold hover:bg-slate-200 cursor-pointer disabled:opacity-50">
          Save note
        </button>
        <button type="button" onClick={() => void signAndLock()} disabled={locked} className="h-9 px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-white">
          <Lock className="h-3.5 w-3.5" />
          <span>{locked ? 'Locked' : 'Sign & lock'}</span>
        </button>
      </div>
    </div>
  );
}
