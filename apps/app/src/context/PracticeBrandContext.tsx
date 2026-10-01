import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../utils/apiClient';
import { isPracticeAccount } from '../utils/accounts';
import { useAuth } from './AuthContext';

/** What a practice has saved about how it looks to clients. */
export interface PracticeBrand {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customDomain: string | null;
  customDomainStatus: string | null;
}

interface PracticeBrandValue {
  brand: PracticeBrand | null;
  /** Re-reads the brand after a save, so every screen shows it straight away. */
  refresh: () => Promise<void>;
}

const NO_BRAND: PracticeBrandValue = { brand: null, refresh: async () => {} };
const PracticeBrandContext = createContext<PracticeBrandValue>(NO_BRAND);

type BrandRecord = Partial<Record<keyof PracticeBrand, string | null>>;

function toBrand(b: BrandRecord): PracticeBrand {
  return {
    name: b.name ?? '',
    slug: b.slug ?? '',
    logoUrl: b.logoUrl || null,
    primaryColor: b.primaryColor || null,
    secondaryColor: b.secondaryColor || null,
    customDomain: b.customDomain || null,
    customDomainStatus: b.customDomainStatus || null,
  };
}

/**
 * The one place the workspace reads the practice's brand from. The shell used
 * to start from hard-coded colours, never loaded the logo, and took the booking
 * link from the sign-in profile, so whatever setup saved looked lost.
 */
export function PracticeBrandProvider({ children }: { children: React.ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const practice = isPracticeAccount(profile);
  const tenantId = practice ? profile?.tenantId : undefined;
  const [brand, setBrand] = useState<PracticeBrand | null>(null);

  const load = useCallback(async () => {
    const b = await api.get<BrandRecord>('/v1/tenant/brand');
    setBrand(toBrand(b));
  }, []);

  useEffect(() => {
    setBrand(null);
    if (!tenantId) return;
    let cancelled = false;
    api
      .get<BrandRecord>('/v1/tenant/brand')
      .then((b) => {
        if (!cancelled) setBrand(toBrand(b));
      })
      .catch(() => {
        // The shell falls back to the product's own look.
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    // The booking link also lives on the signed-in profile, which other
    // screens read; refresh both so nothing shows the old address.
    await Promise.all([load(), refreshProfile()]);
  }, [tenantId, load, refreshProfile]);

  return <PracticeBrandContext.Provider value={{ brand, refresh }}>{children}</PracticeBrandContext.Provider>;
}

export function usePracticeBrand(): PracticeBrandValue {
  return useContext(PracticeBrandContext);
}
