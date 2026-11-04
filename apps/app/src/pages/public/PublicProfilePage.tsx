import { useEffect, useState } from 'react';
import { PracticeLogo } from '../../components/public/PracticeLogo';
import { useNavigate } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api, getSubdomainTenantSlug } from '../../utils/apiClient';
import { PublicProfilePreview, type PublicProfilePreviewProps } from './PublicProfilePreview';

type PublicTenantInfo = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
  tagline?: string | null;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string | null;
  locations?: Array<{ name: string; city: string }>;
  formats?: Array<'ONLINE' | 'IN_PERSON'>;
};

type PublicTherapist = {
  profileId: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  avatarUrl: string | null;
  specialty: string | null;
  credentials: string | null;
  yearsExperience: number | null;
  welcomeMessage: string | null;
  tagline: string | null;
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
  const [previewProps, setPreviewProps] = useState<PublicProfilePreviewProps | null>(null);

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
        const therapist = therapists.find((entry) => entry.specialty) ?? therapists[0] ?? null;
        
        const primaryColor = tenantInfo?.primaryColor || brand.primaryColor || '#0F3A53';
        const practiceName = tenantInfo?.name || brand.name || 'Therapy Practice';
        const therapistName = therapist ? `${therapist.firstName} ${therapist.lastName}` : null;
        const initials = practiceName
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        const tagline = therapist?.tagline || tenantInfo?.tagline || null;
        const bio = therapist?.welcomeMessage || tenantInfo?.welcomeMessage || null;
        const specialties = therapist?.modalities?.length
          ? therapist.modalities
          : tenantInfo?.category
            ? [tenantInfo.category]
            : [];
        const credentials = therapist?.credentials || null;
        const experience = therapist?.yearsExperience
          ? `${therapist.yearsExperience}+ years of clinical practice`
          : null;
        const placeRows = tenantInfo?.locations ?? [];
        const fmts = tenantInfo?.formats ?? [];
        const cities = [...new Set(placeRows.map((l) => l.city).filter(Boolean))] as string[];
        const locations = placeRows.length
          ? [
              ...placeRows.map((l) => (l.city ? `${l.name} · ${l.city}` : l.name)),
              ...(fmts.includes('ONLINE') ? ['Online via secure video'] : []),
            ]
          : ([
              tenantInfo?.address || tenantInfo?.city || null,
              fmts.length ? `Sessions: ${fmts.map((f) => (f === 'IN_PERSON' ? 'in person' : 'online')).join(' & ')}` : 'Online via secure video',
            ].filter(Boolean) as string[]);
        const languages = therapist?.languages ?? [];
        const aboutHeadline = tenantInfo?.welcomeTitle || null;
        const hasAbout = Boolean(bio || aboutHeadline || specialties.length > 0);

        setPreviewProps({
          tenant: tenantInfo,
          therapist,
          slots: availability.slice(0, 3),
          reviews: reviewPayload,
          hasAbout,
        });
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
  }, [tenantInfoPath, brand]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[14px] font-medium text-[var(--desk-text-subtle)]">
        Loading practice profile...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--desk-surface)] flex flex-col font-sans">
      <PublicProfilePreview {...previewProps!} interactive={true} />
    </div>
  );
}
