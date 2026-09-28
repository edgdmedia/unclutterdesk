const chip = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold';

export function PaymentChip({ status, paymentMethod, holdExpiresAt }: { status: string; paymentMethod?: string; holdExpiresAt?: string | null }) {
  if (status === 'PENDING_PAYMENT') {
    const until = holdExpiresAt
      ? ` · until ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(holdExpiresAt))}`
      : '';
    return <span className={`${chip} bg-amber-100 text-amber-800`}>Awaiting payment{until}</span>;
  }
  if (status === 'CANCELLED') return null;
  if (paymentMethod === 'NONE') return <span className={`${chip} bg-slate-100 text-slate-700`}>No charge</span>;
  return <span className={`${chip} bg-emerald-100 text-emerald-800`}>Paid</span>;
}
