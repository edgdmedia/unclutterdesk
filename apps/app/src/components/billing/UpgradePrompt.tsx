import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '@unclutterdesk/ui';
import { ENTITLEMENT_REQUIRED_EVENT, type EntitlementRequired } from '../../utils/apiClient';
import { TIER_NAMES, type Tier } from '../../utils/entitlements';

/**
 * The upgrade prompt for any 402 ENTITLEMENT_REQUIRED (spec §5.1): the API
 * names the plan that includes the feature, and this offers it, wherever the
 * call was made. Screens still gate up front from the entitlements responses;
 * this catches what they don't.
 */
export function UpgradePrompt() {
  const [needed, setNeeded] = useState<EntitlementRequired | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, Boolean(needed));

  useEffect(() => {
    const show = (e: Event) => setNeeded((e as CustomEvent<EntitlementRequired>).detail);
    window.addEventListener(ENTITLEMENT_REQUIRED_EVENT, show);
    return () => window.removeEventListener(ENTITLEMENT_REQUIRED_EVENT, show);
  }, []);

  useEffect(() => {
    if (!needed) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNeeded(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [needed]);

  if (!needed) return null;
  const plan = TIER_NAMES[needed.requiredTier as Tier] ?? 'a paid';
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div ref={ref} className="w-full max-w-[440px] rounded-[20px] bg-white p-6 shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 id="upgrade-title" className="text-[16px] font-bold text-[#0F172A]">
            This is part of the {plan} plan
          </h2>
          <button type="button" onClick={() => setNeeded(null)} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[13.5px] text-[#475569]">{needed.message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => setNeeded(null)} className="h-[40px] px-4 rounded-[12px] border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] cursor-pointer">
            Not now
          </button>
          <Link
            to="/dashboard/settings/subscription"
            onClick={() => setNeeded(null)}
            className="h-[40px] px-4 rounded-[12px] bg-[#0F3A53] text-white text-[13px] font-bold inline-flex items-center"
          >
            See the {plan} plan
          </Link>
        </div>
      </div>
    </div>
  );
}
