import React, { useState } from 'react';
import { api } from '../../utils/apiClient';
import { useToast } from '@unclutterdesk/ui';
import { TIER_NAMES, type Tier } from '../../utils/entitlements';
import { formatDate } from './adminTypes';

export type PlanView = {
  subscriptionTier: string;
  subscriptionStatus?: string | null;
  complimentaryReason?: string | null;
  complimentaryUntil?: string | null;
};

const PAID: Tier[] = ['STARTER', 'PRO', 'CLINIC'];
const REASONS = [
  { value: 'INVITE_CODE', label: 'Invite / goodwill' },
  { value: 'MIGRATION', label: 'Migration' },
  { value: 'INTERNAL', label: 'Internal (can have no end date)' },
] as const;

/** "Pro, complimentary until 3 Feb 2027 (migration)" — what the practice is on and why. */
export function describePlan(p: PlanView): string {
  const name = TIER_NAMES[p.subscriptionTier as Tier] ?? p.subscriptionTier;
  if (p.complimentaryReason === 'INTERNAL' && !p.complimentaryUntil) return `${name}, complimentary with no end date (internal)`;
  if (p.complimentaryUntil) {
    const why = REASONS.find((r) => r.value === p.complimentaryReason)?.label.toLowerCase() ?? 'complimentary';
    return `${name}, complimentary until ${formatDate(p.complimentaryUntil)} (${why})`;
  }
  if (p.subscriptionStatus === 'active') return `${name}, paid`;
  if (p.subscriptionStatus) return `${name}, subscription ${p.subscriptionStatus.replace('_', ' ')}`;
  return name;
}

/**
 * Complimentary plans (spec §12): the only way an admin changes a practice's
 * plan. Every change carries a reason and an end date, or is INTERNAL with
 * none; a plan set without either would quietly count as Free.
 */
export function ComplimentaryPlanForm({ tenantId, plan, onSaved }: { tenantId: string; plan: PlanView; onSaved: (p: PlanView) => void }) {
  const toast = useToast();
  const [tier, setTier] = useState<Tier>(PAID.includes(plan.subscriptionTier as Tier) ? (plan.subscriptionTier as Tier) : 'STARTER');
  const [reason, setReason] = useState<string>(plan.complimentaryReason ?? 'INVITE_CODE');
  const [until, setUntil] = useState<string>(plan.complimentaryUntil?.slice(0, 10) ?? '');
  const [busy, setBusy] = useState(false);
  const noEnd = reason === 'INTERNAL' && !until;

  async function save() {
    setBusy(true);
    try {
      const saved = await api.post<PlanView>(`/v1/admin/tenants/${tenantId}/complimentary`, {
        tier,
        reason,
        until: until ? new Date(`${until}T23:59:00+01:00`).toISOString() : null,
      });
      onSaved(saved);
      toast.success('Plan updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the plan');
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    setBusy(true);
    try {
      onSaved(await api.delete<PlanView>(`/v1/admin/tenants/${tenantId}/complimentary`));
      toast.success('Complimentary plan ended');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not end the plan');
    } finally {
      setBusy(false);
    }
  }

  const field = 'h-9 px-3 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] text-[#0F172A]';
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[#475569]">
        Now: <span className="font-semibold text-[#0F172A]">{describePlan(plan)}</span>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-bold text-[#64748B] space-y-1">
          <span className="block">Plan</span>
          <select aria-label="Plan" className={field} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            {PAID.map((t) => <option key={t} value={t}>{TIER_NAMES[t]}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-[#64748B] space-y-1">
          <span className="block">Reason</span>
          <select aria-label="Reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-[#64748B] space-y-1">
          <span className="block">Free until{reason === 'INTERNAL' ? ' (optional)' : ''}</span>
          <input aria-label="Free until" type="date" className={field} value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || (!until && reason !== 'INTERNAL')}
          className="h-9 px-4 rounded-[10px] bg-[#0F3A53] text-white text-[12px] font-bold cursor-pointer disabled:opacity-50"
        >
          {noEnd ? 'Set with no end date' : 'Set plan'}
        </button>
        {plan.complimentaryReason ? (
          <button type="button" onClick={() => void end()} disabled={busy} className="h-9 px-3 rounded-[10px] bg-[#F1F5F9] text-[#475569] text-[12px] font-bold cursor-pointer">
            End now
          </button>
        ) : null}
      </div>
    </div>
  );
}
