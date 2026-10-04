import React, { useEffect, useState } from 'react';
import { lazy } from 'react';
import { Outlet, Route } from 'react-router-dom';
import { BrandProvider, type TenantBrandConfig } from '@unclutterdesk/ui';
import { api, getSubdomainTenantSlug } from '../utils/apiClient';

const ClientShell = lazy(() => import('../components/shell/ClientShell').then((m) => ({ default: m.ClientShell })));
const PortalHomePage = lazy(() => import('../pages/client/portal/PortalHomePage').then((m) => ({ default: m.PortalHomePage })));
const PortalSessionsPage = lazy(() => import('../pages/client/portal/PortalSessionsPage').then((m) => ({ default: m.PortalSessionsPage })));
const PortalFormsPage = lazy(() => import('../pages/client/portal/PortalFormsPage').then((m) => ({ default: m.PortalFormsPage })));
const PortalPaymentsPage = lazy(() => import('../pages/client/portal/PortalPaymentsPage').then((m) => ({ default: m.PortalPaymentsPage })));
const PortalDetailsPage = lazy(() => import('../pages/client/portal/PortalDetailsPage').then((m) => ({ default: m.PortalDetailsPage })));
const ClientSessionRoomPage = lazy(() => import('../pages/client/ClientSessionRoomPage').then((m) => ({ default: m.ClientSessionRoomPage })));
const PortalAssessmentPage = lazy(() => import('../pages/client/PortalAssessmentPage').then((m) => ({ default: m.PortalAssessmentPage })));
const ClientFormPage = lazy(() => import('../pages/client/ClientFormPage').then((m) => ({ default: m.ClientFormPage })));
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SetPasswordPage = lazy(() => import('../pages/public/SetPasswordPage').then((m) => ({ default: m.SetPasswordPage })));

/**
 * POR-01: clients arrive at the practice's own link — the confirmation email,
 * the portal button, the "Not you?" sign-in. These routes must exist on the
 * practice host as well as on app.unclutterdesk.com, so every tree that can
 * show client pages renders this one fragment. The tenant resolves from the
 * host (apiClient's TENANT_SLUG), and the session cookie lives on the api
 * domain, so the same pages work anywhere under unclutterdesk.com.
 */
/**
 * POR-01: on a practice host there is no staff brand call to read from, so the
 * client pages brand themselves from the practice's public info.
 */
export function ClientBrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<TenantBrandConfig | null>(null);
  useEffect(() => {
    const slug = getSubdomainTenantSlug();
    api.get<{ name: string; slug: string; logoUrl?: string | null; primaryColor?: string; secondaryColor?: string }>(
      slug ? `/v1/tenant/public/info/${slug}` : '/v1/tenant/public/info',
    ).then((t) => setBrand({
      name: t.name,
      slug: t.slug,
      logoUrl: t.logoUrl ?? null,
      primaryColor: t.primaryColor ?? null,
      secondaryColor: t.secondaryColor ?? null,
    } as TenantBrandConfig)).catch(() => undefined);
  }, []);
  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}

export const CLIENT_PORTAL_ROUTES = (
  <>
    <Route path="/portal" element={<ClientShell><Outlet /></ClientShell>}>
      <Route index element={<PortalHomePage />} />
      <Route path="sessions" element={<PortalSessionsPage />} />
      <Route path="forms" element={<PortalFormsPage />} />
      <Route path="payments" element={<PortalPaymentsPage />} />
      <Route path="details" element={<PortalDetailsPage />} />
    </Route>
    <Route path="/portal/assessments/:id" element={<PortalAssessmentPage />} />
    <Route path="/portal/sessions/:id/room" element={<ClientSessionRoomPage />} />
    <Route path="/forms/:id" element={<ClientFormPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/set-password" element={<SetPasswordPage />} />
  </>
);
