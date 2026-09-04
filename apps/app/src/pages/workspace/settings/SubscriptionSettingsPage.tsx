import React, { useEffect, useState } from 'react';
import { Check, TrendingUp } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

type SubscriptionRecord = {
  subscriptionTier: 'STARTER' | 'PRO' | 'CLINIC';
  nextBillingDate: string;
  nextChargeAmount: string;
  currentMonthBookings?: number;
  canDowngradeToStarter?: boolean;
  canDowngradeToPro?: boolean;
  starterBlockReason?: string | null;
  proBlockReason?: string | null;
};
type BillingSummary = { subscription: SubscriptionRecord; history: Array<{ date: string; title: string; detail: string; type: string }> };

/**
 * A plan, priced by the server from the same figure the Paystack charge is
 * built from.
 *
 * The prices used to be written into this page and all three were wrong: Pro
 * was offered at ₦25,000 and Group Clinic at ₦75,000 while the charge was
 * ₦15,000 and ₦45,000, and Starter was shown as free when it is not. The price
 * on the button someone clicks to buy has to be the price they are charged.
 */
type Plan = { tier: SubscriptionRecord['subscriptionTier']; name: string; price: string };

/** What each tier includes. Copy, not pricing — the figures come from the API. */
const PLAN_FEATURES: Record<SubscriptionRecord['subscriptionTier'], string[]> = {
  STARTER: ['1 Practitioner profile', 'Up to 20 bookings / mo', 'Instant Jitsi WebRTC video'],
  PRO: [
    'Unlimited sessions & bookings',
    '1 Receptionist / Staff login',
    'Custom Domain (CNAME)',
    'Daily.co BYOK Cloud Recording',
  ],
  CLINIC: ['Up to 25 Therapist profiles', 'Group Clinic RBAC Roles', 'Supervisor case reviews'],
};

const PLAN_TONE: Record<SubscriptionRecord['subscriptionTier'], 'light' | 'dark'> = {
  STARTER: 'light',
  PRO: 'dark',
  CLINIC: 'light',
};

function getPlanDisabledReason(plan: SubscriptionRecord['subscriptionTier'], subscription: SubscriptionRecord) {
  if (plan === subscription.subscriptionTier) return null;
  if (plan === 'STARTER' && subscription.canDowngradeToStarter === false) {
    return subscription.starterBlockReason || 'Downgrade blocked';
  }
  if (plan === 'PRO' && subscription.subscriptionTier === 'CLINIC' && subscription.canDowngradeToPro === false) {
    return subscription.proBlockReason || 'Downgrade blocked';
  }
  return null;
}

export function SubscriptionSettingsPage() {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [history, setHistory] = useState<BillingSummary['history']>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSubscription() {
      setLoading(true);
      try {
        const [data, planList] = await Promise.all([
          api.get<BillingSummary>('/v1/billing/summary'),
          api.get<Plan[]>('/v1/billing/plans'),
        ]);
        if (!cancelled) {
          setSubscription(data.subscription);
          setPlans(planList);
          setHistory(data.history);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Unable to load subscription');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSubscription();
    return () => { cancelled = true; };
  }, []);

  async function handleSelectPlan(plan: SubscriptionRecord['subscriptionTier']) {
    if (!subscription || plan === subscription.subscriptionTier) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/v1/billing/subscribe', { plan });
      const refreshed = await api.get<BillingSummary>('/v1/billing/summary');
      setSubscription(refreshed.subscription);
      setHistory(refreshed.history);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to update subscription');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Subscription</h1>
          <p className="text-xs text-[#64748B] font-medium">{subscription ? `Next charge ${subscription.nextChargeAmount} on ${subscription.nextBillingDate}` : 'Loading subscription...'}</p>
        </div>
      </header>

      <main className="p-[24px_26px_30px] space-y-6 flex-1">
        {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
        {loading || !subscription || !plans ? <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading subscription...</div> : (
          <>
            <div className="grid grid-cols-3 gap-5">
              {plans.map((p) => {
                const plan = {
                  key: p.tier,
                  name: p.name,
                  price: `${p.price}/month`,
                  tone: PLAN_TONE[p.tier],
                  features: PLAN_FEATURES[p.tier],
                };
                const disabledReason = getPlanDisabledReason(plan.key, subscription);
                const isDisabled = saving || !!disabledReason;

                return (
                <button key={plan.key} onClick={() => void handleSelectPlan(plan.key)} disabled={isDisabled} className={`p-6 rounded-[24px] transition-all relative flex flex-col justify-between space-y-4 text-left ${plan.tone === 'dark' ? 'bg-[#0F172A] text-white' : 'bg-white'} ${subscription.subscriptionTier === plan.key ? `border-2 ${plan.tone === 'dark' ? 'border-[#E3B341]' : 'border-[#0F3A53]'}` : 'border border-[#E2E8F0]'} ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} disabled:opacity-60`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><h3 className="text-[18px] font-extrabold">{plan.name}</h3>{subscription.subscriptionTier === plan.key ? <span className="text-[10px] font-black uppercase tracking-wider">Current</span> : null}</div>
                    <div className="text-[28px] font-extrabold">{plan.price}</div>
                    <ul className={`space-y-2 text-xs font-medium pt-2 border-t ${plan.tone === 'dark' ? 'text-slate-300 border-slate-800' : 'text-[#475569] border-[#F1F5F9]'}`}>
                      {plan.features.map((feature) => <li key={feature} className="flex items-center gap-2"><Check className={`h-3.5 w-3.5 ${plan.tone === 'dark' ? 'text-[#E3B341]' : 'text-emerald-600'}`} /> {feature}</li>)}
                      {plan.key === 'STARTER' && subscription.subscriptionTier === 'STARTER' && subscription.currentMonthBookings !== undefined && (
                        <li className="flex items-center gap-2 pt-2 text-[#0F3A53] font-bold">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {subscription.currentMonthBookings} of 20 bookings used this month
                        </li>
                      )}
                    </ul>
                    {disabledReason ? (
                      <div className="rounded-[12px] bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-medium text-amber-800">
                        {disabledReason}
                      </div>
                    ) : null}
                  </div>
                </button>
              )})}
            </div>
            <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]"><TrendingUp className="h-4 w-4 text-[#0F3A53]" /> Billing history</div>
              {history.map((item) => (
                <div key={`${item.type}_${item.date}`} className="rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
                  <div className="text-[12px] font-bold text-[#0F172A]">{item.title}</div>
                  <div className="text-[11px] text-[#94A3B8] font-medium">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.date))}</div>
                  <div className="mt-1 text-[12px] text-[#475569] font-medium">{item.detail}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
