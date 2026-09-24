import { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '../../utils/apiClient';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { formatDate } from './adminTypes';
import { REQUEST_STATUS_LABEL, type AssessmentRequestRow } from '../../utils/assessments';

const STATUSES: AssessmentRequestRow['status'][] = ['OPEN', 'PLANNED', 'ADDED', 'DECLINED'];

/**
 * Instruments practices have asked for. Adding one to the library is a code
 * change (wording and scoring must be the validated versions), so this page
 * is for triage and for telling the practice what happened.
 */
export function AdminAssessmentRequestsPage() {
  const toast = useToast();
  const { data: requests, isLoading, mutate } = useSWR<AssessmentRequestRow[]>('/v1/admin/assessment-requests');
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function update(row: AssessmentRequestRow, status: AssessmentRequestRow['status']) {
    try {
      await api.patch(`/v1/admin/assessment-requests/${row.id}`, {
        status,
        ...(notes[row.id] !== undefined ? { adminNote: notes[row.id] } : {}),
      });
      await mutate();
      toast.success(`Marked ${REQUEST_STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the request');
    }
  }

  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Assessment requests</h1>
      <p className="mt-1 text-[13.5px] text-[#64748B]">
        Instruments practices want in the library. The practice sees the status and your note.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <Card padding="p-[22px]"><p className="text-sm text-[#64748B]">Loading…</p></Card>
        ) : !requests?.length ? (
          <Card padding="p-[22px]"><p className="text-sm text-[#64748B]">No requests yet.</p></Card>
        ) : (
          requests.map((row) => (
            <Card key={row.id} padding="p-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-[#0F172A]">{row.name}</p>
                  <p className="text-xs text-[#64748B]">
                    {row.practice ? (
                      <Link to={`/admin/tenants/${row.practice.id}`} className="font-semibold underline">{row.practice.name}</Link>
                    ) : null}{' '}
                    · {formatDate(row.createdAt)}
                  </p>
                  {row.details ? <p className="mt-2 text-sm text-[#334155] whitespace-pre-line">{row.details}</p> : null}
                </div>
                <span className="text-xs font-bold text-[#475569] bg-[#F1F5F9] rounded-full px-2.5 py-1">
                  {REQUEST_STATUS_LABEL[row.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[row.id] ?? row.adminNote ?? ''}
                  onChange={(e) => setNotes((current) => ({ ...current, [row.id]: e.target.value }))}
                  placeholder="Note for the practice (optional)"
                  className="flex-1 min-w-[220px] h-9 px-3 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px]"
                />
                {STATUSES.filter((s) => s !== row.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void update(row, s)}
                    className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    {REQUEST_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
