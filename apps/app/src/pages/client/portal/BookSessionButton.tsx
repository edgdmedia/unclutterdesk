import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';

/** POR-04: the portal's way into the booking wizard (href logic lands in Task 5). */
export function BookSessionButton({ variant = 'primary', label = 'Book a session' }: { variant?: 'primary' | 'secondary'; label?: string }) {
  const brand = useBrand();
  const cls = variant === 'primary'
    ? 'h-11 px-5 rounded-[14px] text-white text-[14px] font-semibold inline-flex items-center gap-2'
    : 'h-11 px-5 rounded-[14px] border border-[#CBD5E1] bg-white text-[14px] font-semibold text-[#0F172A] inline-flex items-center gap-2';
  const style = variant === 'primary' ? { background: brand.primaryColor || '#0F3A53' } : undefined;
  return (
    <Link to="/book" className={cls} style={style}>
      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
