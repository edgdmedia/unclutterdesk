import React from 'react';
import { lazy } from 'react';
import { Route } from 'react-router-dom';

const ClientPortalPage = lazy(() => import('../pages/client/ClientPortalPage').then((m) => ({ default: m.ClientPortalPage })));
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
export const CLIENT_PORTAL_ROUTES = (
  <>
    <Route path="/portal" element={<ClientPortalPage />} />
    <Route path="/portal/assessments/:id" element={<PortalAssessmentPage />} />
    <Route path="/forms/:id" element={<ClientFormPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/set-password" element={<SetPasswordPage />} />
  </>
);
