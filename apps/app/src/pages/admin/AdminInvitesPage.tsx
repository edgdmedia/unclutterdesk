import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { Copy, Check, Loader2, Mail, Ticket } from 'lucide-react';
import { api, APP_BASE_URL } from '../../utils/apiClient';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
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
  sends: InviteSend[];
}

interface InviteSend {
  id: string;
  email: string;
  message: string | null;
  delivered: boolean;
  sentBy: string | null;
  createdAt: string;
}

/** Matches the server's limit on the personal message. */
const MAX_MESSAGE = 1000;

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
  const toast = useToast();
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
  const [composer, setComposer] = useState<{ inviteId: string; email: string; message: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
      toast.success('Invite code created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the code');
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
      toast.success('Invite code updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the code');
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  function openComposer(inviteId: string, email = '', message = '') {
    setSendError(null);
    setComposer({ inviteId, email, message });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!composer) return;
    setSending(true);
    setSendError(null);
    try {
      await api.post(`/v1/admin/invites/${composer.inviteId}/send`, {
        email: composer.email.trim(),
        message: composer.message.trim(),
      });
      toast.success(`Invite sent to ${composer.email.trim()}`);
      setComposer(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send the invite';
      toast.error(message);
      setSendError(message);
    } finally {
      setSending(false);
      // A refused email is still recorded, so the history changes either way.
      await mutate();
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
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openComposer(invite.id)}
                      disabled={state !== 'Live'}
                      title={state === 'Live' ? undefined : 'Only a live code can be sent'}
                      className="h-9 px-3 rounded-[10px] bg-[#0F3A53] text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Invite by email
                    </button>
                    <button type="button" onClick={() => void copy(link, `link-${invite.id}`)} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] flex items-center gap-1.5 cursor-pointer">
                      {copied === `link-${invite.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy invite link
                    </button>
                    <button type="button" onClick={() => void toggle(invite)} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#475569] cursor-pointer">
                      {invite.isActive ? 'Switch off' : 'Switch on'}
                    </button>
                  </div>
                </div>
                {composer?.inviteId === invite.id ? (
                  <form onSubmit={(e) => void send(e)} className="mt-3 border-t border-[#F1F5F9] pt-3 grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor={`inv-email-${invite.id}`} className={labelCls}>Email address</label>
                      <input
                        id={`inv-email-${invite.id}`}
                        type="email"
                        required
                        autoFocus
                        value={composer.email}
                        onChange={(e) => setComposer({ ...composer, email: e.target.value })}
                        placeholder="name@practice.com"
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`inv-msg-${invite.id}`} className={labelCls}>Personal message (optional)</label>
                      <textarea
                        id={`inv-msg-${invite.id}`}
                        value={composer.message}
                        maxLength={MAX_MESSAGE}
                        onChange={(e) => setComposer({ ...composer, message: e.target.value })}
                        placeholder="A line or two above the invite, e.g. where you met."
                        className={`${inputCls} h-auto min-h-[84px] py-2.5`}
                      />
                      <p className="text-[11px] text-[#94A3B8]">
                        The email includes the invite link, the code and what it gives. {composer.message.length}/{MAX_MESSAGE}
                      </p>
                    </div>
                    {sendError ? (
                      <p role="alert" className="rounded-[12px] bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">{sendError}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={sending} className="h-9 px-4 rounded-[10px] bg-[#0F3A53] text-white text-xs font-bold cursor-pointer disabled:opacity-60">
                        {sending ? 'Sending…' : 'Send invite'}
                      </button>
                      <button type="button" onClick={() => setComposer(null)} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#475569] cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
                {invite.sends.length > 0 ? (
                  <div className="mt-3 border-t border-[#F1F5F9] pt-3">
                    <p id={`inv-sends-${invite.id}`} className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#94A3B8]">Sent by email</p>
                    <ul aria-labelledby={`inv-sends-${invite.id}`} className="mt-1.5 space-y-1.5">
                      {invite.sends.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-[#0F172A] truncate">{s.email}</span>
                            {s.delivered ? null : (
                              <span className="text-[10px] font-bold uppercase tracking-[0.06em] rounded-full px-2 py-0.5 bg-rose-50 text-rose-700">Not delivered</span>
                            )}
                          </span>
                          <span className="flex items-center gap-2 text-[#64748B] shrink-0">
                            {formatDate(s.createdAt)}{s.sentBy ? ` · ${s.sentBy}` : ''}
                            {state === 'Live' ? (
                              <button type="button" onClick={() => openComposer(invite.id, s.email, s.message ?? '')} className="font-bold text-[#0F3A53] hover:underline cursor-pointer">
                                Resend
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
