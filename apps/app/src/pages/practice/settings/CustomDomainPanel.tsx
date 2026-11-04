import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { useEntitlements } from '../../../utils/entitlements';
import { Link } from 'react-router-dom';
import { TENANT_ROOT_DOMAIN } from '../../../config/domains';

type DomainRecord = { type: string; name: string; value: string; state: 'verified' | 'missing' | 'unknown' };
type DomainStatus = {
  id: string;
  hostname: string | null;
  status: string | null;
  error: string | null;
  cnameTarget: string | null;
  records: DomainRecord[];
  cfStatus: { status: string; sslStatus: string } | null;
};

const inputCls = 'h-[46px] w-full px-[14px] rounded-[14px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-sm text-[var(--desk-text)] outline-none focus:bg-white focus:border-[var(--desk-border-strong)]';

/**
 * SET-13: a practice's own booking address. Saving hands the domain to
 * Cloudflare; the table below lists every record we expect at the practice's
 * domain provider — each one checked against public DNS and marked Set or
 * Not found yet — and the address goes live on its own once all of them are.
 */
export function CustomDomainPanel() {
  const toast = useToast();
  const [state, setState] = useState<DomainStatus | null>(null);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const plan = useEntitlements();
  // Locked only once the plan is known not to include it; a domain already
  // set stays visible so the practice can see and remove it.
  const locked = plan?.entitlements.customDomain === false && !state?.hostname;

  const load = useCallback(() => {
    return api.get<DomainStatus>('/v1/tenant/brand/custom-domain')
      .then((data) => { setState(data); setDomain((current) => current || data.hostname || ''); return data; })
      .catch(() => null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      await api.patch('/v1/tenant/brand', { customDomain: domain.trim().toLowerCase() });
      toast.success(domain.trim() ? 'Domain saved — Cloudflare is preparing it' : 'Custom domain removed');
      const fresh = await load();
      if (fresh) setDomain(fresh.hostname || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the domain');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function verify() {
    setBusy(true);
    try {
      await api.post('/v1/tenant/brand/custom-domain/verify', {});
      toast.success('Your domain is live');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Not verified yet');
    } finally {
      await load();
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied');
    } catch {
      // The value is on screen to copy by hand.
    }
  }

  const chip = !state?.hostname
    ? { label: 'No custom domain', cls: 'bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)]' }
    : state.status === 'ACTIVE'
      ? { label: 'Live', cls: 'bg-[var(--desk-active-bg)] text-[var(--desk-active)]' }
      : state.status === 'FAILED'
        ? { label: 'Needs attention', cls: 'bg-rose-50 text-[var(--desk-danger)]' }
        : { label: 'Waiting on DNS', cls: 'bg-[var(--desk-pending-bg)] text-[var(--desk-pending)]' };

  const stateChip = (record: DomainRecord) => {
    if (record.state === 'verified') {
      return <span className="inline-flex items-center gap-1 h-[24px] px-2.5 rounded-full bg-[var(--desk-active-bg)] text-[var(--desk-active)] text-[11px] font-bold"><Check className="h-3 w-3" strokeWidth={3} /> Set</span>;
    }
    if (record.state === 'missing') {
      return <span className="inline-flex items-center gap-1 h-[24px] px-2.5 rounded-full bg-[var(--desk-pending-bg)] text-[var(--desk-pending)] text-[11px] font-bold"><X className="h-3 w-3" strokeWidth={3} /> Not found yet</span>;
    }
    return <span className="inline-flex items-center gap-1 h-[24px] px-2.5 rounded-full bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)] text-[11px] font-bold"><RefreshCw className="h-3 w-3" /> Checking…</span>;
  };

  return (
    <div className="bg-white rounded-[24px] border border-[var(--desk-border)] p-[24px_26px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow className="mb-1">CUSTOM DOMAIN</Eyebrow>
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--desk-text)]">Your own booking address</h3>
          <p className="text-[12.5px] text-[var(--desk-text-muted)] font-medium mt-0.5">
            Clients book you at your domain instead of a {TENANT_ROOT_DOMAIN} address.
          </p>
        </div>
        <span className={`h-[26px] px-3 rounded-full text-[11px] font-black tracking-[0.04em] uppercase flex items-center shrink-0 ${chip.cls}`}>
          {chip.label}
        </span>
      </div>

      {locked ? (
        <div className="mt-4 rounded-[16px] bg-[var(--desk-surface)] border border-[var(--desk-border)] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-[var(--desk-text-body)]">
            A custom domain is part of the Pro plan. You're on {plan?.tierName}.
          </p>
          <Link to="/dashboard/settings/subscription" className="h-[38px] px-4 rounded-[12px] text-white text-[13px] font-bold flex items-center" style={{ backgroundColor: '#0F3A53' }}>
            See plans
          </Link>
        </div>
      ) : (
      <div className="flex gap-3 mt-4">
        <input
          className={inputCls}
          placeholder="book.yourpractice.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value.toLowerCase())}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !state}
          className="h-[46px] px-5 rounded-[14px] text-white text-sm font-bold cursor-pointer disabled:opacity-60 shrink-0"
          style={{ backgroundColor: '#0F3A53' }}
        >
          {busy ? 'Working…' : 'Save domain'}
        </button>
      </div>
      )}
      {state?.error ? (
        <p className="mt-2 text-[12.5px] font-medium text-[var(--desk-danger)]">{state.error}</p>
      ) : null}

      {state?.hostname && state.status !== 'ACTIVE' && state.records.length > 0 ? (
        <div className="mt-4 rounded-[18px] border border-[var(--desk-border)] overflow-hidden">
          <div className="px-4 py-3 bg-[var(--desk-surface)] border-b border-[var(--desk-border)] flex items-center justify-between gap-3">
            <div className="text-[12.5px] font-bold text-[var(--desk-text)]">DNS records to add at your domain provider</div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="h-[30px] px-2.5 rounded-[9px] border border-[var(--desk-pine-200)] bg-white text-[11.5px] font-bold text-[var(--desk-text-body)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Re-check
            </button>
          </div>
          <table className="w-full text-left">
            <tbody>
              {state.records.map((record) => (
                <tr key={`${record.type}:${record.name}:${record.value}`} className="border-b border-[var(--desk-border-soft)] last:border-b-0">
                  <td className="px-4 py-3 align-top w-[64px]">
                    <span className="text-[10px] font-black tracking-[0.08em] uppercase text-[var(--desk-text-subtle)]">{record.type}</span>
                  </td>
                  <td className="px-2 py-3 align-top min-w-0">
                    <div className="text-[12.5px] font-semibold text-[var(--desk-text)] break-all">{record.name}</div>
                    <div className="text-[12px] text-[var(--desk-text-body)] break-all mt-0.5">{record.value}</div>
                  </td>
                  <td className="px-2 py-3 align-top whitespace-nowrap">
                    <button
                      type="button"
                      aria-label={`Copy ${record.type} record for ${record.name}`}
                      onClick={() => void copy(record.value)}
                      className="h-[30px] w-[30px] rounded-[9px] border border-[var(--desk-pine-200)] bg-white inline-flex items-center justify-center cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5 text-[var(--desk-text-body)]" />
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-right">{stateChip(record)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-[var(--desk-surface)] border-t border-[var(--desk-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11.5px] text-[var(--desk-text-muted)] font-medium">
              {state.cfStatus ? (
                <>
                  {state.cfStatus.sslStatus === 'active' && state.cfStatus.status === 'active'
                    ? <ShieldCheck className="h-4 w-4 text-[var(--desk-active)]" />
                    : <ShieldAlert className="h-4 w-4 text-[var(--desk-pending)]" />}
                  Cloudflare — hostname: {state.cfStatus.status} · certificate: {state.cfStatus.sslStatus}. DNS can take up to an hour to spread; everything goes live on its own.
                </>
              ) : (
                <>DNS can take up to an hour to spread; everything goes live on its own.</>
              )}
            </div>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={busy}
              className="h-[34px] px-3.5 rounded-[10px] text-white text-[12px] font-bold cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: '#0F3A53' }}
            >
              Verify & go live
            </button>
          </div>
        </div>
      ) : null}

      {state?.hostname && state.status !== 'ACTIVE' && state.records.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[var(--desk-text-muted)] font-medium">
          Waiting for Cloudflare to prepare your domain — re-check in a minute.
        </p>
      ) : null}

      {state?.hostname && state.status === 'ACTIVE' ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--desk-active)]">
          <ShieldCheck className="h-4 w-4" /> Live — booking links and client emails now use https://{state.hostname}.
        </p>
      ) : null}
    </div>
  );
}
