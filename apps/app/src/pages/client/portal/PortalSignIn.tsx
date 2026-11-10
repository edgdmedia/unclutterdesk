import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Eyebrow, useBrand } from '@unclutterdesk/ui';
import { CalendarDays, ClipboardList, CreditCard, FileText } from 'lucide-react';
import { PracticeLogo } from '../../../components/public/PracticeLogo';

/**
 * POR-06: signed out, the portal shows this and nothing else — no shell, no
 * menu, no private data, so the page can never claim both states at once.
 *
 * This is also the practice's welcome to their client: who they are, what the
 * portal holds, and the way in. The sign-in link carries the requested path so
 * a recap, form or assessment link returns there afterwards.
 */
export function PortalSignIn() {
  const brand = useBrand();
  const location = useLocation();
  const navigate = useNavigate();
  const primary = brand.primaryColor || '#0F3A53';
  const returnTo = `${location.pathname}${location.search}`;
  const query = `returnTo=${encodeURIComponent(returnTo)}`;
  const signInHref = `/login?${query}`;
  const createAccountHref = `/login?mode=create&${query}`;

  return (
    <div className="min-h-screen bg-[var(--desk-surface)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[520px] space-y-5">
        <div className="flex items-center justify-center gap-2.5">
          <PracticeLogo name={brand.name || 'Unclutter Desk'} logoUrl={brand.logoUrl} size={40} color={primary} />
          <span className="text-[16px] font-bold text-[var(--desk-text)]">{brand.name}</span>
        </div>
        <Card padding="p-5 sm:p-7" className="space-y-5">
          <div className="space-y-2">
            <Eyebrow>Your portal</Eyebrow>
            <h1 className="m-0 text-[20px] font-bold text-[var(--desk-text)]">Welcome to {brand.name}</h1>
            <p className="m-0 text-[13.5px] leading-relaxed text-[var(--desk-text-muted)]">
              Sign in to see your sessions and join links, forms, recaps and payments.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-2 text-[13px] text-[var(--desk-text-body)] sm:grid-cols-2">
            <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" style={{ color: primary }} aria-hidden="true" />Sessions and join links</li>
            <li className="flex items-center gap-2"><ClipboardList className="h-4 w-4 shrink-0" style={{ color: primary }} aria-hidden="true" />Forms and questionnaires</li>
            <li className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0" style={{ color: primary }} aria-hidden="true" />Session recaps</li>
            <li className="flex items-center gap-2"><CreditCard className="h-4 w-4 shrink-0" style={{ color: primary }} aria-hidden="true" />Payments</li>
          </ul>
          <Button variant="primary" size="xl" fullWidth onClick={() => navigate(signInHref)}>
            Sign in
          </Button>
          <div className="space-y-2 border-t border-[var(--desk-border)] pt-4">
            <p className="m-0 text-center text-[12.5px] text-[var(--desk-text-muted)]">
              First time?{' '}
              <Link to={createAccountHref} className="font-bold text-[var(--desk-text)] hover:underline">
                Create your account
              </Link>
            </p>
            <p className="m-0 text-center text-[12px] leading-relaxed text-[var(--desk-text-subtle)]">
              Your information is private and only shown once you are signed in.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}