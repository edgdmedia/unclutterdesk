import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { getAppType, getBookingUrl } from '../../../utils/apiClient';

/**
 * POR-04: the booking wizard lives on the practice's host. There the client is
 * already signed in on the same origin; from app.unclutterdesk.com we send
 * them to the practice's own address (the session cookie is on the api
 * domain, so they stay signed in).
 */
export function bookingHref(appType: string, slug: string | null | undefined): string {
  if (appType === 'booking' || !slug) return '/book';
  return `${getBookingUrl(slug)}/book`;
}
export function BookSessionButton({ variant = 'primary', label = 'Book a session' }: { variant?: 'primary' | 'secondary'; label?: string }) {
  const brand = useBrand();
  const href = bookingHref(getAppType(), brand.slug);
  const cls = variant === 'primary'
    ? 'h-11 px-5 rounded-[14px] text-white text-[14px] font-semibold inline-flex items-center gap-2'
    : 'h-11 px-5 rounded-[14px] border border-[#CBD5E1] bg-white text-[14px] font-semibold text-[#0F172A] inline-flex items-center gap-2';
  const style = variant === 'primary' ? { background: brand.primaryColor || '#0F3A53' } : undefined;
  const icon = <CalendarPlus className="h-4 w-4" aria-hidden="true" />;
  return href.startsWith('/') ? (
    <Link to={href} className={cls} style={style}>{icon}{label}</Link>
  ) : (
    <a href={href} className={cls} style={style}>{icon}{label}</a>
  );
}
