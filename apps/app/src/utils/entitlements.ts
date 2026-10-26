import { useEffect, useState } from 'react';
import { api } from './apiClient';

/** Mirrors apps/api/src/modules/entitlements/entitlements.ts. The API decides; this only shows it. */
export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'CLINIC';

export type Entitlements = {
  monthlyBookingLimit: number | null;
  platformFeeBps: number;
  customDomain: boolean;
  staffInviteRoles: Array<'ADMIN' | 'RECEPTIONIST' | 'THERAPIST'>;
  assessmentRank: number;
  googleCalendarSync: boolean;
  manualPayments: boolean;
  profileFeatures: { downloadablePdf: boolean; introVideo: boolean };
};

export type EntitlementSummary = {
  tier: Tier;
  tierName: string;
  /** The next plan up (free → Starter → Pro → Clinic); upgrade prompts point here, never further. */
  upgradeTo: Tier | null;
  upgradeToName: string | null;
  entitlements: Entitlements;
  usage: { bookingsThisMonth: number | null; bookingLimitReached: boolean };
};

export const TIER_NAMES: Record<Tier, string> = { FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', CLINIC: 'Clinic' };

/** "5%" from basis points. */
export function formatFee(bps: number): string {
  return `${(bps / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}%`;
}

/**
 * The practice's plan and what it includes, from GET /v1/tenant/entitlements,
 * so a screen can show a feature as locked before the API refuses it. Null
 * while loading or if it could not be read: callers then show the feature and
 * let the API's 402 say no, rather than locking something that may be included.
 */
export function useEntitlements(): EntitlementSummary | null {
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get<EntitlementSummary>('/v1/tenant/entitlements')
      .then((s) => {
        if (!cancelled && s && typeof s === 'object' && 'entitlements' in s) setSummary(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return summary;
}
