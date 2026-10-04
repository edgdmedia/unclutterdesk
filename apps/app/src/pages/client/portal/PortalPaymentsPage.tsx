import React, { useCallback, useEffect, useState } from 'react';
import { Page, PageHeader, useBrand } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { BookSessionButton } from './BookSessionButton';
import { formatDay, formatMoney, paymentState } from './portalFormat';
import { usePortalData, type PaymentsPayload } from './PortalDataContext';

/**
 * POR-03: money lives on its own page. The portal load no longer fetches it —
 * this effect runs only when the page mounts, and refetches if a booking
 * moved elsewhere while the person was in the portal.
 */
export function PortalPaymentsPage() {
  const brand = useBrand();
  const { paymentsStale } = usePortalData();
  const [payments, setPayments] = useState<PaymentsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<PaymentsPayload>('/v1/consult/portal/payments')
      .then((p) => { setPayments(p); setError(null); })
      .catch((e: Error) => setError(e.message || 'Could not load your payments.'));
  }, []);

  useEffect(() => {
    load();
  }, [load, paymentsStale]);

  return (
    <Page header={<PageHeader eyebrow={brand.name} title="Payments" actions={<BookSessionButton />} />}>
      <div className="flex flex-col gap-4">
        {error ? (
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
        ) : !payments ? (
          <div className="rounded-[22px] border border-[#E2E8F0] bg-white px-5 py-10 text-sm font-medium text-[#64748B]">Loading your payments...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-[18px_20px]">
                <div className="text-[9px] font-black tracking-[0.18em] uppercase text-[#94A3B8]">TOTAL PAID</div>
                <div className="mt-1.5 text-[24px] font-bold tracking-[-0.02em] text-[#0F172A]">{formatMoney(payments.totalPaidKobo)}</div>
              </div>
              <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-[18px_20px]">
                <div className="text-[9px] font-black tracking-[0.18em] uppercase text-[#94A3B8]">OUTSTANDING</div>
                <div className={`mt-1.5 text-[24px] font-bold tracking-[-0.02em] ${payments.outstandingKobo === '0' ? 'text-[#0F172A]' : 'text-[#B45309]'}`}>
                  {formatMoney(payments.outstandingKobo)}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden">
              {payments.payments.length === 0 ? (
                <div className="px-5 py-10 text-sm font-medium text-[#64748B]">No payments yet. Anything you are charged will show up here.</div>
              ) : (
                payments.payments.map((payment, index) => {
                  const state = paymentState(payment);
                  return (
                    <div key={payment.bookingId} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-[16px] ${index > 0 ? 'border-t border-[#F1F5F9]' : ''}`}>
                      <div className="flex-1 min-w-[180px]">
                        <div className="text-[14px] font-bold text-[#0F172A]">{payment.serviceTitle}</div>
                        <div className="text-[12px] text-[#64748B] font-medium">
                          Session {formatDay(payment.sessionAt)}
                          {payment.discountCode ? ` · ${payment.discountCode} applied` : ''}
                        </div>
                        {payment.reference ? (
                          <div className="text-[10.5px] text-[#94A3B8] font-medium mt-0.5 break-all">Ref {payment.reference}</div>
                        ) : null}
                      </div>
                      <span className={`h-[22px] px-2.5 rounded-full text-[9.5px] font-black tracking-[0.06em] uppercase flex items-center ${state.cls}`}>{state.label}</span>
                      <div className="text-right min-w-[92px]">
                        <div className="text-[13.5px] font-extrabold text-[#0F172A]">{formatMoney(payment.amountKobo)}</div>
                        <div className="text-[11px] text-[#94A3B8] font-medium">{payment.paidAt ? formatDay(payment.paidAt) : '—'}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-[11.5px] text-[#94A3B8] leading-[1.6]">
              Amounts are what you were charged at the time of booking. For a formal receipt, contact the practice.
            </p>
          </>
        )}
      </div>
    </Page>
  );
}
