import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMS, ensureDefaultForms } from './default-forms';

function db(existing: Array<{ systemKey: string | null; targetType: string }>) {
  return {
    universalForm: {
      findMany: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('default forms', () => {
  it('gives a new practice PHQ-9, GAD-7 and a review form', async () => {
    const d = db([]);
    expect(await ensureDefaultForms(d, 4n)).toBe(3);
    const titles = d.universalForm.create.mock.calls.map((c: any) => c[0].data.title);
    expect(titles).toEqual(['PHQ-9', 'GAD-7', 'Leave a Review']);
    expect(d.universalForm.create.mock.calls.every((c: any) => c[0].data.tenantId === 4n)).toBe(true);
  });

  it('leaves forms a practice already has, including edited ones', async () => {
    const d = db([{ systemKey: 'PHQ_9', targetType: 'ASSESSMENT' }, { systemKey: null, targetType: 'REVIEW' }]);
    expect(await ensureDefaultForms(d, 4n)).toBe(1);
    expect(d.universalForm.create.mock.calls[0][0].data.systemKey).toBe('GAD_7');
  });

  // IntakeService scores by these ids; renaming one silently breaks scoring.
  it('keeps the question ids the scorer reads', () => {
    const ids = (key: string) => DEFAULT_FORMS.find((f) => f.systemKey === key)!.schemaJson.map((q) => q.id);
    expect(ids('PHQ_9')).toEqual(Array.from({ length: 9 }, (_, i) => `phq9_${i + 1}`));
    expect(ids('GAD_7')).toEqual(Array.from({ length: 7 }, (_, i) => `gad7_${i + 1}`));
  });

  // The backfill migration was generated from these definitions.
  it('matches the backfill migration', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../../prisma/migrations/20260924170000_default_forms/migration.sql'),
      'utf8',
    );
    for (const form of DEFAULT_FORMS) {
      for (const q of form.schemaJson) expect(sql).toContain(JSON.stringify(q.label).slice(1, -1).replace(/'/g, "''"));
    }
  });
});
