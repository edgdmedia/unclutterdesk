import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, tenantBrandStyle } from '@unclutterdesk/ui';
import { API_BASE, api, getSubdomainTenantSlug } from '../../../utils/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { STEP_PARAM, canContinue, initialState, stepFromUrl, wizardReducer, type Step } from './bookingWizard';
import { formatOf, whenLabel } from './bookingSlots';
import { useBookingData } from './useBookingData';
import { payInPopup } from './paystackPopup';
import {
  AlertBanner,
  BookingHeader,
  BookingProgress,
  PoweredBy,
  StepCard,
  StickyActionBar,
  SummaryCard,
  naira,
  useBookingLayout,
} from './BookingShell';
import { ServiceStep } from './ServiceStep';
import { TimeStep } from './TimeStep';
import { DetailsStep, type BookingClient } from './DetailsStep';
import { ReviewPayStep, totalKobo } from './ReviewPayStep';
import { ConfirmationStep, type ConfirmedBooking } from './ConfirmationStep';

type BookingResponse = ConfirmedBooking & {
  status: string;
  paymentUrl?: string | null;
  accessCode?: string | null;
  reference?: string | null;
};

const TITLES: Record<1 | 2 | 3 | 4, string> = { 1: 'Choose a session', 2: 'Pick a time', 3: 'Your details', 4: 'Review and pay' };

/**
 * The client booking flow at a practice's booking link: service, time,
 * details, pay, then the confirmation. Replaces the old one-page form.
 * `previewSlug` renders a practice from outside its own host (Brand settings).
 */
export function BookingWizardPage({ previewSlug }: { previewSlug?: string } = {}) {
  const slug = previewSlug || getSubdomainTenantSlug() || '';
  const data = useBookingData(slug, previewSlug);
  const practice = data.practice;
  const style = useMemo(
    () => tenantBrandStyle(practice?.primaryColor || '#0F3A53', practice?.secondaryColor || '#E3B341') as React.CSSProperties,
    [practice?.primaryColor, practice?.secondaryColor],
  );

  return (
    <div className="desk-tenant min-h-screen h-screen flex flex-col bg-[#F8FAFC] font-outfit text-[#0F172A]" style={style}>
      <BookingHeader
        name={practice?.name || 'Booking'}
        logoUrl={practice?.logoUrl}
        rating={{ average: data.reviews.averageRating ?? 0, count: data.reviews.count }}
        profileHref="/"
      />
      {data.status === 'ready' && practice ? (
        <Wizard data={data} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 min-[601px]:px-8 min-[601px]:py-7">
          <div className="max-w-[640px] mx-auto">
            {data.status === 'error' ? (
              <AlertBanner title="We couldn't load this practice's booking page">Check your connection and refresh the page.</AlertBanner>
            ) : (
              <StepCard step={1} title={TITLES[1]}>
                <ServiceStep status="loading" services={[]} slots={[]} selectedId={null} onChoose={() => {}} />
              </StepCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Wizard({ data }: { data: ReturnType<typeof useBookingData> }) {
  const practice = data.practice!;
  const layout = useBookingLayout();
  const { profile, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const single = data.services.length === 1 ? data.services[0].id : null;
  const [state, dispatch] = useReducer(wizardReducer, undefined, () => {
    const s = initialState({ singleServiceId: single });
    // Nothing is chosen yet on arrival, so this lands on the first step whatever the address asks for.
    return { ...s, step: stepFromUrl(params.get('step'), s) };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ booking: ConfirmedBooking; mode: 'paid' | 'transfer' } | null>(null);
  const lastBooking = useRef<BookingResponse | null>(null);

  // Keep the address in step with the wizard, without a history entry per step.
  useEffect(() => {
    if (params.get('step') !== STEP_PARAM[state.step]) {
      const next = new URLSearchParams(params);
      next.set('step', STEP_PARAM[state.step]);
      setParams(next, { replace: true });
    }
  }, [state.step, params, setParams]);

  // Only a client account can book; staff signed in on the same browser are asked to sign in as a client.
  const me: BookingClient | null =
    profile && (profile.role === 'CLIENT' || profile.type === 'user')
      ? { firstName: profile.firstName, lastName: profile.lastName, email: profile.email, phone: (profile as { phone?: string | null }).phone ?? null }
      : null;
  const service = data.services.find((s) => s.id === state.serviceId) ?? null;
  const slot = data.slots.find((s) => s.id === state.slotId) ?? null;
  const total = service ? totalKobo(service, state) : null;

  function bookingBody(extra: Record<string, unknown> = {}) {
    return {
      serviceId: state.serviceId,
      availabilityId: state.slotId,
      phone: me?.phone ?? undefined,
      notes: state.note.trim() || undefined,
      discountCode: state.discount.status === 'applied' ? state.discount.code : undefined,
      ...extra,
    };
  }

  async function pay() {
    if (!service || !slot) return;
    setBusy(true);
    setError(null);
    try {
      if (state.payMethod === 'transfer') {
        const res = await api.post<BookingResponse>('/v1/consult/public/bookings', bookingBody({ paymentMethod: 'MANUAL' }));
        setConfirmed({ booking: res, mode: 'transfer' });
        dispatch({ type: 'paid' });
        return;
      }

      let accessCode: string | null | undefined;
      if (!state.bookingId) {
        const res = await api.post<BookingResponse>('/v1/consult/public/bookings', bookingBody());
        lastBooking.current = res;
        if (res.status === 'CONFIRMED') {
          // Free, or fully discounted: nothing to pay.
          setConfirmed({ booking: res, mode: 'paid' });
          dispatch({ type: 'paid' });
          return;
        }
        dispatch({ type: 'booked', bookingId: res.bookingId });
        accessCode = res.accessCode;
      } else {
        // Same booking as the attempt that didn't go through, not a second hold.
        const res = await api.post<{ accessCode?: string | null }>(`/v1/consult/public/bookings/${state.bookingId}/pay`, { email: me?.email });
        accessCode = res.accessCode;
      }
      if (!accessCode) throw new Error('Could not start the payment. Try again.');

      const outcome = await payInPopup(accessCode);
      if (outcome !== 'success') {
        dispatch({ type: 'paymentFailed' });
        return;
      }
      const bookingId = state.bookingId ?? lastBooking.current?.bookingId;
      await api.post(`/v1/consult/public/bookings/${bookingId}/confirm-payment`, {});
      setConfirmed({ booking: lastBooking.current!, mode: 'paid' });
      dispatch({ type: 'paid' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      if (/no longer available/i.test(message)) {
        dispatch({ type: 'slotTaken' });
      } else if (state.bookingId || lastBooking.current) {
        dispatch({ type: 'paymentFailed' });
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onContinue() {
    if (state.step === 2) {
      setBusy(true);
      try {
        const fresh = await data.reloadSlots();
        if (!fresh.some((s) => s.id === state.slotId)) {
          dispatch({ type: 'slotTaken' });
          return;
        }
      } catch {
        // Can't re-check right now; booking re-checks on the server anyway.
      } finally {
        setBusy(false);
      }
    }
    if (state.step === 4) return void pay();
    dispatch({ type: 'next' });
  }

  if (state.step === 5 && confirmed) {
    return (
      <main className="flex-1 overflow-y-auto px-4 py-4 min-[601px]:px-8 min-[601px]:py-7">
        <div className="max-w-[640px] mx-auto flex flex-col gap-4">
          <ConfirmationStep booking={confirmed.booking} channel={slot?.channel ?? 'VIDEO'} mode={confirmed.mode} apiBase={API_BASE ?? ''} />
          <PoweredBy />
        </div>
      </main>
    );
  }

  const step = state.step as 1 | 2 | 3 | 4;
  const ctaLabel =
    step === 3
      ? 'Continue to payment'
      : step === 4
        ? state.payMethod === 'transfer'
          ? 'Hold my time'
          : state.paymentStatus === 'failed'
            ? `Try again · ${naira(total ?? '0')}`
            : `Pay ${naira(total ?? '0')}`
        : 'Continue';
  const ctaDisabled = !canContinue(state, Boolean(me)) || (step === 1 && data.services.length === 0);
  const onBack = state.step > state.firstStep ? () => dispatch({ type: 'back' }) : undefined;
  const therapistName = slot?.therapistName ?? data.slots[0]?.therapistName ?? null;

  const subs: Record<1 | 2 | 3 | 4, string> = {
    1: `Pick the kind of session you would like with ${therapistName ?? practice.name}.`,
    2: 'Each time is either online or in person, as set by the practice.',
    3: me ? 'You are signed in, so we can go straight on.' : 'Sign in or create an account to book your session.',
    4: 'Check the details of your session before you confirm.',
  };

  const body =
    step === 1 ? (
      <ServiceStep status="ready" services={data.services} slots={data.slots} selectedId={state.serviceId} onChoose={(id) => dispatch({ type: 'chooseService', serviceId: id })} practiceEmail={practice.publicEmail} />
    ) : step === 2 && service ? (
      <TimeStep
        service={service}
        slots={data.slots}
        today={today}
        state={state}
        dispatch={dispatch}
        practiceAddress={[practice.address, practice.city].filter(Boolean).join(', ') || null}
        practiceContact={{ email: practice.publicEmail, phone: practice.publicPhone }}
        singleService={Boolean(single)}
        onChangeService={() => dispatch({ type: 'goTo', step: 1 })}
      />
    ) : step === 3 ? (
      <DetailsStep
        me={me}
        onSignOut={() => void logout()}
        onSignedIn={() => dispatch({ type: 'next' })}
        note={state.note}
        onNote={(note) => dispatch({ type: 'setNote', note })}
        therapistName={therapistName}
      />
    ) : step === 4 && service && slot ? (
      <>
        {error ? <AlertBanner title="We couldn't make this booking">{error}</AlertBanner> : null}
        <ReviewPayStep service={service} slot={slot} state={state} dispatch={dispatch} bankTransfer={data.bankTransfer} tenantId={practice.id} cancellationHours={practice.cancellationHours} />
      </>
    ) : null;

  const desktopNav = (
    <>
      {onBack ? <Button variant="secondary" size="xl" onClick={onBack}>Back</Button> : <span />}
      <Button variant="primary" size="cta" disabled={ctaDisabled || busy} onClick={() => void onContinue()}>
        {busy ? 'One moment…' : ctaLabel}
      </Button>
    </>
  );

  return (
    <>
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 min-[601px]:px-8 min-[601px]:pt-7 min-[601px]:pb-6 min-[1024px]:pb-10">
        <div className={layout === 'desktop' ? 'max-w-[1200px] mx-auto grid gap-6 grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] items-start' : 'max-w-[640px] mx-auto'}>
          <div className="flex flex-col gap-[18px] min-w-0">
            <BookingProgress step={state.step as Step} firstStep={state.firstStep} onGoTo={(s) => dispatch({ type: 'goTo', step: s })} />
            <StepCard step={step} title={TITLES[step]} sub={subs[step]} onBack={onBack} footer={desktopNav}>
              {body}
            </StepCard>
            <PoweredBy />
          </div>
          {layout === 'desktop' ? (
            <SummaryCard
              therapist={slot ? { name: slot.therapistName, title: slot.therapistTitle } : null}
              practiceName={practice.name}
              serviceLabel={service ? `${service.title} · ${service.durationMinutes} min` : null}
              whenLabel={slot ? whenLabel(slot.startsAt) : null}
              formatLabel={slot ? formatOf(slot.channel) : null}
              totalKobo={total}
              cancellationHours={practice.cancellationHours}
            />
          ) : null}
        </div>
      </main>
      {layout !== 'desktop' && !(step === 1 && data.services.length === 0) ? (
        <StickyActionBar totalKobo={service ? total : null} label={ctaLabel} disabled={ctaDisabled} busy={busy} onClick={() => void onContinue()} />
      ) : null}
    </>
  );
}
