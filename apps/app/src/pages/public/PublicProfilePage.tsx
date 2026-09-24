import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api, APP_BASE_URL, getSubdomainTenantSlug } from '../../utils/apiClient';

type PublicTenantInfo = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
};

type PublicTherapist = {
  profileId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  specialty: string | null;
  credentials: string | null;
  yearsExperience: number | null;
  welcomeMessage: string | null;
  modalities: string[];
  languages: string[];
};

type PublicAvailability = { id: string; startsAt: string; endsAt: string };
type PublicReviewsPayload = { averageRating: number | null; count: number };

function formatSlotDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(value));
}

function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function PublicProfilePage() {
  const navigate = useNavigate();
  const brand = useBrand();
  const slug = getSubdomainTenantSlug() || '';
  const tenantInfoPath = slug ? `/v1/tenant/public/info/${slug}` : '/v1/tenant/public/info';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<PublicTenantInfo | null>(null);
  const [therapist, setTherapist] = useState<PublicTherapist | null>(null);
  const [slots, setSlots] = useState<PublicAvailability[]>([]);
  const [reviews, setReviews] = useState<PublicReviewsPayload>({ averageRating: null, count: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
        setError(null);
      try {
        const [tenantInfo, therapists, availability, reviewPayload] = await Promise.all([
          api.get<PublicTenantInfo>(tenantInfoPath),
          api.get<PublicTherapist[]>('/v1/consult/public/therapists'),
          api.get<PublicAvailability[]>('/v1/consult/public/availability'),
          api.get<PublicReviewsPayload>('/v1/intake/public/reviews'),
        ]);
        if (cancelled) return;
        setTenant(tenantInfo);
        setTherapist(therapists.find((entry) => entry.specialty) ?? therapists[0] ?? null);
        setSlots(availability.slice(0, 3));
        setReviews(reviewPayload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load practice profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [tenantInfoPath]);

  const primaryColor = tenant?.primaryColor || brand.primaryColor || '#0F3A53';
  const practiceName = tenant?.name || brand.name || 'Therapy Practice';
  const therapistName = therapist ? `${therapist.firstName} ${therapist.lastName}` : null;
  const initials = practiceName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const bio = therapist?.welcomeMessage || tenant?.welcomeMessage || null;
  const specialties = therapist?.modalities?.length
    ? therapist.modalities
    : tenant?.category
      ? [tenant.category]
      : [];
  const credentials = therapist?.credentials || null;
  const experience = therapist?.yearsExperience
    ? `${therapist.yearsExperience}+ years of clinical practice`
    : null;
  const locations = [tenant?.address || tenant?.city, 'Online via secure video'].filter(Boolean) as string[];
  const languages = therapist?.languages ?? [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <header className="sticky top-0 z-50 h-[56px] md:h-[64px] px-4 md:px-10 flex items-center justify-between bg-white/95 backdrop-blur-[18px] border-b border-[#E2E8F0]">
        <img
          src="/unclutterdesk-mark.svg"
          alt="Unclutter Desk"
          className="h-[28px] md:h-[32px] w-auto"
        />
        <a
          href={`${APP_BASE_URL}/login`}
          className="h-[36px] md:h-[40px] px-3 md:px-4 rounded-[10px] md:rounded-[12px] bg-white border border-[#CBD5E1] text-[12px] md:text-[13px] font-bold flex items-center"
          style={{ color: primaryColor }}
        >
          Log in
        </a>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[14px] font-medium text-[#94A3B8]">
          Loading practice profile...
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        </div>
      ) : (
        <>
          <section className="px-4 py-6 md:py-[60px] md:px-10 max-w-[1320px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[60px] items-center text-center md:text-left">
            <div className="md:hidden flex justify-center">
              {therapist?.avatarUrl ? (
                <img
                  src={therapist.avatarUrl}
                  alt={therapistName || practiceName}
                  className="w-[200px] h-[200px] rounded-[24px] object-cover shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
                />
              ) : (
                <div
                  className="w-[200px] h-[200px] rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex items-center justify-center text-[56px] font-extrabold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {initials}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 md:gap-[24px]">
              <div className="flex flex-col gap-2.5 md:gap-[12px]">
                <div className="hidden md:block text-[13px] font-black tracking-[0.22em] text-[#94A3B8] uppercase">
                  {therapist?.specialty || tenant?.category || 'Therapist Profile'}
                </div>
                <h1 className="m-0 text-[26px] md:text-[46px] leading-[1.08] font-[800] tracking-[-0.03em] md:tracking-[-0.035em] text-[#0F172A]">
                  {practiceName}
                </h1>
                {therapistName ? (
                  <p className="m-0 text-[15px] md:text-[17px] text-[#475569] font-[700]">
                    {therapistName}{therapist?.specialty ? ` · ${therapist.specialty}` : ''}
                  </p>
                ) : null}
                {reviews.count > 0 && reviews.averageRating !== null ? (
                  <div className="flex items-center justify-center md:justify-start gap-1.5 text-[13px] font-bold text-[#0F172A]">
                    <Star className="h-4 w-4 fill-[#E3B341] stroke-[#E3B341]" />
                    {reviews.averageRating.toFixed(1)} ({reviews.count} client review{reviews.count === 1 ? '' : 's'})
                  </div>
                ) : null}
                {bio ? (
                  <p className="m-0 text-[13px] md:text-[14px] text-[#64748B] max-w-[520px] leading-[1.65] mx-auto md:mx-0 text-pretty">
                    {bio}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col md:flex-row gap-3 pt-2 md:pt-0">
                <button
                  onClick={() => navigate('/book')}
                  className="w-full md:w-auto h-[48px] md:h-[52px] px-7 rounded-[14px] md:rounded-[16px] border-none text-white text-[14px] md:text-[15px] font-[700] shadow-[0_10px_26px_rgba(0,0,0,0.12)] cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Book Consultation
                </button>
              </div>
            </div>

            <div className="hidden md:flex justify-center">
              {therapist?.avatarUrl ? (
                <img
                  src={therapist.avatarUrl}
                  alt={therapistName || practiceName}
                  className="w-[320px] h-[320px] rounded-[32px] object-cover shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
                />
              ) : (
                <div
                  className="w-[320px] h-[320px] rounded-[32px] shadow-[0_24px_80px_rgba(0,0,0,0.12)] flex items-center justify-center text-[88px] font-extrabold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {initials}
                </div>
              )}
            </div>
          </section>

          {bio || specialties.length > 0 ? (
            <section className="px-4 py-8 md:py-[80px] md:px-10 bg-white border-t border-[#E2E8F0]">
              <div className="max-w-[1320px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[60px] items-start">
                <div className="flex flex-col gap-2 md:gap-5">
                  <div className="text-[11px] md:text-[13px] font-black tracking-[0.12em] md:tracking-[0.22em] text-[#94A3B8] uppercase">
                    About the Practice
                  </div>
                  {bio ? (
                    <p className="m-0 text-[13px] md:text-[15px] leading-[1.6] md:leading-[1.7] text-[#475569]">
                      {bio}
                    </p>
                  ) : null}
                  {credentials ? (
                    <div className="flex flex-col gap-3 mt-2">
                      <div className="text-[11px] md:text-[12px] font-black tracking-[0.12em] text-[#0F172A] uppercase">
                        Credentials
                      </div>
                      <p className="m-0 text-[13px] md:text-[14px] leading-[1.6] text-[#475569]">{credentials}</p>
                    </div>
                  ) : null}
                  {experience ? (
                    <div className="flex flex-col gap-3 mt-2">
                      <div className="text-[11px] md:text-[12px] font-black tracking-[0.12em] text-[#0F172A] uppercase">
                        Experience
                      </div>
                      <p className="m-0 text-[13px] md:text-[14px] leading-[1.6] text-[#475569]">{experience}</p>
                    </div>
                  ) : null}
                </div>

                {specialties.length > 0 ? (
                  <div className="flex flex-col gap-[10px] md:gap-5">
                    <div className="flex flex-col gap-2 md:gap-3">
                      <div className="text-[11px] md:text-[12px] font-black tracking-[0.12em] text-[#0F172A] uppercase">
                        Specialties
                      </div>
                      <div className="flex flex-wrap gap-2 md:gap-[10px]">
                        {specialties.map((spec) => (
                          <div
                            key={spec}
                            className="h-8 md:h-[36px] px-3 md:px-4 rounded-[999px] bg-[#F1F5F9] text-[12px] md:text-[13px] font-[700] flex items-center"
                            style={{ color: primaryColor }}
                          >
                            {spec}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="px-4 py-6 md:py-[80px] md:px-10 bg-[#F8FAFC] flex flex-col md:grid md:grid-cols-3 gap-[14px] md:gap-5 max-w-[1320px] mx-auto w-full flex-1">
            <div className="bg-white border border-[#E2E8F0] rounded-[18px] md:rounded-[24px] p-4 md:p-[32px] flex flex-col gap-2.5 md:gap-4">
              <div className="text-[11px] md:text-[12px] font-black tracking-[0.12em] text-[#94A3B8] uppercase">
                Location & Format
              </div>
              <div className="flex flex-col gap-2 md:gap-3">
                {locations.map((loc) => (
                  <div key={loc} className="flex items-start gap-2 md:gap-2.5 text-[13px] md:text-[14px] text-[#475569]">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                    {loc}
                  </div>
                ))}
              </div>
            </div>

            {languages.length > 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-[18px] md:rounded-[24px] p-4 md:p-[32px] flex flex-col gap-2.5 md:gap-4">
                <div className="text-[11px] md:text-[12px] font-black tracking-[0.12em] text-[#94A3B8] uppercase">
                  Languages
                </div>
                <div className="flex flex-wrap gap-2 md:gap-[10px]">
                  {languages.map((language) => (
                    <div key={language} className="h-7 md:h-[32px] px-2.5 md:px-[12px] rounded-[999px] bg-[#F1F5F9] text-[#475569] text-[11px] md:text-[12px] font-[700] flex items-center">
                      {language}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {slots.length > 0 ? (
              <div className="hidden md:flex bg-white border border-[#E2E8F0] rounded-[24px] p-[32px] flex-col gap-4">
                <div className="text-[12px] font-black tracking-[0.12em] text-[#94A3B8] uppercase">
                  Next Available
                </div>
                <div className="flex flex-col gap-[10px]">
                  {slots.map((slot) => (
                    <div key={slot.id} className="flex justify-between items-center text-[13px]">
                      <span className="text-[#475569]">{formatSlotDate(slot.startsAt)}</span>
                      <span className="font-[700] text-[#0F172A]">{formatSlotTime(slot.startsAt)} WAT</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate('/book')}
                  className="mt-1 h-[44px] rounded-[14px] border-none text-white text-[13px] font-[700] cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Book a session
                </button>
              </div>
            ) : null}
          </section>

          <section className="px-4 py-5 md:py-[80px] md:px-10 bg-white text-center border-t border-[#E2E8F0]">
            <div className="max-w-[760px] mx-auto flex flex-col gap-5 items-center">
              <h2 className="hidden md:block m-0 text-[34px] font-[800] tracking-[-0.035em] text-[#0F172A]">
                Ready to start your journey?
              </h2>
              <p className="hidden md:block m-0 text-[15px] text-[#64748B] text-pretty">
                Browse available sessions with {therapistName || practiceName} and pick a time that works for you.
              </p>
              <button
                onClick={() => navigate('/book')}
                className="h-[50px] md:h-[52px] w-full md:w-auto md:px-8 rounded-[14px] md:rounded-[16px] border-none text-white text-[14px] md:text-[15px] font-[700] shadow-[0_10px_26px_rgba(0,0,0,0.12)] cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Book Now
              </button>
            </div>
          </section>
        </>
      )}

      <footer className="bg-[#0F172A] p-5 md:p-[40px] text-center text-[11px] md:text-[12px] text-[#94A3B8] border-t border-white/10">
        © 2026 {practiceName}. Powered by <span className="text-[#7DB8A5]">unclutter desk</span>.
      </footer>
    </div>
  );
}
