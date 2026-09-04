import React, { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import useSWR from 'swr';
import { Sidebar } from './components/Sidebar';
import { BrandProvider, BottomNav } from '@unclutterdesk/ui';
import { Home, Calendar, Users, Palette } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api, getSubdomainTenantSlug, getAppType } from './utils/apiClient';
import { ExternalRedirect } from './components/ExternalRedirect';
import { LEGAL_URLS } from './utils/legal';

// ── Lazy-loaded pages (code-split per route) ──────────────────────────────────
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
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
// The documents live on the marketing site — see utils/legal.ts. These routes
// stay because they are linked and bookmarked, but they no longer hold a second
// copy of the text to drift from.
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
  /** An invitation that has not been claimed — there is no account behind it. */
  pending?: boolean;
  invitedAt?: string | null;
  expiresAt?: string | null;
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
  /** "member" has joined; "invite" is an invitation still outstanding. */
  kind?: 'member' | 'invite';
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  avatarUrl?: string;
  specialty?: string;
  invitedAt?: string | null;
  expiresAt?: string | null;
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
  // An invitation has no name yet, so the address is what identifies it.
  const pending = s.kind === 'invite';
  const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return {
    id: s.id,
    name,
    title: pending
      ? `Invited as ${s.role.charAt(0) + s.role.slice(1).toLowerCase()}`
      : s.specialty || s.role.charAt(0) + s.role.slice(1).toLowerCase(),
    email: s.email,
    role: s.role,
    status: pending ? 'Pending' : s.status === 'active' ? 'Active' : 'Inactive',
    initials,
    pending,
    invitedAt: s.invitedAt ?? null,
    expiresAt: s.expiresAt ?? null,
  };
}

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

  // Private workspace data comes only from the authenticated API.
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
    error: clientsError,
    mutate: mutateClients,
  } = useSWR<Client[]>(clientsKey);

  const {
    data: sessions,
    error: sessionsError,
    mutate: mutateSessions,
  } = useSWR<CalendarEvent[]>(bookingsKey, {
    fetcher: fetchBookings,
  });

  const {
    data: staff,
    error: staffError,
    mutate: mutateStaff,
  } = useSWR<StaffMember[]>(staffKey, {
    fetcher: fetchStaff,
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

  // Re-fetch from the API, as opposed to setSessions which only edits the cache.
  const refreshSessions = useCallback(() => mutateSessions(), [mutateSessions]);

  const refreshClients = useCallback(async () => {
    await mutateClients();
  }, [mutateClients]);

  const refreshStaff = useCallback(async () => {
    await mutateStaff();
  }, [mutateStaff]);

  const resolvedClients = useMemo(() => clients ?? [], [clients]);
  const resolvedSessions = useMemo(() => sessions ?? [], [sessions]);
  const resolvedStaff = useMemo(() => staff ?? [], [staff]);
  const privateDataError = clientsError || sessionsError || staffError;

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

            <Route path="/privacy" element={<ExternalRedirect to={LEGAL_URLS.privacy} />} />
            <Route path="/terms" element={<ExternalRedirect to={LEGAL_URLS.terms} />} />

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
            <Route path="*" element={<NotFoundPage homeHref="/login" />} />
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
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="*" element={<NotFoundPage homeHref="/login" />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <BrandProvider brand={practiceBrand}>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        {/* Desktop Sidebar (hidden on mobile) */}
        <div className="hidden md:flex flex-none">
          <Sidebar 
             isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleCollapse} 
          />
        </div>
        
        {/* Mobile Off-canvas Sidebar Backdrop removed as per mobile-first redesign. Mobile uses BottomNav only. */}

         <div className="flex-1 flex flex-col min-w-0 pb-[92px] md:pb-0">
           {privateDataError ? (
             <div role="alert" className="mx-4 mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 md:mx-[26px]">
               We could not load the latest workspace data. Refresh the page or try again shortly.
             </div>
           ) : null}
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
              <Route path="/dashboard/schedule" element={<SchedulePage sessions={resolvedSessions} setSessions={setSessions} clients={resolvedClients} tenantSlug={profile?.tenantSlug} onRefresh={refreshSessions} />} />
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
              <Route path="/dashboard/settings/team" element={<TeamSettingsPage staff={resolvedStaff} onRefresh={refreshStaff} />} />
              <Route path="/dashboard/settings/subscription" element={<SubscriptionSettingsPage />} />
              <Route path="/dashboard/settings/payouts" element={<PayoutSettingsPage />} />
              <Route path="/dashboard/settings/forms" element={<FormsManagerPage />} />
              <Route path="/dashboard/settings/forms/:id" element={<FormEditorPage />} />
              <Route path="/dashboard/settings/discounts" element={<DiscountSettingsPage />} />
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<NotFoundPage />} />
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
          <Route path="*" element={<NotFoundPage homeHref="/admin" />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function RootRedirect() {
  const { profile, isAuthenticated, isLoading } = useAuth();
  const appType = getAppType();

  if (isLoading) return <PageFallback />;

  if (appType === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  if (appType === 'booking') {
    return <PublicProfilePage />;
  }
  if (appType === 'marketing') {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" replace />;
  }

  const destination = profile.type === 'platform_admin' ? '/admin' : profile.type === 'user' ? '/portal' : '/dashboard';
  return <Navigate to={destination} replace />;
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
              errorRetryCount: 1,
            }}
          >
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<PublicProfilePage />} />
                <Route path="/book" element={<ClientBookingPage />} />
                <Route path="/review" element={<PublicReviewFormPage />} />
                <Route path="/booking/confirmed" element={<BookingConfirmedPage />} />
                <Route path="/booking/inactive" element={<InactivePracticePage />} />
                <Route path="/privacy" element={<ExternalRedirect to={LEGAL_URLS.privacy} />} />
                <Route path="/terms" element={<ExternalRedirect to={LEGAL_URLS.terms} />} />
                <Route path="*" element={<NotFoundPage />} />
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
              errorRetryCount: 1,
            }}
          >
          <AppLayout />
        </SWRConfig>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
