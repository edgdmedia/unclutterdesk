import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../utils/apiClient';

type Summary = {
  state: 'PAYABLE' | 'PAID' | 'LAPSED';
  serviceTitle: string;
  practitionerName: string;
  startsAt: string;
  amountKobo: string;
  practiceName: string;
};

const naira = (kobo: string) => `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;

export function PayBookingPage() {
  const { bookingId } = useParams();
  const [params] = useSearchParams();
  const t = params.get('t') ?? '';
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Summary>(`/v1/consult/public/bookings/${bookingId}/pay-link?t=${encodeURIComponent(t)}`)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'This payment link is not valid.'));
  }, [bookingId, t]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { paymentUrl } = await api.post<{ paymentUrl: string }>(`/v1/consult/public/bookings/${bookingId}/pay-link`, { t });
      window.location.assign(paymentUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-6 shadow-sm border border-[#E2E8F0] space-y-4">
        {!summary && !error && <Loader2 className="h-5 w-5 animate-spin text-[#64748B] mx-auto" />}
        {summary && (
          <>
            <p className="text-[12px] font-semibold text-[#64748B]">{summary.practiceName}</p>
            <h1 className="text-[18px] font-bold text-[#0F172A]">{summary.serviceTitle}</h1>
            <p className="text-[13px] text-[#334155]">
              With {summary.practitionerName} on{' '}
              {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(summary.startsAt))}
            </p>
            {summary.state === 'PAYABLE' && (
              <button type="button" onClick={pay} disabled={busy} className="w-full h-[44px] rounded-[12px] bg-[#0F3A53] text-white text-[14px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pay {naira(summary.amountKobo)}
              </button>
            )}
            {summary.state === 'PAID' && <p className="text-[13px] font-semibold text-emerald-700">This session is already paid.</p>}
            {summary.state === 'LAPSED' && (
              <p className="text-[13px] font-semibold text-amber-700">This booking is no longer held. Contact {summary.practiceName} to book again.</p>
            )}
          </>
        )}
        {error ? <p className="text-[13px] font-medium text-rose-700">{error}</p> : null}
      </div>
    </main>
  );
}

export default PayBookingPage;
