import { useCallback, useEffect, useState } from 'react';
import { api, apiRequest } from '../../../utils/apiClient';
import type { Slot } from './bookingSlots';

export type PublicPractice = {
  id: string;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  address?: string | null;
  city?: string | null;
  cancellationHours?: number | null;
};

export type PublicService = { id: string; title: string; description?: string | null; durationMinutes: number; priceKobo: string };
export type Reviews = { averageRating: number | null; count: number };

type Status = 'loading' | 'ready' | 'error';

export interface BookingData {
  status: Status;
  practice: PublicPractice | null;
  services: PublicService[];
  slots: Slot[];
  reviews: Reviews;
  bankTransfer: boolean;
  /** Fetches the times again, e.g. before moving on from step 2 or before paying. */
  reloadSlots: () => Promise<Slot[]>;
}

/**
 * Everything the booking wizard shows, for the practice at `slug`.
 * `previewSlug` renders a practice from outside its own host (the preview in
 * Brand settings), where public endpoints need the practice named in a header.
 */
export function useBookingData(slug: string, previewSlug?: string): BookingData {
  const [status, setStatus] = useState<Status>('loading');
  const [practice, setPractice] = useState<PublicPractice | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reviews, setReviews] = useState<Reviews>({ averageRating: null, count: 0 });
  const [bankTransfer, setBankTransfer] = useState(false);

  const get = useCallback(
    <T,>(path: string) =>
      previewSlug ? apiRequest<T>(path, { method: 'GET', headers: { 'X-Tenant-Slug': previewSlug } }) : api.get<T>(path),
    [previewSlug],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.all([
      api.get<PublicPractice>(`/v1/tenant/public/info/${slug}`),
      get<PublicService[]>('/v1/consult/public/services'),
      get<Slot[]>('/v1/consult/public/availability'),
      get<Reviews>('/v1/intake/public/reviews').catch(() => ({ averageRating: null, count: 0 })),
      get<{ bankTransfer?: boolean }>('/v1/consult/public/payment-options').catch(() => ({ bankTransfer: false })),
    ])
      .then(([p, s, a, r, options]) => {
        if (cancelled) return;
        setPractice(p);
        setServices(s ?? []);
        setSlots(a ?? []);
        setReviews({ averageRating: r?.averageRating ?? null, count: r?.count ?? 0 });
        setBankTransfer(Boolean(options?.bankTransfer));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, get]);

  const reloadSlots = useCallback(async () => {
    const fresh = (await get<Slot[]>('/v1/consult/public/availability')) ?? [];
    setSlots(fresh);
    return fresh;
  }, [get]);

  return { status, practice, services, slots, reviews, bankTransfer, reloadSlots };
}
