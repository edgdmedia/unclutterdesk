import React from 'react';
import { useBrand } from '@unclutterdesk/ui';
import { PracticeLogo } from '../../../components/public/PracticeLogo';

/**
 * POR-06: signed out, the portal shows this and nothing else — no shell, no
 * menu, no private data, so the page can never claim both states at once.
 */
export function PortalSignIn() {
  const brand = useBrand();
  const primary = brand.primaryColor || '#0F3A53';
  return (
    <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] space-y-4 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <PracticeLogo name={brand.name || 'Unclutter Desk'} logoUrl={brand.logoUrl} size={40} color={primary} />
          <span className="text-[16px] font-bold text-[#0F172A]">{brand.name}</span>
        </div>
        <div className="rounded-[22px] bg-white border border-[#E2E8F0] p-5 space-y-3 text-left">
          <div className="space-y-1">
            <h3 className="text-[15px] font-bold text-[#0F172A]">Sign in to see your sessions</h3>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              Use the email address you booked with. Your sessions and join links
              are private, so they are only shown once you are signed in.
            </p>
          </div>
          <a
            href="/login"
            className="inline-flex h-[46px] px-5 rounded-[14px] text-white text-[13px] font-bold items-center"
            style={{ backgroundColor: primary }}
          >
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
