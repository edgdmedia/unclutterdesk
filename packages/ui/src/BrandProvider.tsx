import React, { createContext, useContext, useEffect, type ReactNode } from 'react';

export interface TenantBrandConfig {
  id?: string;
  name: string;
  slug: string;
  customDomain?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  currency?: string;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
}

const DEFAULT_BRAND: TenantBrandConfig = {
  name: 'Unclutter Desk',
  slug: 'default',
  primaryColor: '#0F3A53',
  secondaryColor: '#E3B341',
  currency: 'NGN',
};

const BrandContext = createContext<TenantBrandConfig>(DEFAULT_BRAND);

export function BrandProvider({ brand, children }: { brand?: TenantBrandConfig | null; children: ReactNode }) {
  const currentBrand = brand || DEFAULT_BRAND;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    const primary = currentBrand.primaryColor || '#0F3A53';
    const secondary = currentBrand.secondaryColor || '#E3B341';

    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-secondary', secondary);

    if (currentBrand.name) {
      document.title = `${currentBrand.name} — Online Booking & Consultation`;
    }
  }, [currentBrand]);

  return (
    <BrandContext.Provider value={currentBrand}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
