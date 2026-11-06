import { useState } from 'react';
import { PencilLine, X } from 'lucide-react';
import { MoveSessionPanel, type MoveSession } from './MoveSessionPanel';
import { ChangeServicePanel, type ChangeServiceResult, type ChangeServiceSession } from './ChangeServicePanel';

export type EditSessionPart = 'when' | 'service';

/**
 * Edit a booked session in one place: when it is (an open time, or a time
 * staff choose) and what service it is. Each part saves on its own and tells
 * the client. Cancelling stays a separate, plainly destructive action.
 */
export function EditSessionDialog({
  session,
  initial = 'when',
  onClose,
  onMoved,
  onServiceChanged,
}: {
  session: MoveSession & ChangeServiceSession;
  initial?: EditSessionPart;
  onClose: () => void;
  onMoved: (r: { startsAt: string }) => void;
  onServiceChanged: (r: ChangeServiceResult) => void;
}) {
  // A completed session keeps its time; its service can still be put right.
  // One whose time has passed without happening (the client was tied up) can
  // still move to a new time.
  const done = session.status === 'COMPLETED';
  const [part, setPart] = useState<EditSessionPart>(done ? 'service' : initial);
  const tabs: Array<{ id: EditSessionPart; label: string }> = done
    ? [{ id: 'service', label: 'Service' }]
    : [{ id: 'when', label: 'When' }, { id: 'service', label: 'Service' }];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--desk-sidebar)]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-session-title">
      <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-[var(--desk-pine-600)]" />
            <h2 id="edit-session-title" className="text-[16px] font-bold text-[var(--desk-text)]">
              Edit {session.client.name}'s session
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {tabs.length > 1 ? (
          <div role="tablist" aria-label="What to change" className="h-[40px] p-1 bg-[var(--desk-surface-muted)] border border-[var(--desk-border)] rounded-[14px] flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={part === t.id}
                onClick={() => setPart(t.id)}
                className={`flex-1 rounded-[10px] text-[12.5px] font-bold cursor-pointer ${part === t.id ? 'bg-white text-[var(--desk-text)] shadow-xs' : 'text-[var(--desk-text-muted)]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}

        <div role="tabpanel">
          {part === 'when' ? (
            <MoveSessionPanel session={session} onMoved={onMoved} />
          ) : (
            <ChangeServicePanel session={session} onClose={onClose} onChanged={onServiceChanged} />
          )}
        </div>
      </div>
    </div>
  );
}
