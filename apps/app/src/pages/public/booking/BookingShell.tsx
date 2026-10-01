import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, Lock, Star } from 'lucide-react';
import { Button, Eyebrow, UnclutterMark } from '@unclutterdesk/ui';
import { initialsOf } from '../../../utils/initials';
import type { Step } from './bookingWizard';

/** The design's three layouts (README, Global layout). */
export type BookingLayout = 'phone' | 'tablet' | 'desktop';
const TABLET = '(min-width: 601px)';
const DESKTOP = '(min-width: 1024px)';

function readLayout(): BookingLayout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'phone';
  if (window.matchMedia(DESKTOP).matches) return 'desktop';
  if (window.matchMedia(TABLET).matches) return 'tablet';
  return 'phone';
}

/** Breakpoints differ from the workspace shell's, so the wizard keeps its own. */
export function useBookingLayout(): BookingLayout {
  const [layout, setLayout] = useState<BookingLayout>(readLayout);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const lists = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)];
    const update = () => setLayout(readLayout());
    lists.forEach((l) => l.addEventListener('change', update));
    return () => lists.forEach((l) => l.removeEventListener('change', update));
  }, []);
  return layout;
}

export function naira(kobo: string | number | bigint): string {
  return `₦${(Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/**
 * The practice's logo on its brand colour, or its initials on white when it has
 * none or the image won't load (README, Header).
 */
function LogoTile({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <span className="inline-flex items-center justify-center overflow-hidden shrink-0 h-11 w-11 rounded-[14px]" style={{ background: 'var(--brand-primary)', boxShadow: 'var(--desk-shadow-sm)' }}>
        <img src={logoUrl} alt={`${name} logo`} onError={() => setFailed(true)} className="w-full h-full object-contain" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="inline-flex items-center justify-center shrink-0 h-11 w-11 rounded-[14px] bg-white border border-[#E2E8F0] text-[15px] font-extrabold tracking-[.02em]" style={{ color: 'var(--brand-ink, var(--brand-primary))' }}>
      {initialsOf(name, 'UD')}
    </span>
  );
}

export function BookingHeader({
  name,
  logoUrl,
  rating,
  profileHref,
}: {
  name: string;
  logoUrl?: string | null;
  rating: { average: number; count: number } | null;
  profileHref: string;
}) {
  return (
    <header
      className="shrink-0 border-b border-[#E2E8F0] px-4 py-3 min-[601px]:px-8 min-[601px]:py-4"
      style={{ background: 'linear-gradient(120deg, var(--brand-tint), var(--brand-secondary-tint)), #FFFFFF' }}
    >
      <div className="max-w-[640px] min-[1024px]:max-w-[960px] mx-auto flex items-center gap-3">
        <LogoTile name={name} logoUrl={logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold tracking-[-0.01em] text-[#0F172A] truncate">{name}</div>
          {rating && rating.count > 0 ? (
            <a href={profileHref} className="inline-flex items-center gap-1 text-[12.5px] text-[#64748B] hover:underline">
              <Star className="h-3 w-3" fill="#24614F" stroke="#24614F" aria-hidden="true" />
              {`${rating.average.toFixed(1)} · ${rating.count} reviews`}
            </a>
          ) : null}
        </div>
        <span className="h-[30px] px-3 rounded-full bg-white border border-[#E2E8F0] text-[12px] font-semibold text-[#475569] inline-flex items-center gap-1.5 shrink-0">
          <Lock className="h-[13px] w-[13px] text-[#16A34A]" aria-hidden="true" />
          Secure booking
        </span>
      </div>
    </header>
  );
}

const STEP_LABELS: Array<[Step, string]> = [[1, 'Service'], [2, 'Time'], [3, 'Details'], [4, 'Pay']];

export function BookingProgress({ step, onGoTo, firstStep = 1 }: { step: Step; onGoTo: (s: Step) => void; firstStep?: 1 | 2 }) {
  if (step === 5) return null;
  return (
    <nav aria-label="Booking progress" className="grid grid-cols-4 gap-1.5">
      {STEP_LABELS.map(([n, label]) => {
        const done = n < step && n >= firstStep;
        const current = n === step;
        return (
          <button
            key={n}
            type="button"
            onClick={done ? () => onGoTo(n) : undefined}
            aria-current={current ? 'step' : undefined}
            aria-disabled={done ? undefined : true}
            className={`text-left ${done ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span
              className="block h-1 rounded-full transition-colors duration-200 ease-out"
              style={{ background: n <= step ? 'var(--brand-primary)' : '#E2E8F0' }}
            />
            <span className={`block mt-1.5 text-[12px] ${current ? 'font-bold text-[#0F172A]' : done ? 'font-semibold text-[#475569]' : 'font-semibold text-[#94A3B8]'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function StepCard({
  step,
  title,
  sub,
  onBack,
  footer,
  children,
}: {
  step?: Step;
  title: string;
  sub?: React.ReactNode;
  onBack?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const layout = useBookingLayout();
  return (
    <section
      className="bg-white border border-[#E2E8F0] rounded-[24px] flex flex-col gap-[22px] p-5 min-[601px]:p-7 min-[1024px]:p-8"
      style={{ boxShadow: 'var(--desk-shadow-sm)' }}
    >
      <div className="flex flex-col gap-2.5">
        {onBack && layout !== 'desktop' ? (
          <button type="button" onClick={onBack} className="self-start h-11 -ml-1 inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#64748B] cursor-pointer">
            <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" /> Back
          </button>
        ) : null}
        {step && step <= 4 ? <Eyebrow>{`Step ${step} of 4`}</Eyebrow> : null}
        <h1 className="text-[23px] min-[1024px]:text-[28px] font-bold tracking-[-0.025em] leading-[1.15] text-[#0F172A]">{title}</h1>
        {sub ? <p className="text-[14px] leading-[1.55] text-[#64748B]">{sub}</p> : null}
      </div>
      {children}
      {footer && layout === 'desktop' ? <div className="pt-[18px] border-t border-[#F1F5F9] flex items-center justify-between gap-3">{footer}</div> : null}
    </section>
  );
}

export function StickyActionBar({
  totalKobo,
  label,
  disabled,
  busy,
  onClick,
}: {
  totalKobo?: string | null;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="shrink-0 flex items-center gap-3.5 border-t border-[#E2E8F0] px-4 pt-3 pb-5 min-[601px]:px-8 min-[601px]:pt-3.5 min-[601px]:pb-[22px]"
      style={{ background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(18px) saturate(140%)', WebkitBackdropFilter: 'blur(18px) saturate(140%)' }}
    >
      {totalKobo ? (
        <div className="shrink-0">
          <Eyebrow>Total</Eyebrow>
          <div className="text-[17px] font-bold text-[#0F172A]" style={TABULAR}>{naira(totalKobo)}</div>
        </div>
      ) : null}
      <div className="flex-1">
        <Button variant="primary" size="cta" fullWidth disabled={disabled || busy} onClick={onClick}>
          {busy ? 'One moment…' : label}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, placeholder }: { label: string; value?: string | null; placeholder: string }) {
  return (
    <div className="py-3 border-t border-[#F1F5F9]">
      <div className="text-[12px] text-[#64748B]">{label}</div>
      <div className={`text-[14px] ${value ? 'font-semibold text-[#0F172A]' : 'font-medium text-[#94A3B8]'}`}>{value || placeholder}</div>
    </div>
  );
}

export function SummaryCard({
  therapist,
  practiceName,
  serviceLabel,
  whenLabel,
  formatLabel,
  discount,
  totalKobo,
  cancellationHours,
}: {
  therapist?: { name: string; title?: string | null } | null;
  discount?: { code: string; savingKobo: string } | null;
  practiceName?: string;
  serviceLabel?: string | null;
  whenLabel?: string | null;
  formatLabel?: string | null;
  totalKobo?: string | null;
  cancellationHours?: number | null;
}) {
  const subtitle = [therapist?.title, practiceName].filter(Boolean).join(' · ');
  return (
    <aside className="sticky top-6 bg-white border border-[#E2E8F0] rounded-[24px] p-6 flex flex-col gap-[18px]" style={{ boxShadow: 'var(--desk-shadow-sm)' }}>
      <Eyebrow>Session summary</Eyebrow>
      {therapist ? (
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-[16px] inline-flex items-center justify-center text-[15px] font-extrabold shrink-0" style={{ background: 'var(--brand-fill)', color: 'var(--brand-ink, var(--brand-primary))' }}>
            {initialsOf(therapist.name, 'UD')}
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[#0F172A]">{therapist.name}</div>
            {subtitle ? <div className="text-[12.5px] text-[#64748B]">{subtitle}</div> : null}
          </div>
        </div>
      ) : null}
      <div>
        <SummaryRow label="Session" value={serviceLabel} placeholder="Choose a session" />
        <SummaryRow label="When" value={whenLabel} placeholder="Pick a time" />
        <SummaryRow label="Format" value={formatLabel} placeholder="—" />
        {discount ? (
          <div className="py-3 border-t border-[#F1F5F9] flex items-baseline justify-between gap-3 text-[#16A34A]">
            <span className="text-[13px] font-semibold">Discount · {discount.code}</span>
            <span className="text-[14px] font-semibold" style={TABULAR}>−{naira(discount.savingKobo)}</span>
          </div>
        ) : null}
      </div>
      <div className="pt-3.5 border-t border-[#E2E8F0] flex items-baseline justify-between">
        <span className="text-[14px] font-semibold text-[#475569]">Total</span>
        <span className="text-[24px] font-bold tracking-[-0.02em] text-[#0F172A]" style={TABULAR}>{totalKobo ? naira(totalKobo) : '—'}</span>
      </div>
      <p className="text-[12.5px] text-[#64748B]">
        {cancellationHours ? `Free cancellation up to ${cancellationHours} hours before. ` : ''}Times shown in West Africa Time.
      </p>
    </aside>
  );
}

export function PoweredBy() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#94A3B8]">
      <span style={{ opacity: 0.6 }}><UnclutterMark size={16} showBadge={false} /></span>
      Booking powered by Unclutter Desk
    </p>
  );
}

/** The dashed empty-state box (README, States). */
export function StateBox({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#CBD5E1] p-6 flex flex-col items-center text-center gap-2">
      {icon ? <span className="h-11 w-11 rounded-[12px] inline-flex items-center justify-center" style={{ background: 'var(--brand-fill)', color: 'var(--brand-ink, var(--brand-primary))' }}>{icon}</span> : null}
      <div className="text-[15px] font-bold text-[#0F172A]">{title}</div>
      {children}
    </div>
  );
}

/** The rose banner for "just booked" and "payment didn't go through". */
export function AlertBanner({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-[18px] bg-[#FFF1F2] px-4 py-3.5 flex gap-3">
      <AlertCircle className="h-5 w-5 text-[#E11D48] shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <div className="text-[14px] font-bold text-[#0F172A]">{title}</div>
        {children ? <div className="text-[13px] text-[#475569]">{children}</div> : null}
      </div>
    </div>
  );
}
