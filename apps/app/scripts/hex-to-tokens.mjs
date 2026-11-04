#!/usr/bin/env node
/*
 * Dashboard colour sweep (docs/superpowers/plans/2026-11-04-dashboard-tokens.md, 3b).
 *
 * Rewrites Tailwind arbitrary colours such as `text-[#0F172A]` in apps/app/src
 * and packages/ui/src/components
 * to the shared tokens (`text-[var(--desk-text)]`). The token depends on the
 * property: #0F172A is ink as text but the sidebar as a background. Opacity
 * modifiers (`/30`) and variants (`hover:`) are kept.
 *
 *   node apps/app/scripts/hex-to-tokens.mjs           rewrite files, print a summary
 *   node apps/app/scripts/hex-to-tokens.mjs --check   change nothing; exit 1 if anything is left to map
 *
 * Values the table doesn't cover are printed for a decision, never guessed.
 * Re-run it after merging dev into a branch that still has raw colours.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The dashboard's code and the shared components it renders. */
const ROOTS = [join(HERE, '../src'), join(HERE, '../../../packages/ui/src/components')];
const REPO = join(HERE, '../../..');

/** Which family a utility prefix belongs to. */
function roleOf(prefix) {
  const head = prefix.split('-')[0];
  if (['text', 'placeholder', 'decoration', 'caret'].includes(head)) return 'text';
  if (['bg', 'from', 'to', 'via'].includes(head)) return 'bg';
  if (['border', 'divide', 'ring', 'outline'].includes(head)) return 'border';
  if (['fill', 'stroke'].includes(head)) return 'glyph';
  if (head === 'accent') return 'accent';
  return null;
}

const t = (name) => `var(--${name})`;

/** hex → { role → token }. `*` applies to every role not listed. */
export const MAP = {
  // ── Ink neutrals (old slate) ──
  '#0F172A': { text: t('desk-text'), bg: t('desk-sidebar'), border: t('desk-text'), glyph: t('desk-text') },
  '#0B1220': { '*': t('desk-sidebar') },
  '#1E293B': { '*': t('desk-sidebar-hover') },
  '#334155': { text: t('desk-text-body'), bg: t('desk-sidebar-hover'), border: t('desk-sidebar-hover') },
  '#475569': { '*': t('desk-text-body') },
  '#64748B': { text: t('desk-text-muted'), glyph: t('desk-text-muted'), bg: t('desk-text-muted'), border: t('desk-border-strong') },
  '#94A3B8': { text: t('desk-text-subtle'), glyph: t('desk-text-subtle'), bg: t('desk-text-subtle'), border: t('desk-border-strong') },
  // Light greys as text sit on the dark sidebar or auth panel: keep them light.
  '#CBD5E1': { text: t('desk-pine-200'), '*': t('desk-pine-200') },
  '#E2E8F0': { text: t('desk-pine-200'), bg: t('desk-border'), border: t('desk-border'), glyph: t('desk-border') },
  '#F1F5F9': { bg: t('desk-surface-muted'), border: t('desk-border-soft'), text: t('ds-on-band') },
  '#F8FAFC': { bg: t('desk-surface'), text: t('ds-on-band'), border: t('desk-border-soft') },
  '#FCFDFE': { '*': t('desk-surface-alt') },
  '#EEF2F7': { '*': t('desk-surface-muted') },
  '#EFF3F7': { '*': t('desk-surface-muted') },

  // ── Brand: old navy, pine and gold ──
  '#0F3A53': { '*': t('desk-pine-600') },
  '#0C2E42': { '*': t('desk-pine-700') },
  '#1B5375': { '*': t('desk-pine-500') },
  '#EFF6FB': { '*': t('desk-pine-100') },
  '#24614F': { '*': t('desk-pine-600') },
  '#1C4E3F': { '*': t('desk-pine-700') },
  // Gold lived on dark panels (auth, admin, video controls): the design's sky.
  // On light ground it marked a warning, and star ratings were gold.
  '#E3B341': { text: t('ds-sky'), bg: t('ds-sky'), border: t('desk-pending-border'), glyph: t('desk-pending-dot'), accent: t('ds-sky') },

  // ── Status: success ──
  '#059669': { '*': t('desk-active') },
  '#047857': { '*': t('desk-active') },
  '#15803D': { '*': t('desk-active') },
  '#16A34A': { '*': t('desk-active') },
  '#10B981': { '*': t('desk-active-dot') },
  '#22C55E': { '*': t('desk-active-dot') },
  '#ECFDF5': { '*': t('desk-active-bg') },
  '#F0FDF4': { '*': t('desk-active-bg') },
  '#DCFCE7': { '*': t('desk-active-bg') },
  '#A7F3D0': { '*': t('desk-active-border') },
  '#BBF7D0': { '*': t('desk-active-border') },

  // ── Status: pending / warning ──
  '#92400E': { '*': t('desk-pending') },
  '#B45309': { '*': t('desk-pending') },
  '#C2410C': { '*': t('desk-pending') },
  '#D97706': { '*': t('desk-pending-dot') },
  '#F59E0B': { '*': t('desk-pending-dot') },
  '#FFFBEB': { '*': t('desk-pending-bg') },
  '#FEF3C7': { '*': t('desk-pending-bg') },
  '#FFF7ED': { '*': t('desk-pending-bg') },
  '#FDE68A': { '*': t('desk-pending-border') },
  '#FED7AA': { '*': t('desk-pending-border') },

  // ── Status: danger ──
  '#B91C1C': { '*': t('desk-danger') },
  '#B42318': { '*': t('desk-danger') },
  '#E11D48': { '*': t('desk-danger') },
  '#DC2626': { '*': t('desk-danger') },
  '#FEF2F2': { '*': t('desk-danger-bg') },
  '#FFF1F2': { '*': t('desk-danger-bg') },
  '#FEF3F2': { '*': t('desk-danger-bg') },
  '#FECACA': { '*': t('desk-danger-border') },
  '#FECDD3': { '*': t('desk-danger-border') },

  // ── Second pass: shades that belong to the families above ──
  '#101A28': { '*': t('desk-sidebar') },
  '#172130': { '*': t('desk-sidebar-hover') },
  '#0B2C40': { '*': t('desk-pine-800') },
  '#143A2F': { '*': t('desk-pine-800') },
  '#F0F7F4': { '*': t('desk-pine-050') },
  '#DDEDE6': { '*': t('desk-pine-100') },
  '#B6D8CC': { '*': t('desk-pine-200') },
  '#7DB8A5': { '*': t('desk-pine-300') },
  '#F0F7FB': { '*': t('desk-surface-alt') },
  '#F0F7FC': { '*': t('desk-surface-alt') },
  '#F8FBFF': { '*': t('desk-surface-alt') },
  '#F6F8FA': { '*': t('desk-surface') },
  // Cream grounds: the design system's light pages are never cream.
  '#FAF9F5': { '*': t('desk-surface') },
  '#FCF7EF': { '*': t('desk-surface') },
  '#EFF6FF': { '*': t('desk-info-bg') },
  '#BFDBFE': { '*': t('desk-info-border') },
  '#1D4ED8': { '*': t('desk-info') },
  '#166534': { '*': t('desk-active') },
  '#067647': { '*': t('desk-active') },
  '#34D399': { '*': t('desk-active-dot') },
  '#D1FAE5': { '*': t('desk-active-bg') },
  '#78350F': { '*': t('desk-pending') },
  '#8A6512': { '*': t('desk-pending') },
  '#5C3D0E': { '*': t('desk-pending') },
  '#9A3412': { '*': t('desk-pending') },
  '#8A5A00': { '*': t('desk-pending') },
  '#F0C558': { '*': t('desk-pending-dot') },
  '#FFFBEA': { '*': t('desk-pending-bg') },
  '#FFF8EB': { '*': t('desk-pending-bg') },
  '#FFF7E6': { '*': t('desk-pending-bg') },
  '#F5DDB0': { '*': t('desk-pending-border') },
  '#BE123C': { '*': t('desk-danger') },
  '#FFE4E6': { '*': t('desk-danger-bg') },

  // ── White stays white, as a named utility ──
  '#FFFFFF': { '*': 'white' },
  '#FFF': { '*': 'white' },
};

/** Third-party brand colours that must stay exact (WhatsApp's share button). */
export const KEEP = new Set(['#25D366', '#0B2E13']);

/** `hover:bg-[#0F3A53]/10` → prefix `bg`, hex `#0F3A53`. */
const CLASS = /(?<![\w-])((?:[a-z0-9-]+:)*)([a-z]+(?:-[a-z]+)*)-\[(#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?)\]/g;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

const check = process.argv.includes('--check');
const left = new Map();
let changed = 0;
let replaced = 0;
for (const file of ROOTS.flatMap(files)) {
  const text = readFileSync(file, 'utf8');
  const out = text.replace(CLASS, (whole, variants, prefix, rawHex) => {
    const hex = rawHex.toUpperCase();
    if (KEEP.has(hex)) return whole;
    const role = roleOf(prefix);
    const entry = MAP[hex];
    const token = entry && role ? (entry[role] ?? entry['*']) : undefined;
    if (!token) {
      const key = `${prefix}-[${hex}]`;
      left.set(key, [...(left.get(key) ?? []), relative(REPO, file)]);
      return whole;
    }
    replaced++;
    return token === 'white' ? `${variants}${prefix}-white` : `${variants}${prefix}-[${token}]`;
  });
  if (out !== text) {
    changed++;
    if (!check) writeFileSync(file, out);
  }
}

if (check) {
  console.log(`${replaced} raw colour classes would be replaced in ${changed} files; ${left.size} not in the table.`);
} else {
  console.log(`Replaced ${replaced} raw colour classes in ${changed} files.`);
}
for (const [key, where] of [...left].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  not mapped: ${key} ×${where.length}  (${[...new Set(where)].slice(0, 3).join(', ')})`);
}
process.exit(check && (replaced > 0 || left.size > 0) ? 1 : 0);
