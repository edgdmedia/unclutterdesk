import React from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { Loader2 } from 'lucide-react';
import { Card, Eyebrow } from '@unclutterdesk/ui';
import { describePlan, type PlanView } from './ComplimentaryPlanForm';

type Row = PlanView & { id: string; name: string; slug: string };

/**
 * Complimentary plans (spec §12): every practice on a plan it isn't paying
 * for, soonest end first. Plans are changed from each practice's page, which
 * is the only way an admin changes a plan.
 */
export function AdminComplimentaryPage() {
  const { data, isLoading } = useSWR<Row[]>('/v1/admin/complimentary-plans');
  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Complimentary plans</h1>
      <p className="mt-1 text-[13.5px] text-[#64748B]">
        Practices on a plan they aren't paying for: invite codes, the 90-day migration period, and internal practices with no end date.
        When a dated plan ends the practice moves to Free unless it has subscribed. Open a practice to change its plan.
      </p>
      <Card className="mt-6" padding="p-0">
        {isLoading ? (
          <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-[#64748B]" /></div>
        ) : !data?.length ? (
          <p className="p-6 text-[13px] text-[#64748B]">No practice has a complimentary plan.</p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {data.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <Link to={`/admin/tenants/${row.id}`} className="text-[13.5px] font-semibold text-[#0F3A53] hover:underline">
                  {row.name} <span className="font-normal text-[#94A3B8]">· {row.slug}</span>
                </Link>
                <span className="text-[12.5px] text-[#475569]">{describePlan(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
