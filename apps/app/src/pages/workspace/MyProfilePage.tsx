import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

type ProfileRecord = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  credentials?: string;
  yearsExperience?: number;
  welcomeMessage?: string;
  modalities?: string[];
  languages?: string[];
  bookingEmail?: string;
  notificationEmail?: string;
  videoProvider?: string;
};

const inputCls = 'h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]';

export function MyProfilePage() {
  const [profile, setProfile] = useState<ProfileRecord>({ modalities: [], languages: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      try {
        const data = await api.get<ProfileRecord>('/v1/consult/therapist/profile');
        if (!cancelled) setProfile({ ...data, modalities: data.modalities || [], languages: data.languages || [] });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load profile');
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
      await api.post('/v1/consult/therapist/profile', profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center gap-5 shrink-0">
        <div>
          <Eyebrow>ACCOUNT</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">My profile</h1>
          <p className="text-xs text-[#64748B] font-medium">Real therapist profile data used on your booking page</p>
        </div>
        <button onClick={() => void handleSave()} className="os-brand-btn ml-auto h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 text-white cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0F3A53' }} disabled={saving || loading}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[24px_26px_32px] grid grid-cols-[minmax(0,1fr)_352px] gap-[20px] items-start">
        <div className="flex flex-col gap-5">
          {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
          {loading ? <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading profile...</div> : (
            <>
              <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                <Eyebrow className="mb-1">PERSONAL DETAILS</Eyebrow>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">First name</label><input className={inputCls} value={profile.firstName || ''} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Last name</label><input className={inputCls} value={profile.lastName || ''} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Phone</label><input className={inputCls} value={profile.phone || ''} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Specialty</label><input className={inputCls} value={profile.specialty || ''} onChange={(e) => setProfile((p) => ({ ...p, specialty: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Booking email</label><input className={inputCls} value={profile.bookingEmail || ''} onChange={(e) => setProfile((p) => ({ ...p, bookingEmail: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Notification email</label><input className={inputCls} value={profile.notificationEmail || ''} onChange={(e) => setProfile((p) => ({ ...p, notificationEmail: e.target.value }))} /></div>
                </div>
                <div className="mt-4"><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Bio</label><textarea rows={5} className="w-full min-h-[96px] p-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8] resize-none leading-relaxed" value={profile.welcomeMessage || ''} onChange={(e) => setProfile((p) => ({ ...p, welcomeMessage: e.target.value }))} /></div>
              </div>

              <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                <Eyebrow className="mb-1">CREDENTIALS</Eyebrow>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Credentials</label><input className={inputCls} value={profile.credentials || ''} onChange={(e) => setProfile((p) => ({ ...p, credentials: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Years experience</label><input type="number" className={inputCls} value={profile.yearsExperience || 0} onChange={(e) => setProfile((p) => ({ ...p, yearsExperience: Number(e.target.value) || 0 }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Modalities</label><input className={inputCls} value={(profile.modalities || []).join(', ')} onChange={(e) => setProfile((p) => ({ ...p, modalities: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Languages</label><input className={inputCls} value={(profile.languages || []).join(', ')} onChange={(e) => setProfile((p) => ({ ...p, languages: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) }))} /></div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                <Eyebrow className="mb-1">PREFERENCES</Eyebrow>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Currency</label>
                    <select className={inputCls} disabled value="NGN">
                      <option value="NGN">NGN - Nigerian Naira</option>
                    </select>
                    <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">Platform default.</p>
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Date & Time Format</label>
                    <select className={inputCls} disabled value="en-GB">
                      <option value="en-GB">DD/MM/YYYY, 12-hour</option>
                    </select>
                    <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">Platform default.</p>
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Language</label>
                    <select className={inputCls} disabled value="en">
                      <option value="en">English (UK)</option>
                    </select>
                    <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">More languages coming soon.</p>
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Default Video Provider</label>
                    <select className={inputCls} value={profile.videoProvider || 'JITSI'} onChange={(e) => setProfile((p) => ({ ...p, videoProvider: e.target.value }))}>
                      <option value="JITSI">Jitsi (Built-in)</option>
                      <option value="GOOGLE_MEET">Google Meet</option>
                    </select>
                    <p className="text-[10.5px] text-[#94A3B8] mt-1.5 font-medium">Automatically generate links for your sessions.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px] shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
          <span className="text-[15px] font-bold text-[#0F172A]">Public summary</span>
          <div className="mt-4 space-y-2 text-sm text-[#475569] font-medium">
            <div><strong className="text-[#0F172A]">Name:</strong> {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Not set'}</div>
            <div><strong className="text-[#0F172A]">Specialty:</strong> {profile.specialty || 'Not set'}</div>
            <div><strong className="text-[#0F172A]">Languages:</strong> {(profile.languages || []).join(', ') || 'Not set'}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
