import React, { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';

type PracticeProfile = {
  name?: string;
  shortName?: string;
  welcomeMessage?: string;
  publicEmail?: string;
  publicPhone?: string;
  city?: string;
  address?: string;
  category?: string;
};

const inputCls = 'h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]';

export function PracticeProfilePage() {
  const [profile, setProfile] = useState<PracticeProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      try {
        const data = await api.get<PracticeProfile>('/v1/tenant/brand');
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load practice profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProfile();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/v1/tenant/brand', profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save practice profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>PRACTICE</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Practice profile</h1>
          <p className="text-xs text-[#64748B] font-medium">Public practice details shown on your booking page.</p>
        </div>
        <button onClick={() => void handleSave()} className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 text-white cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0F3A53' }} disabled={saving || loading}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </header>

      <main className="p-[24px_26px_30px] grid grid-cols-[minmax(0,1fr)_372px] gap-[20px] items-start flex-1">
        <div className="space-y-5">
          {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
          {loading ? <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading practice profile...</div> : (
            <>
              <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                <Eyebrow className="mb-1">PRACTICE IDENTITY</Eyebrow>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Practice name</label><input className={inputCls} value={profile.name || ''} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Short name</label><input className={inputCls} value={profile.shortName || ''} onChange={(e) => setProfile((p) => ({ ...p, shortName: e.target.value }))} /></div>
                </div>
                <div className="mt-4"><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Bio / tagline</label><textarea rows={4} className="w-full px-[14px] py-3 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8] resize-none leading-relaxed" value={profile.welcomeMessage || ''} onChange={(e) => setProfile((p) => ({ ...p, welcomeMessage: e.target.value }))} /></div>
              </div>

              <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                <Eyebrow className="mb-1">CONTACT & LOCATION</Eyebrow>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Public email</label><input className={inputCls} value={profile.publicEmail || ''} onChange={(e) => setProfile((p) => ({ ...p, publicEmail: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Phone</label><input className={inputCls} value={profile.publicPhone || ''} onChange={(e) => setProfile((p) => ({ ...p, publicPhone: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">City</label><input className={inputCls} value={profile.city || ''} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Address</label><input className={inputCls} value={profile.address || ''} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} /></div>
                  <div className="col-span-2"><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Practice category</label><input className={inputCls} value={profile.category || ''} onChange={(e) => setProfile((p) => ({ ...p, category: e.target.value }))} /></div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px]">
          <Eyebrow className="mb-1">PUBLIC PROFILE</Eyebrow>
          <h3 className="text-[17px] font-bold tracking-[-0.01em] text-[#0F172A] mb-3">What clients will see</h3>
          <div className="space-y-2 text-sm text-[#475569] font-medium">
            <div><strong className="text-[#0F172A]">Practice:</strong> {profile.name || 'Not set'}</div>
            <div><strong className="text-[#0F172A]">Email:</strong> {profile.publicEmail || 'Not set'}</div>
            <div><strong className="text-[#0F172A]">City:</strong> {profile.city || 'Not set'}</div>
          </div>
          <div className="mt-5 p-3.5 rounded-[14px] bg-[#FEF3C7] text-[#92400E] text-xs font-medium flex items-start gap-2.5 leading-relaxed">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Changes go live on your booking page as soon as you save.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
