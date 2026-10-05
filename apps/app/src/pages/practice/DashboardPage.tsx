import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Link2, Calendar, FileText, Video, Globe, Palette, Sparkles, TrendingUp, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button, Page, PageHeader, Grid, MetricTile } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';
import { PendingTransfersCard } from '../../components/payments/PendingTransfersCard';
import { ImageField } from '../../components/settings/ImageField';
import { DashboardTour } from '../../components/onboarding/DashboardTour';
import { api, practiceBookingUrl } from '../../utils/apiClient';

interface DashboardPageProps {
  tenantStatus?: 'ACTIVE' | 'PAUSED';
  setTenantStatus?: (status: 'ACTIVE' | 'PAUSED') => void;
  primaryColor?: string;
  setPrimaryColor?: (color: string) => void;
  secondaryColor?: string;
  setSecondaryColor?: (color: string) => void;
  clients?: any[];
  sessions?: any[];
}

export function DashboardPage(props: DashboardPageProps) {
  const navigate = useNavigate();
  const { profile: authUser, refreshProfile } = useAuth();

  const userFullName = `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim();
  const [profileName, setProfileName] = useState(userFullName || authUser?.email || '');
  const [profileTitle, setProfileTitle] = useState('Practitioner');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [practiceActive, setPracticeActive] = useState(props.tenantStatus === 'ACTIVE');
  const primaryColor = props.primaryColor || '#0F3A53';
  const secondaryColor = props.secondaryColor || '#E3B341';
  const [customDomain, setCustomDomain] = useState('');
  const [customDomainStatus, setCustomDomainStatus] = useState<string | null>(null);
  const [complimentary, setComplimentary] = useState<{ tier: string; until: string } | null>(null);

  const [summary, setSummary] = useState<{
    revenueThisMonthNaira: number;
    monthlyRevenue: Array<{ month: string; label: string; revenueNaira: number }>;
    revenueChangePercent: number | null;
    scheduledSessionsCount: number;
    totalClientsCount: number;
    activeRosterCount: number;
    onboardingCompleted?: boolean;
    hasAvailability?: boolean;
    hasService?: boolean;
    hasPayout?: boolean;
    upcomingSessions: any[];
  }>({
    revenueThisMonthNaira: 0,
    monthlyRevenue: [],
    revenueChangePercent: null,
    scheduledSessionsCount: 0,
    totalClientsCount: 0,
    activeRosterCount: 1,
    onboardingCompleted: true,
    upcomingSessions: [],
  });

  const bookingUrl = practiceBookingUrl(authUser?.tenantSlug, customDomain, customDomainStatus);

  // The photo lives on the server, not just in this screen: after saving, the
  // signed-in profile is re-read so the account menu shows it too.
  async function savePhoto(dataUrl: string) {
    await api.post('/v1/consult/therapist/profile/avatar', { avatarUrl: dataUrl });
    await refreshProfile();
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardMeta() {
      const [brandRes, profileRes, dashSummaryRes] = await Promise.allSettled([
        api.get<{ customDomain?: string | null; customDomainStatus?: string | null }>('/v1/tenant/brand'),
        api.get<{ firstName?: string; lastName?: string; specialty?: string; avatarUrl?: string | null }>('/v1/consult/therapist/profile'),
        api.get<{
          revenueThisMonthNaira: number;
          monthlyRevenue: Array<{ month: string; label: string; revenueNaira: number }>;
          revenueChangePercent: number | null;
          scheduledSessionsCount: number;
          totalClientsCount: number;
          activeRosterCount: number;
          onboardingCompleted?: boolean;
          hasAvailability?: boolean;
          hasService?: boolean;
          hasPayout?: boolean;
          upcomingSessions: any[];
        }>('/v1/consult/dashboard/summary'),
      ]);

      if (cancelled) return;

      if (brandRes.status === 'fulfilled') {
        setCustomDomain(brandRes.value.customDomain || '');
        setCustomDomainStatus(brandRes.value.customDomainStatus ?? null);
      }

      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value;
        const fetchedName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
        if (fetchedName) setProfileName(fetchedName);
        if (p.specialty) setProfileTitle(p.specialty);
        if (p.avatarUrl) setProfileAvatar(p.avatarUrl);
      }


      if (dashSummaryRes.status === 'fulfilled' && dashSummaryRes.value) {
        setSummary({
          ...dashSummaryRes.value,
          // The chart maps over this on every render, so an older API that
          // does not send it must not take the whole dashboard down.
          monthlyRevenue: dashSummaryRes.value.monthlyRevenue ?? [],
          revenueChangePercent: dashSummaryRes.value.revenueChangePercent ?? null,
        });
        // Only a practice with nothing bookable yet is sent back to the wizard.
        // Payouts are optional in the wizard and tracked by the banner above;
        // counting them here bounced everyone who skipped that step straight
        // back to onboarding, even from the wizard's own "Go to dashboard".
        const nothingBookable =
          dashSummaryRes.value.hasService === false || dashSummaryRes.value.hasAvailability === false;
        if (dashSummaryRes.value.onboardingCompleted === false && nothingBookable) {
          const skipped = sessionStorage.getItem('unclutter_skip_onboarding') === 'true';
          if (!skipped) {
            navigate('/onboarding');
          }
        }
      }
    }

    void loadDashboardMeta();

    // Invite-code plans: owners only (others get a 403, which is fine to ignore).
    api
      .get<{ subscriptionTier: string; complimentaryUntil?: string | null }>('/v1/billing/subscription')
      .then((sub) => {
        if (!cancelled && sub.complimentaryUntil) setComplimentary({ tier: sub.subscriptionTier, until: sub.complimentaryUntil });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const presetSwatches = [
    { name: 'Unclutter Desk navy', primary: '#0F3A53', secondary: '#E3B341' },
    { name: 'Signal blue', primary: '#007BFF', secondary: '#6F42C1' },
    { name: 'Calm teal', primary: '#0E7490', secondary: '#F59E0B' },
    { name: 'Deep violet', primary: '#7C3AED', secondary: '#EC4899' },
    { name: 'Forest', primary: '#15803D', secondary: '#B45309' },
  ];

  // Derive dynamic stats from backend summary or props
  const totalSessions = summary.scheduledSessionsCount ?? 0;
  const totalClients = summary.totalClientsCount ?? 0;
  const activeClients = summary.activeRosterCount ?? 0;

  const needsOnboarding = summary.onboardingCompleted === false;

  /*
   * The twelve bars were this month's figure times a fixed ramp — 0.5, 0.6,
   * 0.55 and so on — so every practice on the platform saw the same invented
   * growth story in its own currency, and a practice in its first week saw
   * eleven months of trading it had never done. The series now comes from the
   * server: one bucket per month, holding what was actually collected in it.
   */
  const monthlyBars = summary.monthlyRevenue;
  // Scaled to the best month rather than a hard-coded ₦450, which made any
  // practice earning more than that overflow the chart.
  const barCeiling = Math.max(...monthlyBars.map((m) => m.revenueNaira), 0);

  const changePercent = summary.revenueChangePercent;

  // Render list of actual sessions
  const dynamicSessions = (props.sessions || []).map(s => {
    const startObj = new Date(s.startsAt);
    const endObj = new Date(s.endsAt);
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return {
      id: s.id,
      time: formatTime(startObj),
      end: formatTime(endObj),
      name: s.title,
      type: s.type,
      mode: s.type.includes('Supervision') || s.type.includes('Notes') ? 'Internal Block' : 'Telehealth',
      status: 'Confirmed'
    };
  });

  return (
    <Page
      header={
        <PageHeader
          eyebrow="PRACTICE OVERVIEW"
          title={`Good morning${profileName ? `, ${profileName}` : ''}`}
          actions={
            <>
              <button
                onClick={handleCopyLink}
                className="os-brand-btn h-[40px] md:h-[44px] px-3 md:px-5 rounded-[12px] md:rounded-[14px] font-bold text-[13px] md:text-[14px] flex items-center gap-2 whitespace-nowrap text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Link copied' : 'Copy booking link'}</span>
              </button>
            </>
          }
          secondaryActions={
            <div data-tour="booking-link" className="flex h-[44px] min-w-0 bg-[#F1F5F9] border border-[#E2E8F0] rounded-[14px] px-3.5 items-center gap-2.5">
              <Link2 className="h-4 w-4 text-[#64748B] shrink-0" />
              <input
                type="text"
                readOnly
                aria-label="Booking link"
                value={bookingUrl}
                className="w-[238px] max-w-full min-w-0 bg-transparent text-[13px] font-medium text-[#334155] select-all outline-none"
              />
            </div>
          }
        />
      }
    >
      <DashboardTour />
      <div className="grid grid-cols-1 @min-[1200px]/page:grid-cols-[1fr_372px] gap-4 md:gap-5 items-start">
        {/* Left Column */}
        <div className="space-y-4 md:space-y-[20px]">
          {['OWNER', 'ADMIN', 'RECEPTIONIST'].includes(String(authUser?.role ?? '')) ? <PendingTransfersCard color={primaryColor} /> : null}
          {complimentary && (() => {
            const days = Math.max(0, Math.ceil((new Date(complimentary.until).getTime() - Date.now()) / 86_400_000));
            // Only in the last two weeks: earlier it is noise.
            if (days > 14) return null;
            const plan = complimentary.tier === 'CLINIC' ? 'Clinic' : 'Pro';
            return (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-900">
                  Your free {plan} plan ends in {days} {days === 1 ? 'day' : 'days'}. After that your practice moves to Starter.
                </p>
                <button
                  onClick={() => navigate('/dashboard/settings/subscription')}
                  className="h-9 px-4 rounded-[10px] bg-amber-900 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  Keep {plan}
                </button>
              </div>
            );
          })()}

          {/* Practice Setup Onboarding Banner */}
          {needsOnboarding && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0F3A53] to-[#1E293B] text-white shadow-md border border-[#E3B341]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-[#E3B341]" />
                  <h3 className="font-bold text-[16px] text-white">Complete your practice onboarding setup</h3>
                </div>
                <p className="text-[13px] text-slate-300 mb-2">
                  Follow these 3 steps to start accepting client telehealth bookings and 0% fee direct bank payouts:
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={`inline-flex items-center gap-1 font-medium ${summary.hasService ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {summary.hasService ? <CheckCircle2 className="h-3.5 w-3.5" /> : '•'} 1. Services & Pricing
                  </span>
                  <span className={`inline-flex items-center gap-1 font-medium ${summary.hasAvailability ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {summary.hasAvailability ? <CheckCircle2 className="h-3.5 w-3.5" /> : '•'} 2. Working Hours
                  </span>
                  <span className={`inline-flex items-center gap-1 font-medium ${summary.hasPayout ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {summary.hasPayout ? <CheckCircle2 className="h-3.5 w-3.5" /> : '•'} 3. Bank Payout Account
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate('/onboarding')}
                  className="h-9 px-4 rounded-xl bg-[#E3B341] text-[#0F172A] text-xs font-bold hover:bg-[#F0C558] transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Launch 3-Step Wizard</span>
                </button>
                <button
                  onClick={() => navigate('/dashboard/settings/payouts')}
                  className="h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                >
                  Bank Payouts
                </button>
              </div>
            </div>
          )}

          {/* Revenue Summary Card */}
          <div className="os-card p-4 md:p-[24px_26px] bg-white border border-slate-100 shadow-sm rounded-2xl">
            <div className="flex flex-col @min-[960px]/page:flex-row @min-[960px]/page:items-start justify-between gap-4 mb-6">
              <div>
                <span className="os-eyebrow block mb-1">REVENUE THIS MONTH</span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                  <span className="text-[32px] md:text-[40px] font-extrabold tracking-[-0.04em] text-[#0F172A] leading-none">
                    ₦{summary.revenueThisMonthNaira.toLocaleString()}
                  </span>
                  {/*
                    Was a hard-coded "+100%" beside any non-zero figure, telling
                    a practice it had doubled its income on the strength of
                    having earned anything at all. Nothing is claimed when there
                    is no earlier month to compare against.
                  */}
                  {changePercent !== null ? (
                    <span
                      className={`h-6 px-3 rounded-full text-xs font-bold flex items-center gap-1 border ${
                        changePercent >= 0
                          ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
                          : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                      }`}
                    >
                      <TrendingUp
                        className={`h-3.5 w-3.5 ${changePercent >= 0 ? '' : 'rotate-180'}`}
                      />
                      <span>
                        {changePercent >= 0 ? '+' : ''}
                        {changePercent}% on last month
                      </span>
                    </span>
                  ) : (
                    <span className="h-6 px-3 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
                      Current month
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#64748B] font-medium mt-1">
                  {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <Grid cols={{ base: 3 }} gap="sm" className="w-full @min-[960px]/page:w-auto @min-[960px]/page:min-w-[320px]">
                <MetricTile value={totalSessions} label="Scheduled" />
                <MetricTile value={totalClients} label="Total clients" />
                <MetricTile value={activeClients} label="Active roster" />
              </Grid>
            </div>

            {/* 12-Month Revenue Bars */}
            <div className="h-[96px] flex items-end gap-[10px] pt-4 border-t border-[#E2E8F0]">
              {monthlyBars.map((b, i) => (
                <div
                  key={b.month}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                  title={`${b.month}: ₦${b.revenueNaira.toLocaleString()}`}
                >
                  <div
                    className="w-full rounded-t-[8px] rounded-b-[3px] transition-all duration-300 min-h-[6px]"
                    style={{
                      height: barCeiling > 0 ? `${(b.revenueNaira / barCeiling) * 100}%` : '0%',
                      backgroundColor:
                        i === monthlyBars.length - 1 ? primaryColor : `${primaryColor}4D`,
                    }}
                  />
                  <span className="text-[10.5px] font-semibold text-[#94A3B8]">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Client Sessions Card */}
          <div className="os-card p-4 md:p-[22px_24px_24px] space-y-4 bg-white border border-slate-100 shadow-sm rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="os-eyebrow block">UPCOMING</span>
                <h2 className="text-[17px] font-bold text-[#0F172A] tracking-[-0.02em]">Client sessions scheduled</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-[32px] px-3 rounded-[10px] bg-[#F1F5F9] text-[#475569] text-[12.5px] font-bold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
                </span>
              </div>
            </div>

            {/* Client Session Rows */}
            <div className="space-y-2.5 overflow-x-auto pb-1">
              {dynamicSessions.map((s) => (
                <div
                  key={s.id}
                  className="p-[14px_16px] rounded-[18px] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:shadow-[0_8px_24px_rgba(15,23,42,.08)] hover:-translate-y-[1px] transition-all bg-white min-w-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-[52px] shrink-0 text-center">
                      <span className="text-[15px] font-extrabold text-[#0F172A] block leading-none">{s.time}</span>
                      <span className="text-[10.5px] font-semibold text-[#94A3B8]">{s.end}</span>
                    </div>

                    <div className="hidden sm:block h-[34px] w-[1px] bg-[#E2E8F0]" />

                    <div className="h-[38px] w-[38px] rounded-[12px] bg-[#0F3A53]/10 text-[#0F3A53] font-extrabold flex items-center justify-center text-sm shrink-0">
                      {s.name.split(' ').map(n => n[0]).join('')}
                    </div>

                    <div>
                      <h3 className="text-[14.5px] font-bold text-[#0F172A] leading-snug">{s.name}</h3>
                      <p className="text-[12px] text-[#64748B] font-medium">{s.type} · {s.mode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                      {s.status}
                    </span>

                    <button
                      onClick={() => navigate(`/session/${s.id}/prep`)}
                      className="h-[34px] px-3 rounded-[11px] bg-[#F1F5F9] text-[#475569] text-xs font-bold hover:bg-[#E2E8F0] flex items-center gap-1.5 cursor-pointer">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Notes</span>
                    </button>

                    <button
                      onClick={() => navigate(`/session/${s.id}/prep`)}
                      className="h-[34px] px-3 rounded-[11px] text-white text-xs font-bold flex items-center gap-1.5 transition-opacity cursor-pointer"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>Start session</span>
                    </button>
                  </div>
                </div>
              ))}
              {dynamicSessions.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  No upcoming sessions.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4 md:space-y-[20px]">
          {/* Profile Photo Card */}
          <div className="os-card p-[22px]">
            <span className="os-eyebrow block mb-3">PROFILE PHOTO</span>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative h-[76px] w-[76px] rounded-[24px] bg-[#0F3A53]/10 text-[#0F3A53] font-extrabold flex items-center justify-center text-[24px] ring-3 ring-[#0F3A53]/20 shrink-0">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="Preview" className="h-full w-full object-cover rounded-[24px]" />
                ) : (
                  profileName.split(' ').map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase()
                )}
                <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#10B981] border-[3px] border-white" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[15px] font-bold text-[#0F172A] leading-tight">{profileName}</h3>
                <p className="text-[12.5px] text-[#64748B] font-medium">{profileTitle}</p>
                <p className="text-[11.5px] text-[#94A3B8] font-medium">PNG, JPG or WebP</p>
              </div>
            </div>

            <ImageField
              label="profile photo"
              shape="circle"
              value={profileAvatar ?? ''}
              onChange={setProfileAvatar}
              onSave={savePhoto}
            />
          </div>

          {/* Practice Status Card */}
          <div className="os-card p-[20px_22px]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="os-eyebrow block">PRACTICE STATUS</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`h-2 w-2 rounded-full ${practiceActive ? 'bg-[#10B981]' : 'bg-[#64748B]'}`} />
                  <span className="text-[16px] font-bold text-[#0F172A]">
                    {practiceActive ? 'Active Practice' : 'Inactive Practice'}
                  </span>
                </div>
              </div>

              {/* 60px x 34px Smooth Toggle Switch */}
              <button
                onClick={() => {
                  const nextActive = !practiceActive;
                  setPracticeActive(nextActive);
                  props.setTenantStatus?.(nextActive ? 'ACTIVE' : 'PAUSED');
                }}
                className={`w-[60px] h-[34px] rounded-full p-[3px] transition-colors duration-200 cursor-pointer ${
                  practiceActive ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'
                }`}
              >
                <div
                  className={`w-[28px] h-[28px] rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,.22)] transition-transform duration-200 ${
                    practiceActive ? 'translate-x-[26px]' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[12px] text-[#64748B] font-medium leading-relaxed max-w-[220px]">
              {practiceActive
                ? 'Your booking page is live and accepting new client bookings.'
                : 'Your booking page is hidden. Existing sessions are unaffected.'}
            </p>
          </div>

          {/* Practice Branding & Settings Shortcut Card */}
          <div className="os-card p-[20px_22px] flex items-center justify-between gap-3">
            <div>
              <span className="os-eyebrow block">PRACTICE BRANDING</span>
              <h4 className="text-[14px] font-bold text-[#0F172A] mt-0.5">Colors & Custom Domain</h4>
              <p className="text-[12px] text-[#64748B] font-medium mt-0.5">
                Manage your brand palette, logo, and white-label CNAME.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/settings/brand')}
              className="h-9 px-3.5 rounded-[12px] bg-[#F1F5F9] text-[#0F172A] text-xs font-bold hover:bg-[#E2E8F0] transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <span>Settings</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" />
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
