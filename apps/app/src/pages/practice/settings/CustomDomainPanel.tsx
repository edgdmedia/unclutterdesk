import React, { useCallback, useEffect, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

type DomainStatus = {
  id: string;
  hostname: string | null;
  status: string | null;
  error: string | null;
  cnameTarget: string | null;
  records: Array<{ name: string; type: string; data: string }>;
  cfStatus: { status: string; sslStatus: string } | null;
};

const inputCls = 'h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]';

/**
 * SET-13: a practice's own booking address. Saving hands the domain to
 * Cloudflare; the records below are everything the practice publishes at its
 * domain provider, and the platform flips the address live on its own once
 * they are in place.
 */
export function CustomDomainPanel() {
  const toast = useToast();
  const [state, setState] = useState<DomainStatus | null>(null);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return api.get<DomainStatus>('/v1/tenant/brand/custom-domain')
      .then((data) => { setState(data); setDomain(data.hostname || ''); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      await api.patch('/v1/tenant/brand', { customDomain: domain.trim() });
      toast.success(domain.trim() ? 'Domain saved — Cloudflare is preparing it' : 'Custom domain removed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the domain');
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
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

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      // The value is on screen to copy by hand.
    }
  }

  const chip = !state?.hostname
    ? { label: 'No custom domain', cls: 'bg-[#F1F5F9] text-[#64748B]' }
    : state.status === 'ACTIVE'
      ? { label: 'Live', cls: 'bg-[#ECFDF5] text-[#059669]' }
      : state.status === 'FAILED'
        ? { label: 'Needs attention', cls: 'bg-rose-50 text-[#B42318]' }
        : { label: 'Waiting on DNS', cls: 'bg-[#FFFBEB] text-[#B45309]' };

  return (
    <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow className="mb-1">CUSTOM DOMAIN</Eyebrow>
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-[#0F172A]">Your own booking address</h3>
          <p className="text-[12.5px] text-[#64748B] font-medium mt-0.5">
            Clients book you at your domain instead of a unclutterdesk.com address.
          </p>
        </div>
        <span className={`h-[26px] px-3 rounded-full text-[11px] font-black tracking-[0.04em] uppercase flex items-center shrink-0 ${chip.cls}`}>
          {chip.label}
        </span>
      </div>

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
      {state?.error ? (
        <p className="mt-2 text-[12.5px] font-medium text-[#B42318]">{state.error}</p>
      ) : null}

      {state?.hostname && state.status !== 'ACTIVE' ? (
        <div className="mt-4 rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
          <div className="text-[12.5px] text-[#475569] font-medium leading-relaxed">
            Publish these records at your domain provider (where you bought the domain).
            Once DNS points here, the certificate is issued automatically and your address
            goes live on its own — usually within minutes, up to an hour for DNS to spread.
          </div>
          {state.records.length > 0 ? (
            <div className="space-y-2">
              {state.records.map((record) => (
                <div key={`${record.type}:${record.name}`} className="flex items-center gap-2 text-[12.5px] bg-white border border-[#E2E8F0] rounded-[12px] px-3 py-2">
                  <span className="font-black text-[#94A3B8] uppercase w-[52px] shrink-0">{record.type}</span>
                  <span className="flex-1 min-w-0 break-all font-medium text-[#0F172A]">{record.name}</span>
                  <span className="flex-1 min-w-0 break-all text-[#475569]">{record.data}</span>
                  <button
                    type="button"
                    aria-label={`Copy ${record.type} record`}
                    onClick={() => void copy(record.data, record.type)}
                    className="h-8 px-2.5 rounded-[8px] border border-[#CBD5E1] bg-white text-[11.5px] font-bold text-[#0F172A] cursor-pointer shrink-0"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {state.cnameTarget ? (
            <div className="flex items-center gap-2 text-[12.5px] bg-white border border-[#E2E8F0] rounded-[12px] px-3 py-2">
              <span className="font-black text-[#94A3B8] uppercase w-[52px] shrink-0">CNAME</span>
              <span className="flex-1 min-w-0 break-all font-medium text-[#0F172A]">{state.hostname}</span>
              <span className="flex-1 min-w-0 break-all text-[#475569]">{state.cnameTarget}</span>
              <button
                type="button"
                aria-label="Copy CNAME target"
                onClick={() => void copy(state.cnameTarget!, 'CNAME target')}
                className="h-8 px-2.5 rounded-[8px] border border-[#CBD5E1] bg-white text-[11.5px] font-bold text-[#0F172A] cursor-pointer shrink-0"
              >
                Copy
              </button>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-[#94A3B8] font-medium">
              {state.cfStatus ? `Cloudflare: hostname ${state.cfStatus.status}, certificate ${state.cfStatus.sslStatus}.` : 'Checking with Cloudflare…'}
            </span>
            <button
              type="button"
              onClick={() => void checkNow()}
              disabled={busy}
              className="h-[34px] px-3 rounded-[10px] border border-[#CBD5E1] bg-white text-[12px] font-bold text-[#0F3A53] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {state.cfStatus ? <RefreshCw className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Check now
            </button>
          </div>
        </div>
      ) : null}

      {state?.hostname && state.status === 'ACTIVE' ? (
        <p className="mt-3 text-[12.5px] font-medium text-[#059669]">
          Booking links and client emails now use https://{state.hostname}.
        </p>
      ) : null}
    </div>
  );
}
