import React, { useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { Button, Eyebrow } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { formatOf, whenLabel, type Slot } from './bookingSlots';
import type { WizardAction, WizardState } from './bookingWizard';
import type { PublicService } from './useBookingData';
import { AlertBanner, naira } from './BookingShell';
import { HoldCountdown } from './HoldCountdown';

const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const INK = 'var(--brand-ink, var(--brand-primary))';

/** What the client pays: the agreed price, less any applied discount. */
export function totalKobo(service: PublicService, state: WizardState): string {
  return state.discount.status === 'applied' && state.discount.finalKobo ? state.discount.finalKobo : service.priceKobo;
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'discount' | 'total' }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-[13px] border-t border-[#F1F5F9] first:border-t-0 ${tone === 'total' ? 'bg-[#F8FAFC]' : ''}`}
      style={tone === 'discount' ? { color: '#16A34A' } : undefined}
    >
      <span className={`w-[84px] shrink-0 text-[13.5px] ${tone ? '' : 'text-[#64748B]'} ${tone === 'total' ? 'text-[15px] font-bold text-[#0F172A]' : ''}`}>{label}</span>
      <span className={`flex-1 text-right font-semibold ${tone === 'total' ? 'text-[15px] font-bold text-[#0F172A]' : 'text-[14px] text-[#0F172A]'}`} style={{ ...(tone === 'discount' ? { color: '#16A34A' } : {}), ...TABULAR }}>
        {value}
      </span>
    </div>
  );
}

function PayOption({ checked, onChoose, title, children }: { checked: boolean; onChoose: () => void; title: string; children: React.ReactNode }) {
  return (
    <label
      className="rounded-[18px] p-4 border flex gap-3 cursor-pointer bg-white"
      style={{ borderColor: checked ? 'transparent' : '#E2E8F0', boxShadow: checked ? '0 0 0 2px var(--brand-primary)' : undefined }}
    >
      <input type="radio" name="pay-method" checked={checked} onChange={onChoose} className="sr-only" aria-label={title} />
      <span className="h-5 w-5 rounded-full border-2 inline-flex items-center justify-center shrink-0 mt-0.5" style={{ borderColor: checked ? 'var(--brand-primary)' : '#CBD5E1' }} aria-hidden="true">
        {checked ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--brand-primary)' }} /> : null}
      </span>
      <span>
        <span className="block text-[14.5px] font-bold text-[#0F172A]">{title}</span>
        <span className="block text-[13px] leading-[1.5] text-[#64748B]">{children}</span>
      </span>
    </label>
  );
}

/** Step 4: review and pay (README, Step 4). */
export function ReviewPayStep({
  service,
  slot,
  state,
  dispatch,
  bankTransfer,
  tenantId,
  cancellationHours,
  showSummary = true,
}: {
  service: PublicService;
  slot: Slot;
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  bankTransfer: boolean;
  tenantId: string;
  cancellationHours?: number | null;
  /** False on desktop, where the side card is the summary. */
  showSummary?: boolean;
}) {
  const [discountOpen, setDiscountOpen] = useState(state.discount.status !== 'idle');
  const [code, setCode] = useState(state.discount.code);
  const [checking, setChecking] = useState(false);
  const applied = state.discount.status === 'applied';
  const invalid = state.discount.status === 'invalid';
  const total = totalKobo(service, state);

  async function applyOrRemove() {
    if (applied) {
      setCode('');
      dispatch({ type: 'discount', discount: { code: '', status: 'idle', savingKobo: '0', finalKobo: null } });
      return;
    }
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    setChecking(true);
    try {
      const preview = await api.post<{ code: string; amountSavedKobo: string; finalKobo: string }>(
        '/v1/discount/validate',
        { tenantId, code: cleaned, priceKobo: service.priceKobo },
        { 'X-Tenant-Slug': '' },
      );
      dispatch({ type: 'discount', discount: { code: preview.code, status: 'applied', savingKobo: preview.amountSavedKobo, finalKobo: preview.finalKobo } });
    } catch {
      dispatch({ type: 'discount', discount: { code: cleaned, status: 'invalid', savingKobo: '0', finalKobo: null } });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {state.paymentStatus === 'failed' ? (
        <AlertBanner title="Your payment didn't go through">
          No money was taken. Try again{bankTransfer ? ', or choose bank transfer' : ''}.
        </AlertBanner>
      ) : null}

      {showSummary ? (
      <div className="rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <Row label="Session" value={`${service.title} · ${service.durationMinutes} min`} />
        <Row label="When" value={whenLabel(slot.startsAt)} />
        <Row label="Format" value={formatOf(slot.channel)} />
        <Row label="Therapist" value={slot.therapistName} />
        <Row label="Price" value={naira(service.priceKobo)} />
        {applied ? <Row tone="discount" label={`Discount · ${state.discount.code}`} value={`−${naira(state.discount.savingKobo)}`} /> : null}
        <Row tone="total" label="Total" value={naira(total)} />
      </div>
      ) : null}

      {discountOpen ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              aria-label="Discount code"
              value={applied ? state.discount.code : code}
              disabled={applied}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 min-w-0 h-12 px-3.5 rounded-[14px] bg-[#F8FAFC] border text-[14.5px] uppercase tracking-[.04em] outline-none focus:bg-white"
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', borderColor: invalid ? '#E11D48' : '#E2E8F0' }}
            />
            <Button variant="secondary" size="xl" disabled={checking} onClick={() => void applyOrRemove()}>
              {applied ? 'Remove' : 'Apply'}
            </Button>
          </div>
          {applied ? (
            <p className="text-[12.5px] text-[#16A34A]">You save {naira(state.discount.savingKobo)}. New total {naira(total)}.</p>
          ) : invalid ? (
            <p className="text-[12.5px] text-[#E11D48]">That code isn't valid for this session. Check the spelling or try another.</p>
          ) : null}
        </div>
      ) : (
        <button type="button" onClick={() => setDiscountOpen(true)} className="self-start h-11 inline-flex items-center gap-1 text-[13.5px] font-bold cursor-pointer" style={{ color: INK }}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Have a discount code?
        </button>
      )}

      {/* BKG-09: once the booking exists, the time is held for 35 minutes while they pay. */}
      {state.holdExpiresAt && state.payMethod === 'online' ? <HoldCountdown expiresAt={state.holdExpiresAt} /> : null}

      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="How you'd like to pay">
        <Eyebrow>How you'd like to pay</Eyebrow>
        <PayOption checked={state.payMethod === 'online'} onChoose={() => dispatch({ type: 'setPayMethod', method: 'online' })} title="Pay online">
          Card or bank, through Paystack. Payments processed securely by Paystack.
        </PayOption>
        {bankTransfer ? (
          <PayOption checked={state.payMethod === 'transfer'} onChoose={() => dispatch({ type: 'setPayMethod', method: 'transfer' })} title="Bank transfer">
            Your time is held for 48 hours while you transfer.
          </PayOption>
        ) : null}
      </div>

      {bankTransfer && state.payMethod === 'transfer' ? (
        <div className="rounded-[20px] bg-[#F8FAFC] p-4 text-[13.5px] leading-[1.55] text-[#475569]">
          We'll hold your time for 48 hours. Transfer {naira(total)} using the reference we give you on the next screen, and the practice will confirm once it arrives.
        </div>
      ) : null}

      {showSummary && cancellationHours ? (
        <p className="flex items-center gap-2 text-[13px] text-[#475569]">
          <Clock className="h-[15px] w-[15px]" aria-hidden="true" /> Free cancellation up to {cancellationHours} hours before.
        </p>
      ) : null}
    </div>
  );
}
