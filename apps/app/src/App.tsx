import React, { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import useSWR from 'swr';
import { Sidebar } from './components/Sidebar';
import { BrandProvider, BottomNav } from '@unclutterdesk/ui';
import { Home, Calendar, Users, Palette } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api, getSubdomainTenantSlug, getAppType } from './utils/apiClient';

// ── Lazy-loaded pages (code-split per route) ──────────────────────────────────
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SchedulePage = lazy(() => import('./pages/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const ClientsPage = lazy(() => import('./pages/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const BrandSettingsPage = lazy(() => import('./pages/BrandSettingsPage').then((m) => ({ default: m.BrandSettingsPage })));
const TeamSettingsPage = lazy(() => import('./pages/TeamSettingsPage').then((m) => ({ default: m.TeamSettingsPage })));
const SubscriptionSettingsPage = lazy(() => import('./pages/SubscriptionSettingsPage').then((m) => ({ default: m.SubscriptionSettingsPage })));
const PayoutSettingsPage = lazy(() => import('./pages/PayoutSettingsPage').then((m) => ({ default: m.PayoutSettingsPage })));
const FormsManagerPage = lazy(() => import('./pages/FormsManagerPage').then((m) => ({ default: m.FormsManagerPage })));
const FormEditorPage = lazy(() => import('./pages/FormEditorPage').then((m) => ({ default: m.FormEditorPage })));
const DiscountSettingsPage = lazy(() => import('./pages/DiscountSettingsPage').then((m) => ({ default: m.DiscountSettingsPage })));
const TelehealthVideoRoomPage = lazy(() => import('./pages/TelehealthVideoRoomPage').then((m) => ({ default: m.TelehealthVideoRoomPage })));
const SessionPrepPage = lazy(() => import('./pages/SessionPrepPage').then((m) => ({ default: m.SessionPrepPage })));
const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage').then((m) => ({ default: m.ClientPortalPage })));
const OnboardingWizardPage = lazy(() => import('./pages/OnboardingWizardPage').then((m) => ({ default: m.OnboardingWizardPage })));
const ClientBookingPage = lazy(() => import('./pages/ClientBookingPage').then((m) => ({ default: m.ClientBookingPage })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage })));
const PublicReviewFormPage = lazy(() => import('./pages/PublicReviewFormPage').then((m) => ({ default: m.PublicReviewFormPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage').then((m) => ({ default: m.TermsOfServicePage })));
const BookingConfirmedPage = lazy(() => import('./pages/BookingConfirmedPage').then((m) => ({ default: m.BookingConfirmedPage })));
const InactivePracticePage = lazy(() => import('./pages/InactivePracticePage').then((m) => ({ default: m.InactivePracticePage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SubmissionsPage = lazy(() => import('./pages/SubmissionsPage').then((m) => ({ default: m.SubmissionsPage })));
const AvailabilitySettingsPage = lazy(() => import('./pages/AvailabilitySettingsPage').then((m) => ({ default: m.AvailabilitySettingsPage })));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage').then((m) => ({ default: m.MyProfilePage })));
const AccountPreferencesPage = lazy(() => import('./pages/AccountPreferencesPage').then((m) => ({ default: m.AccountPreferencesPage })));
const PracticeProfilePage = lazy(() => import('./pages/PracticeProfilePage').then((m) => ({ default: m.PracticeProfilePage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/auth/SignupPage').then((m) => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const InvitePage = lazy(() => import('./pages/auth/InvitePage').then((m) => ({ default: m.InvitePage })));
const ClientAccountSetupPage = lazy(() => import('./pages/auth/ClientAccountSetupPage').then((m) => ({ default: m.ClientAccountSetupPage })));
const PlatformAdminLoginPage = lazy(() => import('./pages/admin/PlatformAdminLoginPage').then((m) => ({ default: m.PlatformAdminLoginPage })));
const PlatformAdminLayout = lazy(() => import('./pages/admin/PlatformAdminLayout').then((m) => ({ default: m.PlatformAdminLayout })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminTenantsPage = lazy(() => import('./pages/admin/AdminTenantsPage').then((m) => ({ default: m.AdminTenantsPage })));
const AdminTenantDetailPage = lazy(() => import('./pages/admin/AdminTenantDetailPage').then((m) => ({ default: m.AdminTenantDetailPage })));

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  clientId?: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  category: 'individual' | 'couples' | 'admin';
  status?: string;
  clientEmail?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  care: string;
  sessions: string;
  next: string;
  status: string;
  initials: string;
  phone: string;
  since: string;
  emergency: string;
  notes: {
    id: string;
    date: string;
    time: string;
    title: string;
    status: string;
    note: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }[];
  intake: { q: string; a: string }[];
  intakeSummary?: {
    instrument: 'PHQ_9' | 'GAD_7';
    totalScore: number;
    severity: string;
    item9Risk: boolean;
  } | null;
}

export interface StaffMember {
  id: string;
  name: string;
  title: string;
  email: string;
  role: string;
  status: string;
  initials: string;
  pending?: boolean;
}

export interface BillingInfo {
  plan: 'starter' | 'pro' | 'clinic';
  nextBillingDate: string;
  nextChargeAmount: string;
  payoutsActive: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
  invoiceHistory: Array<{ date: string; desc: string; amount: string; status: string }>;
}

// ── Booking shape returned by API ─────────────────────────────────────────────
interface ApiBooking {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

// ── Staff shape returned by API ───────────────────────────────────────────────
interface ApiStaff {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  avatarUrl?: string;
  specialty?: string;
}

// ── Map API booking → CalendarEvent ──────────────────────────────────────────
function bookingToEvent(b: ApiBooking): CalendarEvent {
  const titleLower = b.serviceTitle.toLowerCase();
  const category: CalendarEvent['category'] = titleLower.includes('couples')
    ? 'couples'
    : titleLower.includes('admin') || titleLower.includes('supervision')
      ? 'admin'
      : 'individual';
  return {
    id: b.id,
    clientId: b.clientId,
    title: b.clientName,
    type: b.serviceTitle,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    category,
    status: b.status,
    clientEmail: b.clientEmail,
  };
}

// ── Map API staff → StaffMember ───────────────────────────────────────────────
function apiStaffToMember(s: ApiStaff): StaffMember {
  const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return {
    id: s.id,
    name,
    title: s.specialty || s.role.charAt(0) + s.role.slice(1).toLowerCase(),
    email: s.email,
    role: s.role,
    status: s.status === 'active' ? 'Active' : s.status === 'pending' ? 'Pending' : 'Inactive',
    initials,
    pending: s.status === 'pending',
  };
}

// ── Fallback data (used if API is unreachable) ────────────────────────────────
const FALLBACK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Adaeze Okonkwo',
    email: 'adaeze@email.com',
    care: 'Individual Therapy',
    sessions: '14',
    next: 'Thu, 7 Aug · 14:00',
    status: 'Active',
    initials: 'AO',
    phone: '0802 345 6789',
    since: 'Mar 2026',
    emergency: 'Chidi Okoye · Brother · 0803 552 8814',
    notes: [
      {
        id: 'n1',
        date: '31 Jul 2026',
        time: '14:00',
        title: 'Individual Therapy Session #7',
        status: 'COMPLETED',
        note: 'NOTE SIGNED',
        subjective: 'Client reports panic attack frequency reduced over past 14 days.',
        objective: 'Grooming intact, affect congruent. GAD-7 score: 9.',
        assessment: 'Good response to CBT protocol. Anxiety decreasing.',
        plan: 'Continue bi-weekly 50-minute sessions. Practice 4-7-8 breathing daily.',
      },
    ],
    intake: [
      { q: 'Primary reason for seeking therapy?', a: 'Frequent anxiety spikes and difficulty sleeping.' },
      { q: 'Have you attended therapy before?', a: 'Yes, 2 years ago for 6 months.' },
      { q: 'Currently taking any medications?', a: 'None.' },
    ],
    intakeSummary: { instrument: 'PHQ_9', totalScore: 12, severity: 'Moderate', item9Risk: false },
  },
  {
    id: '2',
    name: 'Tunde Bello',
    email: 'tunde@email.com',
    care: 'Individual Therapy',
    sessions: '8',
    next: 'Thu, 7 Aug · 15:30',
    status: 'Active',
    initials: 'TB',
    phone: '0805 123 4567',
    since: 'May 2026',
    emergency: 'Kemi Bello · Wife · 0805 998 1234',
    notes: [],
    intake: [],
    intakeSummary: null,
  },
];

const FALLBACK_SESSIONS: CalendarEvent[] = [
  { id: '1', title: 'Adaeze Okonkwo', type: 'Individual Therapy', startsAt: '2026-08-07T09:00:00.000Z', endsAt: '2026-08-07T09:50:00.000Z', category: 'individual' },
  { id: '2', title: 'Tunde Bello', type: 'Individual Therapy', startsAt: '2026-08-07T10:30:00.000Z', endsAt: '2026-08-07T11:20:00.000Z', category: 'individual' },
];

const FALLBACK_STAFF: StaffMember[] = [
  { id: '1', name: 'Dr. Adaeze Okonkwo', title: 'Clinical director', email: 'dr.adaeze@okonkwotherapy.ng', role: 'OWNER', status: 'Active', initials: 'AO' },
  { id: '2', name: 'Nkem Eze', title: 'Counselling psychologist', email: 'nkem@okonkwotherapy.ng', role: 'THERAPIST', status: 'Active', initials: 'NE' },
];

// ── SWR data fetchers ─────────────────────────────────────────────────────────
const fetchBookings = async (url: string): Promise<CalendarEvent[]> => {
  const bookings = await api.get<ApiBooking[]>(url);
  return bookings.map(bookingToEvent);
};

const fetchStaff = async (url: string): Promise<StaffMember[]> => {
  const data = await api.get<ApiStaff[]>(url);
  return data.map(apiStaffToMember);
};

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-sm font-semibold text-[#64748B] animate-pulse">Loading…</div>
    </div>
  );
}

// ── Main AppLayout ─────────────────────────────────────────────────────────────

function AppLayout() {
  const { profile, isAuthenticated, isLoading } = useAuth();
  const [tenantStatus, setTenantStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [primaryColor, setPrimaryColor] = useState('#0F3A53');
  const [secondaryColor, setSecondaryColor] = useState('#E3B341');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('unclutter_sidebar_collapsed') === '1'
  );
  
  const handleToggleCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('unclutter_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    plan: 'pro',
    nextBillingDate: '1 September 2026',
    nextChargeAmount: '₦25,000',
    payoutsActive: true,
    bankName: 'Access Bank',
    accountNumber: '1023456789',
    accountName: 'Dr. Adaeze Okonkwo Practice',
    invoiceHistory: [
      { date: '1 Aug 2026', desc: 'Pro Solo — Monthly Plan', amount: '₦25,000', status: 'PAID' },
      { date: '1 Jul 2026', desc: 'Pro Solo — Monthly Plan', amount: '₦25,000', status: 'PAID' },
      { date: '1 Jun 2026', desc: 'Pro Solo — Monthly Plan', amount: '₦25,000', status: 'RETRIED' },
      { date: '1 May 2026', desc: 'Starter → Pro Upgrade', amount: '₦25,000', status: 'PAID' },
    ],
  });

  // API-backed state with graceful fallback to mock data on error.
  // Keys are null until a tenant session is active: anonymous visitors on the
  // login screen, and platform admins (no tenant workspace) don't fetch.
  const location = useLocation();
  const isAdminRoute =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  const hasTenantSession = isAuthenticated && profile?.type !== 'platform_admin';
  const clientsKey = hasTenantSession && !isAdminRoute ? '/v1/tenant/clients' : null;
  const bookingsKey = hasTenantSession && !isAdminRoute ? '/v1/consult/therapist/bookings' : null;
  const staffKey = hasTenantSession && !isAdminRoute ? '/v1/tenant/staff' : null;

  const {
    data: clients,
    mutate: mutateClients,
  } = useSWR<Client[]>(clientsKey, { fallbackData: FALLBACK_CLIENTS });

  const {
    data: sessions,
    mutate: mutateSessions,
  } = useSWR<CalendarEvent[]>(bookingsKey, {
    fetcher: fetchBookings,
    fallbackData: FALLBACK_SESSIONS,
  });

  const {
    data: staff,
    mutate: mutateStaff,
  } = useSWR<StaffMember[]>(staffKey, {
    fetcher: fetchStaff,
    fallbackData: FALLBACK_STAFF,
  });

  // Local-only setters (optimistic updates, no network revalidation)
  const setClients = useCallback(
    (value: React.SetStateAction<Client[]>) => {
      void mutateClients(value, { revalidate: false });
    },
    [mutateClients],
  );

  const setSessions = useCallback(
    (value: React.SetStateAction<CalendarEvent[]>) => {
      void mutateSessions(value, { revalidate: false });
    },
    [mutateSessions],
  );

  const setStaff = useCallback(
    (value: React.SetStateAction<StaffMember[]>) => {
      void mutateStaff(value, { revalidate: false });
    },
    [mutateStaff],
  );

  const refreshClients = useCallback(async () => {
    await mutateClients();
  }, [mutateClients]);

  const refreshStaff = useCallback(async () => {
    await mutateStaff();
  }, [mutateStaff]);

  const resolvedClients = useMemo(() => clients ?? [], [clients]);
  const resolvedSessions = useMemo(() => sessions ?? [], [sessions]);
  const resolvedStaff = useMemo(() => staff ?? [], [staff]);

  const practiceBrand = useMemo(() => ({
    name: profile?.practiceName || (profile?.firstName ? `${profile.firstName}'s Practice` : 'Unclutter Desk Practice'),
    slug: profile?.tenantSlug || getSubdomainTenantSlug() || 'practice',
    primaryColor,
    secondaryColor,
  }), [profile, primaryColor, secondaryColor]);

  // Platform admin console — own shell, no tenant branding.
  if (isAdminRoute) {
    return <AdminShell />;
  }

  // Fullscreen routes without standard sidebar layout
  const isFullscreen =
    location.pathname.startsWith('/session') ||
    location.pathname.startsWith('/booking') ||
    location.pathname.startsWith('/onboarding') ||
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/invite') ||
    location.pathname.startsWith('/client/') ||
    location.pathname === '/portal' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/' ||
    location.pathname === '/forgot-password' ||
    location.pathname.startsWith('/reset-password') ||
    location.pathname === '/verify-email';

  if (isFullscreen) {
    return (
      <BrandProvider brand={practiceBrand}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/session/:id/prep" element={<SessionPrepPage />} />
            <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
            <Route path="/portal" element={<ClientPortalPage />} />
            <Route path="/onboarding" element={<OnboardingWizardPage />} />
            <Route path="/booking/confirmed" element={<BookingConfirmedPage />} />
            <Route path="/booking/inactive" element={<InactivePracticePage />} />

            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />

            {/* Auth Routes */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/signup" element={<SignupPage />} />
            <Route path="/register" element={<SignupPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/invite/claim" element={<InvitePage />} />
            <Route path="/invite/claim" element={<InvitePage />} />
            <Route path="/client/create-account" element={<ClientAccountSetupPage />} />
          </Routes>
        </Suspense>
      </BrandProvider>
    );
  }

  // Session restore in flight — avoid flashing the login screen.
  if (isLoading) {
    return <PageFallback />;
  }

  // Workspace routes are private.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <BrandProvider brand={practiceBrand}>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        {/* Desktop Sidebar (hidden on mobile) */}
        <div className="hidden md:flex flex-none">
          <Sidebar 
            plan={billingInfo?.plan} 
            isCollapsed={isSidebarCollapsed} 
            onToggleCollapse={handleToggleCollapse} 
          />
        </div>
        
        {/* Mobile Off-canvas Sidebar Backdrop removed as per mobile-first redesign. Mobile uses BottomNav only. */}

        <div className="flex-1 flex flex-col min-w-0 pb-[92px] md:pb-0">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <DashboardPage
                    tenantStatus={tenantStatus}
                    setTenantStatus={setTenantStatus}
                    primaryColor={primaryColor}
                    setPrimaryColor={setPrimaryColor}
                    secondaryColor={secondaryColor}
                    setSecondaryColor={setSecondaryColor}
                    clients={resolvedClients}
                    sessions={resolvedSessions}
                    onOpenSidebar={() => setIsSidebarOpen(true)}
                  />
                }
              />
              <Route path="/dashboard/schedule" element={<SchedulePage sessions={resolvedSessions} setSessions={setSessions} clients={resolvedClients} tenantSlug={profile?.tenantSlug} />} />
              <Route path="/dashboard/clients" element={<ClientsPage clients={resolvedClients} setClients={setClients} onRefresh={refreshClients} />} />
              <Route path="/dashboard/clients/:id" element={<ClientDetailPage clients={resolvedClients} setClients={setClients} />} />
              <Route path="/dashboard/analytics" element={<AnalyticsPage clients={resolvedClients} sessions={resolvedSessions} />} />
              <Route path="/dashboard/submissions" element={<SubmissionsPage />} />
              <Route path="/dashboard/notifications" element={<NotificationsPage />} />
              <Route path="/dashboard/settings/notifications" element={<NotificationsPage />} />
              <Route path="/dashboard/profile" element={<MyProfilePage />} />
              <Route path="/dashboard/settings/account" element={<AccountPreferencesPage />} />
              <Route path="/dashboard/settings/availability" element={<AvailabilitySettingsPage />} />
              <Route path="/dashboard/settings/profile" element={<PracticeProfilePage />} />
              <Route
                path="/dashboard/settings/brand"
                element={
                  <BrandSettingsPage
                    primaryColor={primaryColor}
                    setPrimaryColor={setPrimaryColor}
                    secondaryColor={secondaryColor}
                    setSecondaryColor={setSecondaryColor}
                  />
                }
              />
              <Route path="/dashboard/settings/team" element={<TeamSettingsPage staff={resolvedStaff} setStaff={setStaff} onRefresh={refreshStaff} />} />
              <Route path="/dashboard/settings/subscription" element={<SubscriptionSettingsPage />} />
              <Route path="/dashboard/settings/payouts" element={<PayoutSettingsPage />} />
              <Route path="/dashboard/settings/forms" element={<FormsManagerPage />} />
              <Route path="/dashboard/settings/forms/:id" element={<FormEditorPage />} />
              <Route path="/dashboard/settings/discounts" element={<DiscountSettingsPage />} />
              <Route path="/" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
          <BottomNav 
            items={[
              { label: 'Today', icon: <Home className="h-5 w-5" strokeWidth={2.5} />, key: '/dashboard' },
              { label: 'Schedule', icon: <Calendar className="h-5 w-5" strokeWidth={2.5} />, key: '/dashboard/schedule' },
              { label: 'Clients', icon: <Users className="h-5 w-5" strokeWidth={2.5} />, key: '/dashboard/clients' },
              { label: 'Brand', icon: <Palette className="h-5 w-5" strokeWidth={2.5} />, key: '/dashboard/settings/brand' }
            ]}
            active={location.pathname === '/' ? '/dashboard' : location.pathname}
            onSelect={(key: string) => window.location.href = key}
          />
        </div>
      </div>
    </BrandProvider>
  );
}

// ── Platform Admin Console ─────────────────────────────────────────────────────

function AdminShell() {
  const { profile, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === '/admin/login';

  if (isLoading) return <PageFallback />;

  if (isLogin) {
    if (isAuthenticated && profile?.type === 'platform_admin') {
      return <Navigate to="/admin" replace />;
    }
    return (
      <Suspense fallback={<PageFallback />}>
        <PlatformAdminLoginPage />
      </Suspense>
    );
  }

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (profile?.type !== 'platform_admin') return <Navigate to="/login" replace />;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PlatformAdminLayout />}>
          <Route path="/admin" element={<AdminOverviewPage />} />
          <Route path="/admin/tenants" element={<AdminTenantsPage />} />
          <Route path="/admin/tenants/:id" element={<AdminTenantDetailPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function RootRedirect() {
  const { profile } = useAuth();
  const appType = getAppType();
  
  if (appType === 'admin') return <Navigate to="/admin" replace />;
  if (appType === 'booking') return <PublicProfilePage />; // Renders profile on the root of the subdomain
  if (appType === 'marketing') {
    // Should typically not be reached if marketing site is separately deployed,
    // but redirect to the actual marketing site url or login just in case.
    return <Navigate to="/login" replace />;
  }
  
  // App type is 'app'
  return <Navigate to={profile?.type === 'platform_admin' ? '/admin' : '/dashboard'} replace />;
}

export function App() {
  const appType = getAppType();

  // If this is the booking app context, we only need a few routes.
  if (appType === 'booking') {
    return (
      <BrowserRouter>
        <AuthProvider>
          <SWRConfig
            value={{
              fetcher: (key: string) => api.get(key),
              revalidateOnFocus: false,
              dedupingInterval: 60_000,
              errorRetryCount: 2,
            }}
          >
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<PublicProfilePage />} />
                <Route path="/book" element={<ClientBookingPage />} />
                <Route path="/review" element={<PublicReviewFormPage />} />
                <Route path="/booking/confirmed" element={<BookingConfirmedPage />} />
                <Route path="/booking/inactive" element={<InactivePracticePage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </SWRConfig>
        </AuthProvider>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <SWRConfig
          value={{
            fetcher: (key: string) => api.get(key),
            revalidateOnFocus: false,
            dedupingInterval: 60_000,
            errorRetryCount: 2,
          }}
        >
          <AppLayout />
        </SWRConfig>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
