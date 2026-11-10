import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

/** "Read recap" on a session the practitioner has sent one for. */
export function RecapLink({ id }: { id: string }) {
  return (
    <Link
      to={`/portal/sessions/${id}/recap`}
      className="h-[34px] px-3 rounded-[10px] border border-[var(--desk-border)] text-[12px] font-bold text-[var(--desk-text-body)] hover:bg-[var(--desk-surface)] inline-flex items-center gap-1.5"
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      Read recap
    </Link>
  );
}
