import { useState } from 'react';
import useSWR from 'swr';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { profilePath } from '../../config/domains';
import { formatDate } from './adminTypes';

/** The API's report row (apps/api profile-reports.service.ts list()). */
export interface ProfileReportRow {
  id: string;
  handle: string;
  type: 'IMPERSONATION' | 'MISLEADING' | 'UNSAFE' | 'OTHER' | 'REMOVAL_REQUEST';
  details: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  relationship: string | null;
  status: 'OPEN' | 'ACTIONED' | 'DISMISSED';
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  profile: { id: string; handle: string; displayName: string; status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'SUSPENDED'; openReports: number } | null;
}

type Moderation = 'unpublish' | 'suspend' | 'restore';

export const REPORT_TYPE_LABEL: Record<ProfileReportRow['type'], string> = {
  IMPERSONATION: 'Impersonation',
  MISLEADING: 'Misleading',
  UNSAFE: 'Unsafe',
  OTHER: 'Other',
  REMOVAL_REQUEST: 'Removal request',
};
const PROFILE_STATUS_LABEL: Record<NonNullable<ProfileReportRow['profile']>['status'], string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  HIDDEN: 'Unpublished',
  SUSPENDED: 'Suspended',
};
const STATUSES = ['OPEN', 'ACTIONED', 'DISMISSED', 'ALL'] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = { OPEN: 'Open', ACTIONED: 'Actioned', DISMISSED: 'Dismissed', ALL: 'All' };
const REASON_MIN = 10;

/** Which actions a profile in each status can take (mirrors MODERATION_TRANSITIONS in the API). */
function actionsFor(status: NonNullable<ProfileReportRow['profile']>['status']): Moderation[] {
  if (status === 'PUBLISHED') return ['unpublish', 'suspend'];
  if (status === 'SUSPENDED') return ['restore'];
  return ['suspend'];
}
const ACTION_LABEL: Record<Moderation, string> = { unpublish: 'Unpublish', suspend: 'Suspend', restore: 'Lift suspension' };
const ACTION_DONE: Record<Moderation, string> = {
  unpublish: 'Unpublished. The therapist has been emailed and can fix it and publish again.',
  suspend: 'Suspended. The page now says it is no longer available, and the therapist has been emailed.',
  restore: 'Suspension lifted. The profile stays unpublished until the therapist publishes it.',
};

/**
 * Profile reports (spec §6.15, §12). Dismiss a report, or act on the profile
 * with a reason the therapist is emailed. Every action is audited by the API.
 */
export function AdminProfileReportsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('OPEN');
  const { data, isLoading, mutate } = useSWR<{ reports: ProfileReportRow[] }>(`/v1/admin/profile-reports?status=${status}`);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const reasonFor = (id: string) => (reasons[id] ?? '').trim();

  async function dismiss(row: ProfileReportRow) {
    setBusy(row.id);
    try {
      const note = reasonFor(row.id);
      await api.post(`/v1/admin/profile-reports/${row.id}/resolve`, { decision: 'DISMISSED', ...(note ? { note } : {}) });
      await mutate();
      toast.success('Report dismissed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not dismiss the report');
    } finally {
      setBusy(null);
    }
  }

  async function moderate(row: ProfileReportRow, action: Moderation) {
    if (!row.profile) return;
    setBusy(row.id);
    try {
      await api.post(`/v1/admin/profiles/${row.profile.id}/moderate`, {
        action,
        reason: reasonFor(row.id),
        ...(row.status === 'OPEN' ? { reportId: row.id } : {}),
      });
      await mutate();
      toast.success(ACTION_DONE[action]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the profile');
    } finally {
      setBusy(null);
    }
  }

  const button = 'h-9 px-3 rounded-[10px] border border-[var(--desk-border)] bg-white text-xs font-bold text-[var(--desk-text)] hover:bg-[var(--desk-surface)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
  const reports = data?.reports ?? [];
  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">Profile reports</h1>
      <p className="mt-1 text-[13.5px] text-[var(--desk-text-muted)]">
        Reports from the public profile pages. The therapist never sees who reported them. A reason is required to act on a profile; the therapist is emailed it.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`${button} ${status === s ? '!bg-[var(--desk-sidebar)] !text-white !border-[var(--desk-text)]' : ''}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <Card padding="p-[22px]"><p className="text-sm text-[var(--desk-text-muted)]">Loading…</p></Card>
        ) : !reports.length ? (
          <Card padding="p-[22px]"><p className="text-sm text-[var(--desk-text-muted)]">{status === 'OPEN' ? 'No open reports.' : 'Nothing here.'}</p></Card>
        ) : (
          reports.map((row) => {
            const reason = reasonFor(row.id);
            const canModerate = reason.length >= REASON_MIN && busy !== row.id;
            return (
              <Card key={row.id} padding="p-[18px]" data-report={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[var(--desk-text)]">
                      {REPORT_TYPE_LABEL[row.type]} · {row.profile ? row.profile.displayName : `@${row.handle} (deleted)`}
                    </p>
                    <p className="text-xs text-[var(--desk-text-muted)]">
                      <a href={profilePath(row.handle)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{profilePath(row.handle)}</a>
                      {' · '}{formatDate(row.createdAt)}
                      {row.profile ? ` · ${PROFILE_STATUS_LABEL[row.profile.status]}` : ''}
                      {row.profile && row.profile.openReports > 1 ? ` · ${row.profile.openReports} open reports` : ''}
                    </p>
                    {row.details ? <p className="mt-2 text-sm text-[var(--desk-text-body)] whitespace-pre-line">{row.details}</p> : null}
                    {row.reviewNote ? <p className="mt-2 text-xs text-[var(--desk-text-muted)]">Review note: {row.reviewNote}</p> : null}
                  </div>
                  <span className="text-xs font-bold text-[var(--desk-text-body)] bg-[var(--desk-surface-muted)] rounded-full px-2.5 py-1">{STATUS_LABEL[row.status]}</span>
                </div>
                {row.status === 'OPEN' || row.profile?.status === 'SUSPENDED' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="flex-1 min-w-[260px]">
                      <span className="sr-only">Reason for report {row.id}</span>
                      <input
                        value={reasons[row.id] ?? ''}
                        onChange={(e) => setReasons((current) => ({ ...current, [row.id]: e.target.value }))}
                        placeholder={`Reason (the therapist sees it; at least ${REASON_MIN} characters to act)`}
                        className="w-full h-9 px-3 rounded-[10px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-[13px]"
                      />
                    </label>
                    {row.status === 'OPEN' ? (
                      <button type="button" disabled={busy === row.id} onClick={() => void dismiss(row)} className={button}>Dismiss</button>
                    ) : null}
                    {row.profile
                      ? actionsFor(row.profile.status).map((action) => (
                          <button
                            key={action}
                            type="button"
                            disabled={!canModerate}
                            onClick={() => void moderate(row, action)}
                            className={`${button} ${action === 'suspend' ? 'text-rose-700' : ''}`}
                          >
                            {ACTION_LABEL[action]}
                          </button>
                        ))
                      : null}
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
