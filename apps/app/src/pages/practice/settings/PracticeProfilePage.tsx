import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Info } from 'lucide-react';
import { Eyebrow, Page, PageHeader, PROFILE_THEMES, Toggle, useToast } from '@unclutterdesk/ui';
import { PaletteSwatches } from '../../practice/profile/AppearancePicker';
import { api } from '../../../utils/apiClient';

type PracticeProfile = {
  name?: string;
  shortName?: string;
  welcomeMessage?: string;
  tagline?: string;
  welcomeTitle?: string;
  publicEmail?: string;
  publicPhone?: string;
  city?: string;
  address?: string;
  category?: string;
  /** §6.17: a solo practice can use its owner's profile for its page. */
  useProfileForPractice?: boolean;
  /** From the API: whether this practice is solo, and what the profile fills in. Not saved. */
  solo?: boolean;
  fromProfile?: { welcomeMessage?: string; tagline?: string; city?: string; logoUrl?: string };
  /** The practice's accent; the Look picker writes the chosen palette's accent here. */
  primaryColor?: string;
};

/** The owner's public profile look, shown read-only while a solo practice uses its profile. */
type ProfileLook = { themeKey: string; brandColor: string | null };

/** Which palette a stored practice accent belongs to; anything else is the Custom colour. */
function lookFromAccent(accent: string | null | undefined): ProfileLook {
  const hex = (accent ?? '').toUpperCase();
  const match = PROFILE_THEMES.find((t) => t.colors.accent.toUpperCase() === hex);
  return match ? { themeKey: match.key, brandColor: null } : { themeKey: 'custom', brandColor: accent ?? null };
}

/** What to store on the practice brand for the chosen palette. */
function accentFromLook(look: ProfileLook): string | undefined {
  if (look.themeKey === 'custom') return look.brandColor ?? undefined;
  return PROFILE_THEMES.find((t) => t.key === look.themeKey)?.colors.accent;
}

const inputCls = 'h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]';

/** While a solo practice uses its owner's profile, an empty field shows what will appear instead. */
function fromProfileHint(p: PracticeProfile, field: 'welcomeMessage' | 'tagline'): string | null {
  if (!p.solo || p.useProfileForPractice === false) return null;
  const v = p.fromProfile?.[field];
  return v ? `From your profile: ${v}` : null;
}

export function PracticeProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<PracticeProfile>({});
  const [profileLook, setProfileLook] = useState<ProfileLook | null>(null);
  const [look, setLook] = useState<ProfileLook>({ themeKey: 'custom', brandColor: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      try {
        const [data, own] = await Promise.all([
          api.get<PracticeProfile>('/v1/tenant/brand'),
          // The owner's public profile: a solo practice's page borrows its look.
          api.get<ProfileLook | null>('/v1/practitioner-profile/me').catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(data);
        setLook(lookFromAccent(data.primaryColor));
        if (own && typeof own === 'object') {
          setProfileLook({ themeKey: own.themeKey ?? 'calm', brandColor: own.brandColor ?? null });
        }
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
      const { solo: _solo, fromProfile: _from, ...editable } = profile;
      // A solo practice using its profile takes its look from there, so the
      // practice-accent picker is not shown and must not overwrite it.
      const usesProfileLook = profile.solo && profile.useProfileForPractice !== false;
      const accent = usesProfileLook ? undefined : accentFromLook(look);
      await api.patch('/v1/tenant/brand', { ...editable, ...(accent ? { primaryColor: accent } : {}) });
      toast.success('Practice profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the practice profile');
      setError(err instanceof Error ? err.message : 'Unable to save practice profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page
      header={
        <PageHeader
          eyebrow="PRACTICE"
          title="Practice profile"
          actions={
            <button onClick={() => void handleSave()} className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 text-white cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0F3A53' }} disabled={saving || loading}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          }
        />
      }
    >
      <p className="text-xs text-[#64748B] font-medium">Public practice details shown on your booking page.</p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_372px] gap-[20px] items-start">
        <div className="space-y-5">
          {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
          {loading ? <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading practice profile...</div> : (
            <>
              {profile.solo ? (
                <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[20px_26px] flex items-start gap-4">
                  <Toggle
                    width={48}
                    checked={profile.useProfileForPractice !== false}
                    onChange={(next: boolean) => setProfile((p) => ({ ...p, useProfileForPractice: next }))}
                    aria-label="Use my profile for my practice page"
                  />
                  <div>
                    <p className="text-[14px] font-bold text-[#0F172A]">Use my profile for my practice page</p>
                    <p className="text-[12.5px] text-[#64748B] mt-0.5">
                      You're the only therapist here, so your booking page can show what's in{' '}
                      <Link to="/dashboard/profile" className="font-bold text-[#0F3A53] underline">My profile</Link>: your about, headline, city and photo.
                      Anything you fill in below is used instead.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="bg-[var(--desk-surface)] rounded-[24px] border border-[var(--desk-border)] p-[24px_26px]">
                <Eyebrow className="mb-1">LOOK</Eyebrow>
                {profile.solo && profile.useProfileForPractice !== false ? (
                  <>
                    <p className="text-[12.5px] text-[var(--desk-text-muted)] mt-1">
                      Your page uses the look from{' '}
                      <Link to="/dashboard/profile" className="font-bold text-[var(--desk-text)] underline">My profile</Link>.
                      Change the palette or custom colour there.
                    </p>
                    <div className="mt-3">
                      <PaletteSwatches
                        themeKey={profileLook?.themeKey ?? 'calm'}
                        brandColor={profileLook?.brandColor ?? null}
                        readOnly
                      />
                    </div>
                    <Link
                      to="/dashboard/profile"
                      className="mt-3 inline-flex h-[38px] items-center rounded-[12px] border border-[var(--desk-border)] px-4 text-[12.5px] font-bold text-[var(--desk-text)]"
                    >
                      Change in your profile
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-[12.5px] text-[var(--desk-text-muted)] mt-1">
                      The palette for your booking page and your practice page.
                    </p>
                    <span className="mt-3 block text-[9px] font-black tracking-[0.22em] uppercase text-[var(--desk-text-subtle)]" id="palette-label">
                      Colour palette
                    </span>
                    <div className="mt-2">
                      <PaletteSwatches
                        themeKey={look.themeKey}
                        brandColor={look.brandColor}
                        onPick={(change) =>
                          setLook({ themeKey: change.themeKey, brandColor: change.brandColor ?? null })
                        }
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                <Eyebrow className="mb-1">PRACTICE IDENTITY</Eyebrow>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Practice name</label><input className={inputCls} value={profile.name || ''} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Short name</label><input className={inputCls} value={profile.shortName || ''} onChange={(e) => setProfile((p) => ({ ...p, shortName: e.target.value }))} /></div>
                </div>
                <div className="mt-4"><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Welcome headline</label><input className="h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]" value={profile.welcomeTitle || ''} maxLength={120} placeholder="Headline in the About section of your booking page" onChange={(e) => setProfile((p) => ({ ...p, welcomeTitle: e.target.value }))} /></div>
                <div className="mt-4"><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Tagline</label><input className="h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8]" value={profile.tagline || ''} maxLength={120} placeholder={fromProfileHint(profile, 'tagline') ?? 'One line under your name on the booking page'} onChange={(e) => setProfile((p) => ({ ...p, tagline: e.target.value }))} /></div>
                <div className="mt-4"><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Welcome message</label><textarea rows={4} className="w-full px-[14px] py-3 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8] resize-none leading-relaxed" value={profile.welcomeMessage || ''} placeholder={fromProfileHint(profile, 'welcomeMessage') ?? undefined} onChange={(e) => setProfile((p) => ({ ...p, welcomeMessage: e.target.value }))} /></div>
              </div>

              <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
                <Eyebrow className="mb-1">CONTACT & LOCATION</Eyebrow>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Public email</label><input className={inputCls} value={profile.publicEmail || ''} onChange={(e) => setProfile((p) => ({ ...p, publicEmail: e.target.value }))} /></div>
                  <div><label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Phone</label><input className={inputCls} value={profile.publicPhone || ''} onChange={(e) => setProfile((p) => ({ ...p, publicPhone: e.target.value }))} /></div>
                  <div className="col-span-2 text-[12.5px] text-[#64748B]">Addresses moved to <Link to="/dashboard/settings/locations" className="font-bold text-[#0F3A53] underline">Locations</Link> — add the places you see clients there.</div>
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
            <div><strong className="text-[#0F172A]">Locations:</strong> <Link to="/dashboard/settings/locations" className="text-[#0F3A53] underline">Manage</Link></div>
          </div>
          <div className="mt-5 p-3.5 rounded-[14px] bg-[#FEF3C7] text-[#92400E] text-xs font-medium flex items-start gap-2.5 leading-relaxed">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Changes go live on your booking page as soon as you save.</span>
          </div>
        </div>
      </div>
    </Page>
  );
}
