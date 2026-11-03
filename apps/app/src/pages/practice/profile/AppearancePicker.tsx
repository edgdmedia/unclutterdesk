import type { CSSProperties } from 'react';
import { Card, PROFILE_LAYOUTS, PROFILE_THEMES, profileLayout, profileTheme, ScaledPreview, type ProfileLayoutKey, type ProfileTheme } from '@unclutterdesk/ui';
import { PublicProfilePreview, type PublicProfilePreviewProps } from '../../public/PublicProfilePreview';
import { profilePath } from '../../../config/domains';

/** A small structural sketch of each layout, in neutral greys. */
function LayoutThumb({ layout }: { layout: ProfileLayoutKey }) {
  const bar = (w: string, h = 5, bg = '#CBD5E1'): CSSProperties => ({ width: w, height: h, borderRadius: 999, background: bg });
  return (
    <span aria-hidden className="h-[64px] rounded-[10px] bg-[#F1F5F9] overflow-hidden flex flex-col p-1.5 gap-1">
      {layout === 'classic' && (
        <span className="flex flex-col items-center gap-1 pt-1">
          <span className="h-[18px] w-[18px] rounded-full bg-[#94A3B8]" />
          <span style={bar('50%', 5, '#64748B')} />
          <span style={bar('70%')} />
          <span style={bar('80%', 7, '#94A3B8')} />
        </span>
      )}
      {layout === 'editorial' && (
        <>
          <span className="h-[26px] -mx-1.5 -mt-1.5 bg-[#CBD5E1]" />
          <span style={bar('60%', 6, '#64748B')} />
          <span style={bar('85%', 4, '#94A3B8')} />
        </>
      )}
      {layout === 'compact' && (
        <>
          <span className="flex items-center gap-1"><span className="h-[14px] w-[14px] rounded-[4px] bg-[#94A3B8]" /><span style={bar('45%', 5, '#64748B')} /></span>
          <span className="h-[10px] rounded-[4px] bg-white" />
          <span className="h-[10px] rounded-[4px] bg-white" />
          <span className="h-[10px] rounded-[4px] bg-white" />
        </>
      )}
      {layout === 'split' && (
        <span className="flex gap-1 h-full">
          <span className="flex-1 flex flex-col gap-1"><span style={bar('80%', 6, '#64748B')} /><span style={bar('100%')} /><span style={bar('90%')} /></span>
          <span className="w-[38%] rounded-[5px] bg-white" />
        </span>
      )}
    </span>
  );
}

/**
 * How the public profile looks (spec §6.5): a layout and a colour palette,
 * chosen separately, with a live scaled preview built from the same tokens the
 * public page uses. Any palette works on any layout; neither changes the words.
 */
export function AppearancePicker({
  layoutKey,
  themeKey,
  name,
  kindLabel,
  headline,
  // Full preview data
  tenant,
  therapist,
  slots,
  reviews,
  hasAbout,
  onChange,
}: {
  layoutKey: string;
  themeKey: string;
  name: string;
  kindLabel: string;
  headline: string | null;
  tenant: PublicProfilePreviewProps['tenant'];
  therapist: PublicProfilePreviewProps['therapist'];
  slots: PublicProfilePreviewProps['slots'];
  reviews: PublicProfilePreviewProps['reviews'];
  hasAbout: PublicProfilePreviewProps['hasAbout'];
  onChange: (change: { layoutKey?: string; themeKey?: string }) => void;
}) {
  const layout = profileLayout(layoutKey);
  const theme = profileTheme(themeKey);

  const publicProfileUrl = tenant?.slug ? profilePath(tenant.slug) : null;

  return (
    <Card padding="lg">
      <span className="text-[15px] font-bold text-[#0F172A]">Appearance</span>
      <p className="mt-1 text-[12.5px] text-[#64748B]">Pick a layout and a colour palette. Your words stay the same.</p>

      <span className="mt-4 block text-[9px] font-black tracking-[0.22em] uppercase text-[#94A3B8]" id="layout-label">Layout</span>
      <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="layout-label">
        {PROFILE_LAYOUTS.map((l) => (
          <button
            key={l.key}
            type="button"
            role="radio"
            aria-checked={layout.key === l.key}
            onClick={() => layout.key !== l.key && onChange({ layoutKey: l.key })}
            className={`flex flex-col gap-1.5 p-2 rounded-[14px] border bg-white cursor-pointer text-left ${
              layout.key === l.key ? 'border-[#24614F] ring-2 ring-[#24614F]/20' : 'border-[#E2E8F0]'
            }`}
          >
            <LayoutThumb layout={l.key} />
            <span className="text-[13px] font-bold text-[#0F172A]">{l.label}</span>
            <span className="text-[11.5px] leading-snug text-[#64748B]">{l.description}</span>
          </button>
        ))}
      </div>

      <span className="mt-4 block text-[9px] font-black tracking-[0.22em] uppercase text-[#94A3B8]" id="palette-label">Colour palette</span>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="palette-label">
        {PROFILE_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={theme.key === t.key}
            onClick={() => theme.key !== t.key && onChange({ themeKey: t.key })}
            title={t.description}
            className={`flex items-center gap-2 h-[44px] pl-1.5 pr-3 rounded-[14px] border bg-white cursor-pointer ${
              theme.key === t.key ? 'border-[#24614F] ring-2 ring-[#24614F]/20' : 'border-[#E2E8F0]'
            }`}
          >
            <span
              aria-hidden
              className="h-[30px] w-[30px] rounded-[9px] border flex items-center justify-center"
              style={{ background: t.colors.background, borderColor: t.colors.border }}
            >
              <span className="h-[14px] w-[14px] rounded-full" style={{ background: t.colors.accent }} />
            </span>
            <span className="text-[13px] font-bold text-[#0F172A]">{t.label}</span>
          </button>
        ))}
      </div>

      <ScaledPreview
        width={1180}
        minHeight={700}
        showDeviceSwitch={true}
        showFullScreen={true}
        fullScreenLabel="View full profile"
        onFullScreen={publicProfileUrl ? () => window.open(publicProfileUrl, '_blank') : undefined}
      >
        <PublicProfilePreview
          tenant={tenant}
          therapist={therapist}
          slots={slots}
          reviews={reviews}
          hasAbout={hasAbout}
        />
      </ScaledPreview>
    </Card>
  );
}
