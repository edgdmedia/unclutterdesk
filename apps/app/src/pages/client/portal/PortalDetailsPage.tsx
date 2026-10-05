import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, useBrand } from '@unclutterdesk/ui';
import { useAuth } from '../../../context/AuthContext';

/** POR-03: who you are signed in as, platform preferences, and sign out. */
export function PortalDetailsPage() {
  const brand = useBrand();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/portal', { replace: true });
  };

  return (
    <Page header={<PageHeader eyebrow={brand.name} title="My details" />}>
      <Card padding="p-5" className="space-y-1">
        <Eyebrow>ACCOUNT</Eyebrow>
        <div className="text-[14px] font-bold text-[#0F172A]">{profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.email : '—'}</div>
        <div className="text-[13px] text-[#64748B] font-medium">{profile?.email ?? '—'}</div>
      </Card>

      <Card padding="p-5" className="space-y-4">
        <Eyebrow>PREFERENCES</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Currency', value: 'NGN - Nigerian Naira', note: 'Platform default.' },
            { label: 'Date & Time Format', value: 'DD/MM/YYYY, 12-hour', note: 'Platform default.' },
            { label: 'Language', value: 'English (UK)', note: 'More languages coming soon.' },
          ].map((pref) => (
            <div key={pref.label}>
              <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">{pref.label}</label>
              <select className="h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none" disabled value={pref.value}>
                <option value={pref.value}>{pref.value}</option>
              </select>
              <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">{pref.note}</p>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <button
          type="button"
          onClick={handleSignOut}
          className="h-[44px] px-5 rounded-[14px] border border-[#E2E8F0] text-[13.5px] font-bold text-[#B42318] hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </Page>
  );
}
