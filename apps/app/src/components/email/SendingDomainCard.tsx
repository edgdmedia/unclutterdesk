import { useEffect, useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

interface SendingDnsRecord {
  purpose: string;
  type: string;
  name: string;
  value: string;
  priority?: number;
  status: string;
}

export interface SendingDomainView {
  available: boolean;
  platformSender: string;
  domain: string | null;
  status?: string;
  fromLocalPart?: string;
  fromAddress?: string;
  sendingFrom?: string;
  records?: SendingDnsRecord[];
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  VERIFIED: { label: 'Verified', tone: 'text-emerald-700 bg-emerald-50' },
  PENDING: { label: 'Checking DNS', tone: 'text-amber-700 bg-amber-50' },
  NOT_STARTED: { label: 'Waiting for DNS records', tone: 'text-amber-700 bg-amber-50' },
  PARTIALLY_VERIFIED: { label: 'Partly verified', tone: 'text-amber-700 bg-amber-50' },
  PARTIALLY_FAILED: { label: 'Some records missing', tone: 'text-rose-700 bg-rose-50' },
  FAILED: { label: 'Not found', tone: 'text-rose-700 bg-rose-50' },
  TEMPORARY_FAILURE: { label: 'Records missing, paused', tone: 'text-rose-700 bg-rose-50' },
};

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#E2E8F0] cursor-pointer"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * Lets a practice send its email from a domain it owns. Every practice starts
 * on the platform sender; this card adds its own domain through Resend, shows
 * the DNS records to add, and reports the status.
 */
export function SendingDomainCard() {
  const toast = useToast();
  const [view, setView] = useState<SendingDomainView | null>(null);
  const [domain, setDomain] = useState('');
  const [localPart, setLocalPart] = useState('notifications');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<SendingDomainView>('/v1/tenant/sending-domain')
      .then((v) => {
        if (cancelled) return;
        setView(v);
        if (v.fromLocalPart) setLocalPart(v.fromLocalPart);
      })
      .catch(() => {
        if (!cancelled) setView(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: string, fn: () => Promise<SendingDomainView>, success: string) {
    setBusy(action);
    try {
      const next = await fn();
      setView(next);
      if (next.fromLocalPart) setLocalPart(next.fromLocalPart);
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  if (!view) return null;

  const status = view.status ? STATUS_LABEL[view.status] ?? { label: view.status, tone: 'text-[#475569] bg-[#F1F5F9]' } : null;

  return (
    <Card padding="p-[22px]" className="space-y-3">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
        <Mail className="h-4 w-4 text-[#0F3A53]" />
        <Eyebrow>SENDING EMAIL</Eyebrow>
      </div>

      <p className="text-[12px] text-[#475569] leading-relaxed">
        Booking emails show your practice name and reply to your contact email. They currently go out from{' '}
        <span className="font-mono font-bold text-[#0F172A]">{view.sendingFrom ?? view.platformSender}</span>.
      </p>

      {!view.domain ? (
        view.available ? (
          <div className="space-y-2.5">
            <p className="text-[11.5px] text-[#64748B] leading-relaxed">
              To send from your own domain, enter it below. A subdomain such as{' '}
              <span className="font-mono">mail.yourpractice.com</span> keeps this separate from your everyday email.
            </p>
            <div className="grid grid-cols-[1fr_auto_1.4fr] items-center gap-1.5">
              <input
                aria-label="Sender name"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                className="h-[42px] px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[12.5px] font-mono font-bold text-[#0F172A] outline-none"
              />
              <span className="text-[13px] font-bold text-[#94A3B8]">@</span>
              <input
                aria-label="Sending domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mail.yourpractice.com"
                className="h-[42px] px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[12.5px] font-mono font-bold text-[#0F172A] outline-none"
              />
            </div>
            <button
              type="button"
              disabled={!domain.trim() || busy !== null}
              onClick={() =>
                void run(
                  'add',
                  () => api.post<SendingDomainView>('/v1/tenant/sending-domain', { domain, fromLocalPart: localPart }),
                  'Domain added. Now add the DNS records below.',
                )
              }
              className="h-[38px] px-3.5 rounded-[11px] bg-[#0F3A53] text-white text-[12px] font-bold disabled:opacity-50 cursor-pointer"
            >
              {busy === 'add' ? 'Adding…' : 'Use this domain'}
            </button>
          </div>
        ) : (
          <p className="text-[11.5px] text-[#64748B] leading-relaxed">Sending from your own domain is not available yet.</p>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-mono text-[12.5px] font-bold text-[#0F172A]">{view.fromAddress}</span>
            {status ? <span className={`text-[10.5px] font-bold rounded-full px-2.5 py-0.5 ${status.tone}`}>{status.label}</span> : null}
          </div>

          {view.status !== 'VERIFIED' ? (
            <p className="text-[11.5px] text-[#64748B] leading-relaxed">
              At your domain provider, add these records exactly as shown, then press <span className="font-bold">Check again</span>.
              DNS changes can take a few minutes, sometimes longer. Until then, email keeps going out from{' '}
              <span className="font-mono">{view.platformSender}</span>.
            </p>
          ) : null}

          {view.records && view.records.length ? (
            <div className="space-y-2">
              {view.records.map((r, i) => (
                <div key={`${r.purpose}-${r.type}-${i}`} className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                    <span>
                      {r.purpose} · {r.type}
                      {r.priority != null ? ` · priority ${r.priority}` : ''}
                    </span>
                    <span className={r.status === 'VERIFIED' ? 'text-emerald-700' : 'text-amber-700'}>
                      {r.status === 'VERIFIED' ? 'Found' : 'Not found yet'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="w-12 shrink-0 text-[#94A3B8] font-bold">Name</span>
                    <span className="font-mono text-[#0F172A] break-all flex-1">{r.name}</span>
                    <CopyValue value={r.name} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="w-12 shrink-0 text-[#94A3B8] font-bold">Value</span>
                    <span className="font-mono text-[#0F172A] break-all flex-1">{r.value}</span>
                    <CopyValue value={r.value} />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Some providers add your domain to the name automatically. If yours does, enter only the part shown.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run('verify', () => api.post<SendingDomainView>('/v1/tenant/sending-domain/verify', {}), 'Checked. The status below is current.')
              }
              className="h-[36px] px-3 rounded-[10px] bg-[#0F3A53] text-white text-[11.5px] font-bold disabled:opacity-50 cursor-pointer"
            >
              {busy === 'verify' ? 'Checking…' : 'Check again'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (!window.confirm(`Stop sending from ${view.domain}? Email will go out from ${view.platformSender} instead.`)) return;
                void run('remove', () => api.delete<SendingDomainView>('/v1/tenant/sending-domain'), 'Domain removed');
              }}
              className="h-[36px] px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-rose-700 text-[11.5px] font-bold disabled:opacity-50 cursor-pointer"
            >
              {busy === 'remove' ? 'Removing…' : 'Remove'}
            </button>
          </div>

          <div className="flex items-end gap-1.5 pt-1">
            <label className="flex-1 space-y-1">
              <span className="text-[11px] font-bold text-[#475569]">Sender name before the @</span>
              <input
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                className="w-full h-[38px] px-3 rounded-[11px] bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] font-mono font-bold text-[#0F172A] outline-none"
              />
            </label>
            <button
              type="button"
              disabled={busy !== null || localPart === view.fromLocalPart}
              onClick={() =>
                void run('sender', () => api.patch<SendingDomainView>('/v1/tenant/sending-domain', { fromLocalPart: localPart }), 'Sender updated')
              }
              className="h-[38px] px-3 rounded-[11px] border border-[#E2E8F0] bg-white text-[11.5px] font-bold text-[#0F172A] disabled:opacity-50 cursor-pointer"
            >
              {busy === 'sender' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
