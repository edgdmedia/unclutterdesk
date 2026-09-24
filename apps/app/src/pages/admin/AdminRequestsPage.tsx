import { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '../../utils/apiClient';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { formatDate } from './adminTypes';
import {
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
  type PlatformRequestRow,
  type RequestStatus,
  type RequestType,
} from '../../utils/assessments';

const STATUSES: RequestStatus[] = ['OPEN', 'PLANNED', 'DONE', 'DECLINED'];
const TYPES: RequestType[] = ['ASSESSMENT', 'FEATURE', 'SERVICE', 'FEEDBACK', 'OTHER'];

/** Everything practices have asked for. The practice sees the status and note, and is notified when either changes. */
export function AdminRequestsPage() {
  const toast = useToast();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('OPEN');
  const query = new URLSearchParams({ ...(type ? { type } : {}), ...(status ? { status } : {}) }).toString();
  const { data: requests, isLoading, mutate } = useSWR<PlatformRequestRow[]>(`/v1/admin/requests${query ? `?${query}` : ''}`);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function update(row: PlatformRequestRow, next: RequestStatus) {
    try {
      await api.patch(`/v1/admin/requests/${row.id}`, {
        status: next,
        ...(notes[row.id] !== undefined ? { adminNote: notes[row.id] } : {}),
      });
      await mutate();
      toast.success(`Marked ${REQUEST_STATUS_LABEL[next].toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the request');
    }
  }

  const select = 'h-9 px-3 rounded-[10px] bg-white border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A]';
  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Requests</h1>
      <p className="mt-1 text-[13.5px] text-[#64748B]">
        Assessments, features, services and feedback from practices. They see the status and your note.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <select aria-label="Type" className={select} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All kinds</option>
          {TYPES.map((t) => <option key={t} value={t}>{REQUEST_TYPE_LABEL[t]}</option>)}
        </select>
        <select aria-label="Status" className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <Card padding="p-[22px]"><p className="text-sm text-[#64748B]">Loading…</p></Card>
        ) : !requests?.length ? (
          <Card padding="p-[22px]"><p className="text-sm text-[#64748B]">Nothing here.</p></Card>
        ) : (
          requests.map((row) => (
            <Card key={row.id} padding="p-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-[#0F172A]">{row.subject}</p>
                  <p className="text-xs text-[#64748B]">
                    {REQUEST_TYPE_LABEL[row.type]} ·{' '}
                    {row.practice ? <Link to={`/admin/tenants/${row.practice.id}`} className="font-semibold underline">{row.practice.name}</Link> : null}{' '}
                    · {formatDate(row.createdAt)}
                  </p>
                  {row.details ? <p className="mt-2 text-sm text-[#334155] whitespace-pre-line">{row.details}</p> : null}
                </div>
                <span className="text-xs font-bold text-[#475569] bg-[#F1F5F9] rounded-full px-2.5 py-1">{REQUEST_STATUS_LABEL[row.status]}</span>
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
