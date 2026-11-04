import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@unclutterdesk/ui';
import { MAX_SOCIAL_LINKS } from './profileApi';
import { linkLabel } from './socialPlatform';

/**
 * Links shown on the profile (§6.1): any https link, up to MAX_SOCIAL_LINKS.
 * The site is recognised as you type (Instagram, LinkedIn, WhatsApp…);
 * anything else shows as your website.
 */
export function SocialLinksField({ value, onChange }: { value: string[]; onChange: (links: string[]) => void }) {
  const id = useId();
  const rows = value.length ? value : [''];
  const setRow = (i: number, v: string) => onChange(rows.map((r, j) => (j === i ? v : r)));
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <fieldset className="flex flex-col gap-3 min-w-0">
      <legend className="text-[14px] font-bold text-[var(--desk-text)] mb-1">Links</legend>
      <p className="text-[13px] text-[var(--desk-text-muted)] -mt-1">Your website, Instagram, LinkedIn, WhatsApp or any other https:// link. Up to {MAX_SOCIAL_LINKS}.</p>
      {rows.map((row, i) => {
        const label = row.trim() ? linkLabel(row) : null;
        const inputId = `${id}-${i}`;
        return (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <label htmlFor={inputId} className="sr-only">Link {i + 1}</label>
              <input
                id={inputId}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={row}
                onChange={(e) => setRow(i, e.target.value)}
                aria-describedby={`${inputId}-hint`}
                className="w-full h-11 rounded-[12px] border border-[var(--desk-border,#E2E8F0)] bg-white px-3 text-[14px] text-[var(--desk-text)] focus:outline-none focus:ring-2 focus:ring-[var(--desk-pine-600)]/30"
              />
              <p id={`${inputId}-hint`} className={`mt-1 text-[12px] ${row.trim() && !label ? 'text-[var(--desk-danger)]' : 'text-[var(--desk-text-muted)]'}`}>
                {!row.trim() ? ' ' : label ?? 'Use a full link starting with https://'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={`Remove link ${i + 1}`}
              className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-[12px] border border-[var(--desk-border)] text-[var(--desk-text-body)] hover:bg-[var(--desk-surface)]"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        );
      })}
      {rows.length < MAX_SOCIAL_LINKS && (
        <div>
          <Button variant="ghost" onClick={() => onChange([...rows, ''])}>
            <Plus size={16} aria-hidden /> Add a link
          </Button>
        </div>
      )}
    </fieldset>
  );
}
