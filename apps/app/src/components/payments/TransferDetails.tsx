import { useState } from 'react';
import { Copy, Landmark } from 'lucide-react';
import { useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

export interface ManualPayment {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  instructions?: string | null;
  amountKobo: string;
  reference: string;
  holdExpiresAt: string | null;
  reportedPaidAt?: string | null;
}

const naira = (kobo: string) => `₦${(Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** How to pay a practice by bank transfer, and a button to say it is done. */
export function TransferDetails({ payment, bookingId, email, color }: { payment: ManualPayment; bookingId: string; email?: string; color: string }) {
  const toast = useToast();
  const [reported, setReported] = useState(Boolean(payment.reportedPaidAt));
  const [sending, setSending] = useState(false);

  const rows: Array<[string, string | undefined, boolean]> = [
    ['Bank', payment.bankName, false],
    ['Account name', payment.accountName, false],
    ['Account number', payment.accountNumber, true],
    ['Amount', naira(payment.amountKobo), true],
    ['Reference', payment.reference, true],
  ];

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy. Select it and copy by hand.');
    }
  }

  async function report() {
    if (!email) return;
    setSending(true);
    try {
      await api.post(`/v1/consult/public/bookings/${bookingId}/transfer-sent`, { email });
      setReported(true);
      toast.success('Thanks. The practice will confirm when it arrives.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send that');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-[20px] border border-amber-200 bg-[#FFFBEB] p-4 text-left">
      <div className="flex items-center gap-2 text-[#92400E]">
        <Landmark className="h-4 w-4" />
        <span className="text-[13.5px] font-bold">Pay by bank transfer to confirm</span>
      </div>
      {payment.holdExpiresAt ? (
        <p className="mt-1 text-[12.5px] text-[#92400E]">
          Your time is held until <strong>{when(payment.holdExpiresAt)}</strong>. Use the reference so the practice can match your payment.
        </p>
      ) : null}
      <dl className="mt-3 rounded-[14px] bg-white border border-amber-100 divide-y divide-amber-50">
        {rows.map(([label, value, copyable]) =>
          value ? (
            <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-[12px] font-semibold text-[#64748B]">{label}</dt>
              <dd className="flex items-center gap-2 text-[13.5px] font-bold text-[#0F172A] font-mono">
                {value}
                {copyable ? (
                  <button type="button" onClick={() => void copy(label === 'Amount' ? String(Number(payment.amountKobo) / 100) : value)} aria-label={`Copy ${label.toLowerCase()}`} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      {payment.instructions ? <p className="mt-2 text-[12.5px] text-[#78350F] whitespace-pre-line">{payment.instructions}</p> : null}
      {email ? (
        reported ? (
          <p className="mt-3 text-[12.5px] font-semibold text-[#047857]">You told the practice you have paid. They will confirm your session when it arrives.</p>
        ) : (
          <button
            type="button"
            onClick={() => void report()}
            disabled={sending}
            className="mt-3 h-10 px-4 rounded-[12px] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: color }}
          >
            {sending ? 'Sending…' : 'I have sent the transfer'}
          </button>
        )
      ) : null}
    </div>
  );
}
