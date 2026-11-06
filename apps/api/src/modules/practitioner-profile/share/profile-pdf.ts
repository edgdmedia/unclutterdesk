import type PDFKit from 'pdfkit';
import { lazyModule } from '../../../common/lazy-module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { themePalette } from '../themes';

/** Therapysts design system faces, embedded: Fraunces for the name, Figtree for the rest. */
const FONT_FILES = {
  name: ['@fontsource/fraunces', 'fraunces-latin-600-normal.woff'],
  bold: ['@fontsource/figtree', 'figtree-latin-700-normal.woff'],
  text: ['@fontsource/figtree', 'figtree-latin-400-normal.woff'],
} as const;
let fontData: Record<keyof typeof FONT_FILES, Buffer> | null = null;
function fonts() {
  if (fontData) return fontData;
  const read = ([pkg, file]: readonly [string, string]) => readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file));
  fontData = { name: read(FONT_FILES.name), bold: read(FONT_FILES.bold), text: read(FONT_FILES.text) };
  return fontData;
}

// pdfkit is CommonJS (module.exports = PDFDocument); lazyModule resolves the
// constructor either way. Loaded on first use, not at startup.
const loadPdfKit = lazyModule<typeof PDFKit>(() => import('pdfkit'));

/** Everything the one-page profile sheet needs (§6.10). Text is plain; values are escaped by the PDF layer. */
export interface ProfilePdfInput {
  name: string;
  kindLabel: string;
  headline?: string | null;
  place?: string | null;
  qualifications?: string | null;
  /** The chosen primary specialties, shown first. */
  primarySpecialties: string[];
  /** Every specialty, primary ones included. */
  specialties: string[];
  languages: string[];
  url: string;
  qrPng: Buffer;
  photo?: Buffer | null;
  themeKey: string;
  /** Custom colour (themeKey 'custom'). */
  brandColor?: string | null;
}

const MM = 72 / 25.4;
const QR_SIZE = 35 * MM;

/** First letters of the first two words: "Ada Obi" → "AO". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '');
}

/** Trim `text` so it fits `maxHeight` at `width`, ending in an ellipsis when it was cut. */
function fitText(doc: PDFKit.PDFDocument, text: string, width: number, maxHeight: number): string {
  if (doc.heightOfString(text, { width }) <= maxHeight) return text;
  let cut = text;
  while (cut.length > 0 && doc.heightOfString(`${cut}…`, { width }) > maxHeight) {
    cut = cut.slice(0, Math.max(0, cut.length - 24));
  }
  return `${cut.trimEnd()}…`;
}

/**
 * A printable one-page profile sheet: themed header, name and headline, the
 * qualifications and specialties a client needs, and a QR code with the
 * profile's address. The Therapysts faces (embedded from the font packages, no downloads) and plain text only.
 */
export async function renderProfilePdf(input: ProfilePdfInput): Promise<Buffer> {
  const theme = themePalette(input.themeKey, input.brandColor);
  const PDFDocument = await loadPdfKit();
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${input.name} — profile` } });
  const f = fonts();
  doc.registerFont('Name', f.name);
  doc.registerFont('Bold', f.bold);
  doc.registerFont('Text', f.text);
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 48;
  const headerHeight = 160;

  // Header band in the theme's accent colour.
  doc.rect(0, 0, pageWidth, headerHeight).fill(theme.accent);

  // Round photo, or initials where there is none (or the bytes will not draw).
  const photoR = 34;
  const photoCx = margin + photoR;
  const photoCy = 48 + photoR;
  let drewPhoto = false;
  if (input.photo?.length) {
    try {
      doc.save();
      doc.circle(photoCx, photoCy, photoR).clip();
      doc.image(input.photo, photoCx - photoR, photoCy - photoR, { cover: [photoR * 2, photoR * 2] });
      doc.restore();
      drewPhoto = true;
    } catch {
      doc.restore();
    }
  }
  if (!drewPhoto) {
    doc.save();
    doc.circle(photoCx, photoCy, photoR).fill(theme.accentText);
    doc.fillColor(theme.accent).font('Bold').fontSize(24);
    const initials = initialsOf(input.name);
    const tw = doc.widthOfString(initials);
    doc.text(initials, photoCx - tw / 2, photoCy - 12, { lineBreak: false });
    doc.restore();
  }
  doc.circle(photoCx, photoCy, photoR).lineWidth(2).stroke(theme.accentText);

  // Name, kind, headline and place.
  const textX = margin + photoR * 2 + 20;
  const textWidth = pageWidth - textX - margin;
  doc.fillColor(theme.accentText).font('Name').fontSize(24);
  doc.text(fitText(doc, input.name, textWidth, 30), textX, 50, { width: textWidth, lineBreak: false });
  doc.font('Text').fontSize(11).fillColor(theme.accentText);
  doc.text(input.kindLabel, textX, 80, { width: textWidth, lineBreak: false });
  if (input.headline) {
    doc.fontSize(11.5);
    const headline = fitText(doc, input.headline, textWidth, 30);
    doc.text(headline, textX, 98, { width: textWidth, height: 30, ellipsis: true });
  }
  if (input.place) {
    doc.fontSize(9.5);
    doc.text(input.place, textX, 132, { width: textWidth, lineBreak: false });
  }

  // Two columns: the profile text on the left, the QR on the right.
  const bodyTop = headerHeight + 24;
  const qrX = pageWidth - margin - QR_SIZE;
  const qrY = bodyTop;
  const leftWidth = qrX - margin - 24;
  let y = bodyTop;

  const section = (title: string, body: string, maxHeight = 320) => {
    if (!body.trim()) return;
    doc.font('Bold').fontSize(10).fillColor(theme.accent);
    doc.text(title.toUpperCase(), margin, y, { width: leftWidth, characterSpacing: 0.6 });
    y = doc.y + 4;
    doc.font('Text').fontSize(10).fillColor(theme.text);
    const text = fitText(doc, body, leftWidth, maxHeight);
    doc.text(text, margin, y, { width: leftWidth, lineGap: 1.5 });
    y = doc.y + 18;
  };

  section('Qualifications', input.qualifications ?? '');

  const primary = input.primarySpecialties.filter(Boolean);
  const others = input.specialties.filter((s) => !primary.includes(s));
  const specialtyText = [primary.join(' · '), others.join(' · ')].filter(Boolean).join(' · ');
  section('Specialties', specialtyText);

  section('Languages', input.languages.filter(Boolean).join(' · '));
  void pageHeight;

  // QR code (35 mm) with the profile address under it.
  doc.image(input.qrPng, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });
  doc.font('Text').fontSize(7).fillColor(theme.mutedText);
  doc.text(input.url, qrX, qrY + QR_SIZE + 6, { width: QR_SIZE, align: 'center' });

  // A hairline rule at the foot, in the theme's border colour.
  doc
    .moveTo(margin, pageHeight - margin - 16)
    .lineTo(pageWidth - margin, pageHeight - margin - 16)
    .lineWidth(0.5)
    .stroke(theme.border);

  doc.end();
  return done;
}