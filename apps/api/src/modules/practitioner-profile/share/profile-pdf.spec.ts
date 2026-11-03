import { describe, expect, it, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { renderProfilePdf, type ProfilePdfInput } from './profile-pdf';
import { PractitionerProfileService } from '../practitioner-profile.service';
import { EntitlementsService } from '../../entitlements/entitlements.service';

const QR = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Extract the text and page count from a rendered PDF. */
async function parse(pdf: Buffer): Promise<{ text: string; numpages: number }> {
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getText();
    return { text: result.text, numpages: result.total };
  } finally {
    await parser.destroy();
  }
}

function input(overrides: Partial<ProfilePdfInput> = {}): ProfilePdfInput {
  return {
    name: 'Ada Obi',
    kindLabel: 'Counsellor',
    headline: 'Warm, practical counselling for anxious adults',
    place: 'Lagos, Nigeria',
    qualifications: 'MSc Counselling Psychology, University of Ibadan',
    primarySpecialties: ['Anxiety', 'Depression'],
    specialties: ['Anxiety', 'Depression', 'Trauma'],
    languages: ['English', 'Igbo'],
    url: 'https://therapysts.example/ada-obi',
    qrPng: QR,
    photo: null,
    themeKey: 'calm',
    ...overrides,
  };
}

describe('renderProfilePdf', () => {
  it('renders a one-page A4 PDF', async () => {
    const pdf = await renderProfilePdf(input());
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await parse(pdf)).numpages).toBe(1);
  });

  it('carries the name, the profile URL and the specialties', async () => {
    const { text } = await parse(await renderProfilePdf(input()));
    expect(text).toContain('Ada Obi');
    // The QR caption may wrap to the 35 mm column; the address itself is intact.
    expect(text.replace(/\s+/g, '')).toContain('https://therapysts.example/ada-obi');
    expect(text).toContain('Trauma');
  });

  it('draws initials instead of the photo when there is none', async () => {
    const { text, numpages } = await parse(await renderProfilePdf(input({ photo: null })));
    expect(text).toContain('AO');
    expect(numpages).toBe(1);
  });

  it('cuts a 3,000-character qualifications text to fit one page, with an ellipsis', async () => {
    const long = 'Training and supervision. '.repeat(120).slice(0, 3000);
    const { text, numpages } = await parse(await renderProfilePdf(input({ qualifications: long })));
    expect(numpages).toBe(1);
    expect(text).toContain('…');
    expect(text).not.toContain(long);
  });

  it('keeps its colours in step with the shared theme tokens', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const ui = readFileSync(resolve(__dirname, '../../../../../../packages/ui/src/brand/profileThemes.ts'), 'utf8');
    const { THEME_PALETTES } = await import('../themes');
    for (const [key, palette] of Object.entries(THEME_PALETTES)) {
      // The UI theme object for this key must carry the same six colours.
      const block = ui.split(`key: '${key}'`)[1]?.split('},')[0] ?? '';
      for (const colour of [palette.accent, palette.accentText, palette.background, palette.text, palette.mutedText, palette.border]) {
        expect(block.toUpperCase(), `${key} is missing ${colour}`).toContain(colour.toUpperCase());
      }
    }
  });
});

describe('the PDF endpoint', () => {
  const ME = 7n;

  const profileRow = {
    id: 1n,
    handle: 'ada-obi',
    displayName: 'Ada Obi',
    kind: 'COUNSELLOR',
    themeKey: 'calm',
    headline: 'Warm, practical counselling',
    credentialsText: 'MSc Counselling Psychology',
    city: 'Lagos',
    countryCode: 'NG',
    photoKey: null as string | null,
    taxonomy: [
      { isPrimary: true, term: { kind: 'SPECIALTY', label: 'Anxiety', sortOrder: 1 } },
      { isPrimary: false, term: { kind: 'SPECIALTY', label: 'Trauma', sortOrder: 2 } },
      { isPrimary: false, term: { kind: 'LANGUAGE', label: 'English', sortOrder: 1 } },
    ],
  };

  function make(plan: Record<string, unknown>[]) {
    const findUnique = vi.fn(async () => profileRow);
    const prisma: any = {
      // EntitlementsService reads a person's qualifying practices here.
      profile: { findMany: async () => plan },
      practitionerProfile: { findUnique },
    };
    const entitlements = new EntitlementsService(prisma);
    const jobs: any = { enqueue: async () => ({ id: 1n }), runNow: async () => undefined };
    const storage: any = { configured: () => true, get: async () => null };
    return { service: new PractitionerProfileService(prisma, jobs, storage, entitlements), findUnique };
  }

  const paying = { tenant: { subscriptionTier: 'STARTER', subscriptionStatus: 'active', complimentaryUntil: null, complimentaryReason: null } };

  it('refuses a Free user with 402 before doing any PDF work', async () => {
    const { service, findUnique } = make([]);
    let status: number | undefined;
    let feature: string | undefined;
    try {
      await service.renderOwnProfilePdf(ME);
    } catch (err: any) {
      status = err.getStatus?.();
      feature = err.feature;
    }
    expect(status).toBe(402);
    expect(feature).toBe('downloadablePdf');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('gives a paid user their own PDF, named after their handle', async () => {
    const { service } = make([paying]);
    const { pdf, filename } = await service.renderOwnProfilePdf(ME);
    expect(filename).toBe('ada-obi-profile.pdf');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const { text } = await parse(pdf);
    expect(text).toContain('Ada Obi');
    expect(text.replace(/\s+/g, '')).toContain('https://therapysts.com/ada-obi');
  });
});