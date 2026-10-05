import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '@unclutterdesk/ui';
import { APP_BASE_URL } from '../../utils/apiClient';
import { PracticeLogo } from '../../components/public/PracticeLogo';
import { ClientAuthPanel } from './ClientAuthPanel';

/**
 * BKG-15: the client's way in, on the practice's own host. The header's
 * "Log in" and the portal's sign-in card both land here; staff keep their
 * own page, offered as a quiet link below.
 */
export function ClientLoginPage() {
  const brand = useBrand();
  const navigate = useNavigate();
  const primary = brand.primaryColor || '#0F3A53';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] space-y-4">
        <div className="flex items-center justify-center gap-2.5">
          <PracticeLogo name={brand.name || 'Unclutter Desk'} logoUrl={brand.logoUrl} size={40} color={primary} />
          <span className="text-[16px] font-bold text-[#0F172A]">{brand.name}</span>
        </div>
        <div className="rounded-[22px] bg-white border border-[#E2E8F0] p-6 space-y-4">
          <div className="space-y-1 text-center">
            <h1 className="m-0 text-[18px] font-bold text-[#0F172A]">Welcome back</h1>
            <p className="m-0 text-[13px] text-[#64748B]">Sign in to see your sessions, forms and payments.</p>
          </div>
          <ClientAuthPanel initialMode="signin" onDone={() => navigate('/portal', { replace: true })} />
        </div>
        <p className="text-center text-[12.5px] text-[#64748B]">
          Are you the practice?{' '}
          <a href={`${APP_BASE_URL}/login`} className="font-bold hover:underline" style={{ color: primary }}>
            Staff sign in
          </a>
        </p>
      </div>
    </div>
  );
}
