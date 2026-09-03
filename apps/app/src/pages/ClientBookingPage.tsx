import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Star, MapPin, Award, ArrowRight, ShieldCheck } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api, getSubdomainTenantSlug } from '../utils/apiClient';

type PublicReview = { id: string; rating: number | null; testimonial: string; displayName: string; publishedAt: string };
type PublicReviewsPayload = { averageRating: number | null; count: number; reviews: PublicReview[] };
type PublicService = { id: string; title: string; description?: string; durationMinutes: number; priceKobo: string };
type PublicAvailability = { id: string; serviceId: string | null; therapistName: string; startsAt: string; endsAt: string };
type PublicTenantInfo = { id: string; name: string; slug: string; customDomain?: string | null; primaryColor?: string; secondaryColor?: string };
type DiscountPreview = {
  code: string;
  label?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountPercent?: number | null;
  discountAmountKobo?: string | null;
  originalKobo: string;
  finalKobo: string;
  amountSavedKobo: string;
};

function formatMoney(kobo: string) {
  return `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value));
}

export function ClientBookingPage() {
  const navigate = useNavigate();
  const slug = getSubdomainTenantSlug() || '';
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [sessionFormat, setSessionFormat] = useState<'online' | 'in-person'>('online');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [concerns, setConcerns] = useState('');
  const [reviews, setReviews] = useState<PublicReviewsPayload>({ averageRating: null, count: 0, reviews: [] });
  const [services, setServices] = useState<PublicService[]>([]);
  const [availability, setAvailability] = useState<PublicAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [tenantInfo, setTenantInfo] = useState<PublicTenantInfo | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);

  const brand = useBrand();
  const primaryColor = tenantInfo?.primaryColor || brand.primaryColor || '#0F3A53';
  const secondaryColor = tenantInfo?.secondaryColor || brand.secondaryColor || '#E3B341';
  const practiceName = tenantInfo?.name || brand.name || 'Therapy Practice';
  const therapistName = availability[0]?.therapistName || tenantInfo?.name || 'Practitioner';

  const initials = practiceName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TP';

  useEffect(() => {
    let cancelled = false;
    async function loadBookingData() {
      setLoading(true);
      try {
        const [reviewPayload, servicesPayload, availabilityPayload] = await Promise.all([
          api.get<PublicReviewsPayload>('/v1/intake/public/reviews'),
          api.get<PublicService[]>('/v1/consult/public/services'),
          api.get<PublicAvailability[]>('/v1/consult/public/availability'),
        ]);
        const tenantInfo = await api.get<PublicTenantInfo>(`/v1/tenant/public/info/${slug}`);
        if (cancelled) return;
        setReviews(reviewPayload);
        setServices(servicesPayload);
        setAvailability(availabilityPayload);
        setTenantInfo(tenantInfo);
        setTenantId(tenantInfo.id);
        const firstService = servicesPayload[0];
        if (firstService) setSelectedServiceId(firstService.id);
      } catch {
        if (!cancelled) setBookingError('Unable to load live booking availability.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBookingData();
    return () => { cancelled = true; };
  }, [slug]);

  const selectedService = services.find((service) => service.id === selectedServiceId) || services[0];
  const filteredAvailability = useMemo(
    () => availability.filter((slot) => !selectedService || slot.serviceId === selectedService.id),
    [availability, selectedService],
  );
  const availableDates = useMemo(() => {
    const grouped = new Map<string, Date>();
    for (const slot of filteredAvailability) {
      const date = new Date(slot.startsAt);
      const key = date.toISOString().split('T')[0];
      if (!grouped.has(key)) grouped.set(key, date);
    }
    return Array.from(grouped.entries()).map(([key, date]) => ({ key, date }));
  }, [filteredAvailability]);

  useEffect(() => {
    if (availableDates.length === 0) return;
    if (!selectedDateKey || !availableDates.some((item) => item.key === selectedDateKey)) {
      setSelectedDateKey(availableDates[0].key);
    }
  }, [availableDates, selectedDateKey]);

  const availableSlots = useMemo(
    () => filteredAvailability.filter((slot) => slot.startsAt.startsWith(selectedDateKey)),
    [filteredAvailability, selectedDateKey],
  );

  useEffect(() => {
    if (availableSlots.length === 0) return;
    if (!selectedSlotId || !availableSlots.some((slot) => slot.id === selectedSlotId)) {
      setSelectedSlotId(availableSlots[0].id);
    }
  }, [availableSlots, selectedSlotId]);

  useEffect(() => {
    setDiscountPreview(null);
    setDiscountError(null);
  }, [selectedServiceId]);

  const selectedSlot = availableSlots.find((slot) => slot.id === selectedSlotId) || availableSlots[0];
  const originalKobo = selectedService?.priceKobo || '0';
  const finalKobo = discountPreview?.finalKobo || originalKobo;
  const amountSavedKobo = discountPreview?.amountSavedKobo || '0';

  const handleApplyDiscount = async () => {
    if (!selectedService || !discountCode.trim() || !tenantId) return;
    setDiscountLoading(true);
    setDiscountError(null);
    try {
      const preview = await api.post<DiscountPreview>('/v1/discount/validate', {
        tenantId,
        code: discountCode.trim(),
        priceKobo: selectedService.priceKobo,
      }, { 'X-Tenant-Slug': '' });
      setDiscountPreview(preview);
    } catch (err) {
      setDiscountPreview(null);
      setDiscountError(err instanceof Error ? err.message : 'Unable to apply discount code');
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedSlot) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const [firstName, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
      const booking = await api.post<{ bookingId: string; startsAt: string; endsAt: string; serviceTitle: string; therapistName: string; videoRoomLink: string; status: string; paymentUrl?: string }>('/v1/consult/public/bookings', {
        serviceId: selectedService.id,
        availabilityId: selectedSlot.id,
        firstName,
        lastName: rest.join(' '),
        email,
        phone,
        notes: concerns,
        discountCode: discountPreview ? discountPreview.code : undefined,
      });

      if (booking.paymentUrl) {
        window.location.href = booking.paymentUrl;
      } else {
        navigate('/booking/confirmed', { state: { booking, fullName, email } });
      }
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Unable to complete booking');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFDFE] text-[#0F172A] font-outfit flex flex-col items-center">
      <div className="w-full max-w-[1180px] shadow-2xl md:rounded-3xl overflow-hidden md:my-8 border-y md:border border-[#E2E8F0] bg-white pb-[100px] md:pb-0">
        <header className="p-[20px] md:p-[30px_40px_26px] border-b" style={{ background: `linear-gradient(120deg, ${primaryColor}14, ${secondaryColor}1F)`, borderColor: `${primaryColor}33` }}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-5">
            <div className="h-[82px] w-[82px] rounded-[26px] bg-white shadow-[0_8px_24px_rgba(15,23,42,.10)] flex items-center justify-center font-extrabold text-[26px] shrink-0 border border-slate-100" style={{ color: primaryColor }}>{initials}</div>
            <div className="space-y-1 flex-1">
              <span className="text-[11px] font-black tracking-[0.2em] uppercase block" style={{ color: primaryColor }}>{practiceName}</span>
              <div className="flex items-center gap-3"><h1 className="text-[30px] font-extrabold tracking-[-0.035em] text-[#0F172A]">Book a session with {therapistName}</h1><span className="h-[20px] px-3 rounded-full text-[10px] font-bold tracking-[0.06em] uppercase flex items-center" style={{ backgroundColor: `${secondaryColor}1A`, color: '#8A6512' }}>CLINICAL PRACTICE</span></div>
              <div className="flex items-center gap-4 text-[13px] text-[#475569] font-medium pt-1">{reviews.count > 0 ? <><span className="flex items-center gap-1"><Star className="h-4 w-4 fill-[#E3B341] stroke-[#E3B341]" /><strong className="text-[#0F172A]">{reviews.averageRating?.toFixed(1)}</strong> ({reviews.count} reviews)</span><span>·</span></> : null}<span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-[#64748B]" />Lagos, Nigeria · Online & in-person</span></div>
            </div>
          </div>
        </header>

        <div className="p-[20px] md:p-[30px_40px_40px] grid grid-cols-1 md:grid-cols-[1fr_348px] gap-[28px] items-start bg-[#FCFDFE]">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3"><div className="h-[22px] w-[22px] rounded-full text-white font-extrabold text-[11px] flex items-center justify-center" style={{ backgroundColor: primaryColor }}>1</div><h2 className="text-[16px] font-bold text-[#0F172A]">Choose a service</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((service) => (
                  <div key={service.id} onClick={() => setSelectedServiceId(service.id)} className={`p-[18px] rounded-[20px] bg-white cursor-pointer border-2 transition-all relative ${selectedService?.id === service.id ? 'border-brand-primary shadow-[0_10px_28px_var(--brand-ring)]' : 'border-[#E2E8F0] hover:border-slate-300'}`}>
                    <h3 className="text-[15px] font-bold text-[#0F172A]">{service.title}</h3>
                    <p className="text-[12.5px] text-[#64748B] font-medium mt-1">{service.description || `${service.durationMinutes}-minute session`}</p>
                    <div className="mt-4"><span className="text-[24px] font-extrabold tracking-[-0.03em] text-[#0F172A]">{formatMoney(service.priceKobo)}</span><span className="text-[12px] text-[#94A3B8] font-medium ml-1">per session</span></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3"><div className="h-[22px] w-[22px] rounded-full text-white font-extrabold text-[11px] flex items-center justify-center" style={{ backgroundColor: primaryColor }}>2</div><h2 className="text-[16px] font-bold text-[#0F172A]">Pick a date & time</h2></div>
              <div className="p-4 md:p-5 rounded-[22px] bg-white border border-[#E2E8F0] grid grid-cols-1 md:grid-cols-[1fr_216px] gap-5">
                <div>
                  <div className="flex items-center justify-between mb-4"><span className="text-[14.5px] font-bold text-[#0F172A]">Available dates</span><span className="text-[11.5px] font-semibold text-[#94A3B8]">WAT (GMT+1)</span></div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {availableDates.map(({ key, date }) => (
                      <button key={key} onClick={() => setSelectedDateKey(key)} className={`h-[48px] rounded-[12px] text-[13px] font-semibold transition-all relative flex flex-col items-center justify-center ${selectedDateKey === key ? 'bg-brand-primary text-white border border-brand-primary' : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-100'}`}>
                        <span className="text-[10px] font-black uppercase">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)}</span>
                        <span>{date.getDate()}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:border-l border-t md:border-t-0 border-[#E2E8F0] md:pl-5 pt-4 md:pt-0 space-y-3">
                  <span className="os-eyebrow block">AVAILABLE TIMES</span>
                  <p className="text-[13px] font-semibold text-[#0F172A]">{selectedDateKey ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(selectedDateKey)) : 'Select a date'}</p>
                  <div className="space-y-2">
                    {availableSlots.map((slot) => (
                      <button key={slot.id} onClick={() => setSelectedSlotId(slot.id)} className={`w-full h-[42px] rounded-full text-[13.5px] font-bold transition-all border-1.5 ${selectedSlotId === slot.id ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-slate-50'}`}>{formatTime(slot.startsAt)}</button>
                    ))}
                    {availableSlots.length === 0 ? <div className="text-[12px] text-[#94A3B8] font-medium">No slots on this date.</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3"><div className="h-[22px] w-[22px] rounded-full text-white font-extrabold text-[11px] flex items-center justify-center" style={{ backgroundColor: primaryColor }}>3</div><h2 className="text-[16px] font-bold text-[#0F172A]">Your details</h2></div>
              <div className="p-4 md:p-5 rounded-[22px] bg-white border border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Full name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Adaeze Okonkwo" className="w-full h-[46px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14px] font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]" /></div>
                <div className="space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Email address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. you@example.com" className="w-full h-[46px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14px] font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]" /></div>
                <div className="space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Phone number</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +234 803 123 4567" className="w-full h-[46px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14px] font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]" /></div>
                <div className="space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Session format</label><div className="h-[46px] p-1 bg-[#F1F5F9] rounded-[14px] flex gap-1"><button onClick={() => setSessionFormat('online')} className={`flex-1 rounded-[11px] text-xs font-bold transition-all ${sessionFormat === 'online' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}>Online</button><button onClick={() => setSessionFormat('in-person')} className={`flex-1 rounded-[11px] text-xs font-bold transition-all ${sessionFormat === 'in-person' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}>In-person</button></div></div>
                <div className="col-span-1 sm:col-span-2 space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Share concerns <span className="text-[#94A3B8] font-normal">(optional)</span></label><textarea rows={3} value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Anything you'd like your therapist to know before your session." className="w-full p-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14px] font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8] resize-none" /></div>
                <div className="col-span-1 sm:col-span-2 flex items-center gap-2 text-[11.5px] text-[#94A3B8] font-medium pt-1"><ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" /><span>Encrypted and confidential. Shared only with {therapistName}.</span></div>
              </div>
            </div>

            {reviews.count > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-[22px] w-[22px] rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><Star className="h-3.5 w-3.5 fill-current" /></div>
                    <h2 className="text-[16px] font-bold text-[#0F172A]">Client stories</h2>
                  </div>
                  <span className="text-[12px] font-bold text-[#64748B]">{reviews.averageRating?.toFixed(1)} / 5 · {reviews.count} review{reviews.count === 1 ? '' : 's'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reviews.reviews.map((review) => (
                    <div key={review.id} className="p-[18px] rounded-[20px] bg-white border border-[#E2E8F0]">
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} className={`h-3.5 w-3.5 ${review.rating !== null && index < Math.round(review.rating) ? 'fill-current' : ''}`} />
                        ))}
                      </div>
                      {review.testimonial ? (
                        <p className="mt-3 text-[13px] leading-6 font-medium text-[#334155]">&ldquo;{review.testimonial}&rdquo;</p>
                      ) : null}
                      <div className="mt-3 text-[11.5px] font-semibold text-[#94A3B8]">
                        {review.displayName} · {new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(review.publishedAt))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 p-[16px_18px] rounded-[18px] bg-white border border-dashed border-[#CBD5E1]">
              <span className="text-[12.5px] font-medium text-[#64748B]">Attended a session with {therapistName}?</span>
              <Link to="/review" className="text-[12.5px] font-bold hover:underline" style={{ color: primaryColor }}>Leave a review</Link>
            </div>
          </div>

          <div className="md:sticky md:top-[24px] rounded-[22px] bg-white md:border border-[#E2E8F0] md:shadow-[0_12px_34px_rgba(15,23,42,.09)] overflow-hidden space-y-4 pb-[80px] md:pb-0">
            <div className="p-[16px_22px] rounded-[22px] md:rounded-none" style={{ backgroundColor: primaryColor }}><span className="text-[9px] font-black text-white/75 tracking-[0.2em] uppercase block">SESSION SUMMARY</span><h3 className="text-[17px] font-bold text-white mt-0.5">{selectedService?.title || 'Select a service'}</h3></div>
            <div className="px-[22px] space-y-3 text-[13.5px]">
              <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8]">Date</span><span className="font-bold text-[#0F172A]">{selectedSlot ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(selectedSlot.startsAt)) : 'Select a slot'}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8]">Time</span><span className="font-bold text-[#0F172A]">{selectedSlot ? formatTime(selectedSlot.startsAt) : '--'}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8]">Therapist</span><span className="font-bold text-[#0F172A]">{selectedSlot?.therapistName || therapistName}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8]">Format</span><span className="font-bold text-[#0F172A] capitalize">{sessionFormat}</span></div>
              <div className="h-[1px] bg-[#E2E8F0] my-2" />
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="Discount code"
                    className="flex-1 h-[42px] px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[12.5px] font-semibold text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={discountLoading || !discountCode.trim() || !selectedService || !tenantId}
                    className="h-[42px] px-3 rounded-[12px] text-[12px] font-bold text-white disabled:opacity-60 cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {discountLoading ? 'Applying...' : 'Apply code'}
                  </button>
                </div>
                {discountError ? <p className="text-[11.5px] text-red-500 font-medium">{discountError}</p> : null}
                {discountPreview ? (
                  <p className="text-[11.5px] text-emerald-700 font-bold">
                    {discountPreview.discountType === 'PERCENT'
                      ? `${discountPreview.discountPercent}% off applied`
                      : `${formatMoney(discountPreview.amountSavedKobo)} off applied`}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8]">Original</span><span className="font-bold text-[#0F172A]">{selectedService ? formatMoney(originalKobo) : '--'}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-[#94A3B8]">Discount</span><span className="font-bold text-emerald-700">-{formatMoney(amountSavedKobo)}</span></div>
              <div className="flex items-baseline justify-between pt-1"><span className="text-[13px] font-bold text-[#475569]">Final total</span><span className="text-[26px] font-extrabold tracking-[-0.035em] text-[#0F172A]">{selectedService ? formatMoney(finalKobo) : '--'}</span></div>
            </div>
            
            {/* Action Bar (Sticky on Mobile) */}
            <div className="fixed bottom-0 left-0 right-0 p-[16px_20px] bg-white/85 backdrop-blur-xl border-t border-slate-200/50 md:static md:p-[0_22px_22px] md:bg-transparent md:backdrop-blur-none md:border-none space-y-3 z-50">
              <button onClick={handleConfirmBooking} disabled={bookingLoading || !selectedService || !selectedSlot} className="os-brand-btn w-full h-[52px] rounded-[16px] font-bold text-[15px] flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,.2)] disabled:opacity-60" style={{ backgroundColor: primaryColor }}><span>{bookingLoading ? 'Booking session...' : 'Confirm & Book Session'}</span><ArrowRight className="h-4 w-4" /></button>
              {bookingError ? <p className="text-[11.5px] text-red-500 font-medium text-center">{bookingError}</p> : null}
              <p className="text-[11.5px] text-[#94A3B8] font-medium text-center hidden md:block">Free cancellation up to 24 hours before</p>
            </div>
            
            <div className="hidden md:flex p-[14px_22px] bg-[#F8FAFC] border-t border-[#E2E8F0] items-center gap-2 justify-center"><span className="text-[10.5px] font-semibold text-[#94A3B8]">Booking powered by</span><span className="text-[10.5px] font-extrabold text-brand-primary">Unclutter Desk</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
