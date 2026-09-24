import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { Copy, Check, Loader2, Ticket } from 'lucide-react';
import { api, APP_BASE_URL } from '../../utils/apiClient';
import { Card, Eyebrow } from '@unclutterdesk/ui';
import { formatDate } from './adminTypes';

interface InvitePractice {
  id: string;
  name: string;
  slug: string;
  tier: string;
  complimentaryUntil: string | null;
}

interface Invite {
  id: string;
  code: string;
  tier: 'PRO' | 'CLINIC';
  durationDays: number;
  maxUses: number | null;
  usedCount: number;
  redeemBy: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  practices: InvitePractice[];
}

const inputCls =
  'w-full h-[42px] px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none focus:border-[#94A3B8]';
const labelCls = 'text-[11.5px] font-bold text-[#475569]';

export function inviteLink(code: string) {
  return `${APP_BASE_URL}/auth/signup?invite=${encodeURIComponent(code)}`;
}

/**
 * Invite codes for early testers: each gives a practice a paid plan for a set
 * number of days, then it moves back to Starter unless it has subscribed.
 */
export function AdminInvitesPage() {
  const { data: invites, isLoading, mutate } = useSWR<Invite[]>('/v1/admin/invites');
  const [tier, setTier] = useState<'PRO' | 'CLINIC'>('PRO');
  const [durationDays, setDurationDays] = useState('90');
  const [maxUses, setMaxUses] = useState('10');
  const [redeemBy, setRedeemBy] = useState('');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await api.post<Invite>('/v1/admin/invites', {
        tier,
        durationDays: Number(durationDays),
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        redeemBy: redeemBy ? new Date(`${redeemBy}T23:59:59`).toISOString() : null,
        code: code.trim() || undefined,
        note: note.trim() || null,
      });
      setCode('');
      setNote('');
      await mutate((list) => [created, ...(list ?? [])], { revalidate: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the code');
    } finally {
      setCreating(false);
    }
  }

  async function toggle(invite: Invite) {
    setError(null);
    try {
      await api.patch(`/v1/admin/invites/${invite.id}`, { isActive: !invite.isActive });
      await mutate((list) => (list ?? []).map((i) => (i.id === invite.id ? { ...i, isActive: !i.isActive } : i)), {
        revalidate: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      setError('Could not copy. Select the link and copy it by hand.');
    }
  }

  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Invite codes</h1>
      <p className="mt-1 text-[13.5px] text-[#64748B]">
        Give testers a paid plan free for a while. When it ends, their practice moves to Starter unless they have subscribed.
      </p>

      {error ? (
        <div role="alert" className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <Card padding="p-[22px]" className="mt-5">
        <form onSubmit={(e) => void create(e)} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="space-y-1.5">
            <label htmlFor="inv-tier" className={labelCls}>Plan</label>
            <select id="inv-tier" value={tier} onChange={(e) => setTier(e.target.value as 'PRO' | 'CLINIC')} className={inputCls}>
              <option value="PRO">Pro</option>
              <option value="CLINIC">Clinic</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inv-days" className={labelCls}>Free for (days)</label>
            <input id="inv-days" type="number" min={1} max={730} required value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inv-uses" className={labelCls}>Uses <span className="font-normal text-[#94A3B8]">(empty: no limit)</span></label>
            <input id="inv-uses" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inv-by" className={labelCls}>Redeem by <span className="font-normal text-[#94A3B8]">(optional)</span></label>
            <input id="inv-by" type="date" value={redeemBy} onChange={(e) => setRedeemBy(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inv-code" className={labelCls}>Code <span className="font-normal text-[#94A3B8]">(optional)</span></label>
            <input id="inv-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Generated" className={`${inputCls} font-mono`} />
          </div>
          <button type="submit" disabled={creating} className="h-[42px] px-4 rounded-[12px] bg-[#0F3A53] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {creating ? 'Creating…' : 'Create code'}
          </button>
          <div className="md:col-span-6 space-y-1.5">
            <label htmlFor="inv-note" className={labelCls}>Note <span className="font-normal text-[#94A3B8]">(who it's for, only you see this)</span></label>
            <input id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lagos therapists pilot" className={inputCls} />
          </div>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !invites?.length ? (
          <Card padding="p-[22px]"><p className="text-sm text-[#64748B]">No invite codes yet.</p></Card>
        ) : (
          invites.map((invite) => {
            const link = inviteLink(invite.code);
            const full = invite.maxUses !== null && invite.usedCount >= invite.maxUses;
            const past = invite.redeemBy !== null && new Date(invite.redeemBy) <= new Date();
            const state = !invite.isActive ? 'Off' : full ? 'Used up' : past ? 'Expired' : 'Live';
            return (
              <Card key={invite.id} padding="p-[18px]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Ticket className="h-4 w-4 text-[#0F3A53]" />
                      <span className="font-mono text-[15px] font-bold text-[#0F172A]">{invite.code}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${state === 'Live' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                        {state}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-[#475569]">
                      {invite.tier === 'CLINIC' ? 'Clinic' : 'Pro'} free for {invite.durationDays} days · used {invite.usedCount}
                      {invite.maxUses !== null ? ` of ${invite.maxUses}` : ''}
                      {invite.redeemBy ? ` · redeem by ${formatDate(invite.redeemBy)}` : ''}
                      {invite.note ? ` · ${invite.note}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => void copy(link, `link-${invite.id}`)} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] flex items-center gap-1.5 cursor-pointer">
                      {copied === `link-${invite.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy invite link
                    </button>
                    <button type="button" onClick={() => void toggle(invite)} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#475569] cursor-pointer">
                      {invite.isActive ? 'Switch off' : 'Switch on'}
                    </button>
                  </div>
                </div>
                {invite.practices.length > 0 ? (
                  <ul className="mt-3 border-t border-[#F1F5F9] pt-3 space-y-1.5">
                    {invite.practices.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                        <Link to={`/admin/tenants/${p.id}`} className="font-semibold text-[#0F3A53] hover:underline truncate">{p.name}</Link>
                        <span className="text-[#64748B] shrink-0">
                          {p.complimentaryUntil ? `${p.tier === 'CLINIC' ? 'Clinic' : 'Pro'} until ${formatDate(p.complimentaryUntil)}` : `Ended · now ${p.tier.charAt(0)}${p.tier.slice(1).toLowerCase()}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
