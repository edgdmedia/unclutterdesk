import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  PROFILE_LAYOUTS,
  PROFILE_THEMES,
  brandTokens,
  profileLayout,
  profileTheme,
  ScaledPreview,
  type BrandAccent,
  type ProfileLayoutKey,
  type ProfileTheme,
} from '@unclutterdesk/ui';
import { profilePath } from '../../../config/domains';

/**
 * Custom brand colour (spec §6.5, plan task 7): a sixth palette beside the
 * five presets. The colour is the accent only; `brandTokens()` decides what
 * it becomes so the page stays readable, and `profileTheme('custom', …)`
 * gives the preview the same palette the public page uses. Neither is
 * reimplemented here.
 */

/** The page a practice below Starter is sent to. */
export const UPGRADE_PATH = '/dashboard/settings/subscription';

const DEFAULT_CUSTOM = '#2A56A8';

/** `#RGB` or `#RRGGBB`, with or without the hash → `#RRGGBB` uppercase, or null. */
export function hexInput(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw.split('').map((c) => c + c).join('').toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

export interface PalettePick {
  themeKey: string;
  brandColor?: string | null;
}

/** A small chip of a colour. */
function Chip({ colour }: { colour: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[14px] w-[14px] rounded-[4px] border border-[var(--desk-border)]"
      style={{ background: colour }}
    />
  );
}

/**
 * The palette row: the five presets and Custom, with the colour input and the
 * contrast note under it. Shared by the profile editor and the practice
 * profile page so the two cannot drift (plan task 8).
 *
 * `customLocked` is the plan gate: below Starter the Custom swatch is a link
 * to the plans page and never calls `onPick`. `readOnly` shows the current
 * choice with nothing to change, for a solo practice using its owner's profile.
 */
export function PaletteSwatches({
  themeKey,
  brandColor,
  onPick,
  onPreview,
  customLocked = false,
  readOnly = false,
}: {
  themeKey: string;
  brandColor?: string | null;
  onPick?: (change: PalettePick) => void;
  onPreview?: (themeKey: string, brandColor: string | null) => void;
  customLocked?: boolean;
  readOnly?: boolean;
}) {
  const saved = hexInput(brandColor);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(saved ?? DEFAULT_CUSTOM);

  // Follow a colour saved elsewhere (a reload, or another tab) rather than
  // leaving the field on the old value.
  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const isCustom = themeKey === 'custom';
  const showingCustom = !readOnly && (isCustom || open);
  const parsed = hexInput(draft);
  const tokens: BrandAccent | null = parsed ? brandTokens(parsed) : saved ? brandTokens(saved) : null;
  const colourValue = parsed ?? saved ?? DEFAULT_CUSTOM;

  const reportPreview = useCallback(
    (key: string, colour: string | null) => onPreview?.(key, colour),
    [onPreview],
  );
  useEffect(() => {
    if (!showingCustom) reportPreview(themeKey, null);
    else reportPreview('custom', parsed ?? saved);
  }, [showingCustom, themeKey, parsed, saved, reportPreview]);

  const pickPreset = (key: string) => {
    if (readOnly) return;
    setOpen(false);
    onPick?.({ themeKey: key });
  };

  const pickCustom = () => {
    if (readOnly || customLocked) return;
    if (isCustom) return;
    setOpen(true);
    // A saved colour is enough to switch; otherwise the panel waits for one.
    if (saved) onPick?.({ themeKey: 'custom' });
  };

  const commit = () => {
    if (!parsed || readOnly) return;
    onPick?.({ themeKey: 'custom', brandColor: parsed });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="palette-label">
          {PROFILE_THEMES.map((t) => {
            const checked = showingCustom ? false : themeKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-disabled={readOnly || undefined}
                onClick={() => themeKey !== t.key && pickPreset(t.key)}
                title={t.description}
                className={`flex items-center gap-2 h-[44px] pl-1.5 pr-3 rounded-[14px] border bg-[var(--desk-surface)] ${
                  readOnly ? 'cursor-default' : 'cursor-pointer'
                } ${checked ? 'border-[var(--desk-text)] ring-2 ring-[var(--desk-text)]/20' : 'border-[var(--desk-border)]'}`}
              >
                <span
                  aria-hidden
                  className="h-[30px] w-[30px] rounded-[9px] border flex items-center justify-center"
                  style={{ background: t.colors.background, borderColor: t.colors.border }}
                >
                  <span className="h-[14px] w-[14px] rounded-full" style={{ background: t.colors.accent }} />
                </span>
                <span className="text-[13px] font-bold text-[var(--desk-text)]">{t.label}</span>
              </button>
            );
          })}

          {!customLocked && (!readOnly || isCustom) && (
            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              aria-disabled={readOnly || undefined}
              onClick={pickCustom}
              className={`flex items-center gap-2 h-[44px] pl-1.5 pr-3 rounded-[14px] border bg-[var(--desk-surface)] ${
                readOnly ? 'cursor-default' : 'cursor-pointer'
              } ${isCustom ? 'border-[var(--desk-text)] ring-2 ring-[var(--desk-text)]/20' : 'border-[var(--desk-border)]'}`}
            >
              <span
                aria-hidden
                className="h-[30px] w-[30px] rounded-[9px] border flex items-center justify-center"
                style={{ background: tokens?.soft ?? '#E9F0FB', borderColor: 'var(--desk-border)' }}
              >
                <span className="h-[14px] w-[14px] rounded-full" style={{ background: tokens?.accent ?? DEFAULT_CUSTOM }} />
              </span>
              <span className="text-[13px] font-bold text-[var(--desk-text)]">Custom</span>
            </button>
          )}
        </div>

        {customLocked && (
          <Link
            to={UPGRADE_PATH}
            className="flex items-center gap-2 h-[44px] pl-1.5 pr-3 rounded-[14px] border border-[var(--desk-border)] bg-[var(--desk-surface)] cursor-pointer"
            aria-label="Custom colour — part of the Starter plan"
          >
            <span
              aria-hidden
              className="h-[30px] w-[30px] rounded-[9px] border flex items-center justify-center bg-[var(--desk-surface-muted)]"
              style={{ borderColor: 'var(--desk-border)' }}
            >
              <span className="h-[14px] w-[14px] rounded-full" style={{ background: DEFAULT_CUSTOM }} />
            </span>
            <span className="text-[13px] font-bold text-[var(--desk-text)]">Custom</span>
            <span className="ml-1 rounded-full bg-[var(--desk-info-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--desk-info)]">
              Upgrade
            </span>
          </Link>
        )}
      </div>

      {showingCustom && !readOnly && (
        <div className="mt-3 rounded-[14px] border border-[var(--desk-border)] bg-[var(--desk-surface-muted)] p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-[var(--desk-text-muted)]">Brand colour</span>
              <input
                type="color"
                aria-label="Pick your brand colour"
                value={colourValue}
                onChange={(e) => setDraft(hexInput(e.target.value) ?? e.target.value)}
                className="h-[38px] w-[52px] cursor-pointer rounded-[10px] border border-[var(--desk-border)] bg-[var(--desk-surface)] p-0.5"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-[var(--desk-text-muted)]">Hex</span>
              <input
                type="text"
                aria-label="Brand colour hex"
                aria-invalid={!parsed}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parsed) commit();
                }}
                placeholder="#2A56A8"
                className="h-[38px] w-[130px] rounded-[10px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-3 font-mono text-[12.5px] font-semibold text-[var(--desk-text)] outline-none"
              />
            </label>
            <Button size="sm" onClick={commit} disabled={!parsed || parsed === saved}>
              Save colour
            </Button>
          </div>

          {!parsed && (
            <p role="alert" className="mt-2 text-[12px] font-semibold text-[var(--desk-danger)]">
              Enter a colour like #2A56A8, or a short one like #28A.
            </p>
          )}
          {parsed && tokens?.adjusted && (
            <p className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--desk-text-muted)]">
              <Chip colour={tokens.accent} />
              Adjusted to <span className="font-mono">{tokens.accent}</span> so text stays readable
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** A small structural sketch of each layout, in neutral greys. */
function LayoutThumb({ layout }: { layout: ProfileLayoutKey }) {
  const bar = (w: string, h = 5, bg = '#CBD5E1'): CSSProperties => ({ width: w, height: h, borderRadius: 999, background: bg });
  return (
    <span aria-hidden className="h-[64px] rounded-[10px] bg-[var(--desk-surface-muted)] overflow-hidden flex flex-col p-1.5 gap-1">
      {layout === 'classic' && (
        <span className="flex flex-col items-center gap-1 pt-1">
          <span className="h-[18px] w-[18px] rounded-full" style={{ background: '#94A3B8' }} />
          <span style={bar('50%', 5, '#64748B')} />
          <span style={bar('70%')} />
          <span style={bar('80%', 7, '#94A3B8')} />
        </span>
      )}
      {layout === 'editorial' && (
        <>
          <span className="h-[26px] -mx-1.5 -mt-1.5" style={{ background: '#CBD5E1' }} />
          <span style={bar('60%', 6, '#64748B')} />
          <span style={bar('85%', 4, '#94A3B8')} />
        </>
      )}
      {layout === 'compact' && (
        <>
          <span className="flex items-center gap-1"><span className="h-[14px] w-[14px] rounded-[4px]" style={{ background: '#94A3B8' }} /><span style={bar('45%', 5, '#64748B')} /></span>
          <span className="h-[10px] rounded-[4px] bg-[var(--desk-surface)]" />
          <span className="h-[10px] rounded-[4px] bg-[var(--desk-surface)]" />
          <span className="h-[10px] rounded-[4px] bg-[var(--desk-surface)]" />
        </>
      )}
      {layout === 'split' && (
        <span className="flex gap-1 h-full">
          <span className="flex-1 flex flex-col gap-1"><span style={bar('80%', 6, '#64748B')} /><span style={bar('100%')} /><span style={bar('90%')} /></span>
          <span className="w-[38%] rounded-[5px] bg-[var(--desk-surface)]" />
        </span>
      )}
    </span>
  );
}

/**
 * Token-based preview of the therapist's public profile in the chosen
 * layout and palette. Renders the profile hero/identity section using
 * the layout's structure and the palette's colour tokens.
 */
function ProfilePreview({
  layout,
  theme,
  name,
  kindLabel,
  headline,
}: {
  layout: ProfileLayoutKey;
  theme: ProfileTheme;
  name: string;
  kindLabel: string;
  headline: string | null;
}) {
  const c = theme.colors;
  const button = (text: string, round = false): ReactNode => (
    <span
      className="mt-1 flex h-[38px] items-center justify-center text-[12.5px] font-bold"
      style={{ background: c.accent, color: c.accentText, borderRadius: round ? 999 : 11 }}
    >
      {text}
    </span>
  );
  const line = headline || 'Your headline appears here.';

  return (
    <div className="mx-auto w-[240px] overflow-hidden rounded-[26px] border-[6px] border-[#0F172A]" style={{ background: c.background, color: c.text }}>
      <div className="h-[330px] overflow-hidden">
        {layout === 'classic' && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-5 text-center" style={{ background: c.surface }}>
            <span className="h-[64px] w-[64px] rounded-full" style={{ background: c.soft }} />
            <span className="text-[16px] font-extrabold tracking-[-0.03em]">{name}</span>
            <span className="text-[11px] font-semibold" style={{ color: c.accent }}>{kindLabel}</span>
            <span className="text-[11.5px] leading-snug">{line}</span>
            <span className="w-full">{button('Book a session')}</span>
          </div>
        )}
        {layout === 'editorial' && (
          <div className="flex flex-col">
            <span className="h-[120px]" style={{ background: c.soft }} />
            <div className="flex flex-col gap-1.5 px-4 py-3">
              <span className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: c.accent }}>{kindLabel}</span>
              <span className="text-[19px] font-extrabold leading-none tracking-[-0.04em]">{name}</span>
              <span className="font-serif text-[13px] italic leading-snug">“{line}”</span>
              {button('Book a session', true)}
            </div>
          </div>
        )}
        {layout === 'compact' && (
          <div className="flex flex-col gap-2 px-3 py-4">
            <span className="flex items-center gap-2">
              <span className="h-[42px] w-[42px] shrink-0 rounded-[12px]" style={{ background: c.soft }} />
              <span className="flex flex-col"><span className="text-[14px] font-extrabold">{name}</span><span className="text-[10.5px]" style={{ color: c.mutedText }}>{kindLabel}</span></span>
            </span>
            <span className="text-[11.5px] leading-snug">{line}</span>
            {button('Get in touch')}
            <span className="h-[34px] rounded-[10px] border" style={{ background: c.surface, borderColor: c.border }} />
            <span className="h-[34px] rounded-[10px] border" style={{ background: c.surface, borderColor: c.border }} />
          </div>
        )}
        {layout === 'split' && (
          <div className="flex flex-col gap-1.5 px-3 py-4">
            <span className="h-[110px] rounded-[14px]" style={{ background: c.soft }} />
            <span className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: c.accent }}>{kindLabel}</span>
            <span className="text-[18px] font-extrabold leading-none tracking-[-0.04em]">{name}</span>
            <span className="rounded-[12px] border p-2" style={{ background: c.surface, borderColor: c.border }}>
              <span className="block text-[11px] font-bold">Sessions and fees</span>
              {button('Book a session')}
            </span>
          </div>
        )}
      </div>
    </div>
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
  brandColor,
  name,
  kindLabel,
  headline,
  handle,
  onChange,
  customLocked = false,
}: {
  layoutKey: string;
  themeKey: string;
  brandColor?: string | null;
  name: string;
  kindLabel: string;
  headline: string | null;
  handle: string;
  onChange: (change: { layoutKey?: string; themeKey?: string; brandColor?: string | null }) => void;
  /** Below Starter: show Custom with an Upgrade tag and never call the API. */
  customLocked?: boolean;
}) {
  const layout = profileLayout(layoutKey);

  // The preview follows the colour being tried, before it is saved.
  const [preview, setPreview] = useState<{ themeKey: string; brandColor: string | null }>({
    themeKey,
    brandColor: brandColor ?? null,
  });
  useEffect(() => {
    setPreview({ themeKey, brandColor: brandColor ?? null });
  }, [themeKey, brandColor]);
  const onPreview = useCallback((key: string, colour: string | null) => {
    setPreview({ themeKey: key, brandColor: colour });
  }, []);

  const theme = profileTheme(preview.themeKey, preview.brandColor);
  const publicProfileUrl = handle ? profilePath(handle) : null;

  return (
    <Card padding="lg">
      <span className="text-[15px] font-bold text-[var(--desk-text)]">Appearance</span>
      <p className="mt-1 text-[12.5px] text-[var(--desk-text-muted)]">Pick a layout and a colour palette. Your words stay the same.</p>

      <span className="mt-4 block text-[9px] font-black tracking-[0.22em] uppercase text-[var(--desk-text-subtle)]" id="layout-label">Layout</span>
      <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="layout-label">
        {PROFILE_LAYOUTS.map((l) => (
          <button
            key={l.key}
            type="button"
            role="radio"
            aria-checked={layout.key === l.key}
            onClick={() => layout.key !== l.key && onChange({ layoutKey: l.key })}
            className={`flex flex-col gap-1.5 p-2 rounded-[14px] border bg-[var(--desk-surface)] cursor-pointer text-left ${
              layout.key === l.key ? 'border-[var(--desk-text)] ring-2 ring-[var(--desk-text)]/20' : 'border-[var(--desk-border)]'
            }`}
          >
            <LayoutThumb layout={l.key} />
            <span className="text-[13px] font-bold text-[var(--desk-text)]">{l.label}</span>
            <span className="text-[11.5px] leading-snug text-[var(--desk-text-muted)]">{l.description}</span>
          </button>
        ))}
      </div>

      <span className="mt-4 block text-[9px] font-black tracking-[0.22em] uppercase text-[var(--desk-text-subtle)]" id="palette-label">Colour palette</span>
      <div className="mt-2">
        <PaletteSwatches
          themeKey={themeKey}
          brandColor={brandColor}
          customLocked={customLocked}
          onPreview={onPreview}
          onPick={(change) => onChange(change)}
        />
      </div>

      <ScaledPreview
        width={1180}
        minHeight={400}
        showDeviceSwitch={true}
        showFullScreen={true}
        fullScreenLabel="View full profile"
        onFullScreen={publicProfileUrl ? () => window.open(publicProfileUrl, '_blank') : undefined}
      >
        <ProfilePreview
          layout={layout.key}
          theme={theme}
          name={name}
          kindLabel={kindLabel}
          headline={headline}
        />
      </ScaledPreview>
    </Card>
  );
}