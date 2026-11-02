import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABOUT_MIN_TO_PUBLISH, SECTION_ORDER } from './completeness';
import { writingTips } from './writing-tips';

/*
 * The seed templates (prisma/data/profile-templates.json, inserted by the
 * 20261103090000_profile_templates migration) are content, but they are held
 * to the same rules as what therapists write.
 */
const PRISMA = resolve(__dirname, '../../../../../prisma');
const seed = JSON.parse(readFileSync(resolve(PRISMA, 'data/profile-templates.json'), 'utf8'));
const migrations = readdirSync(resolve(PRISMA, 'migrations'));
const taxonomySql = readFileSync(resolve(PRISMA, 'migrations', migrations.find((m) => m.endsWith('_practitioner_profiles'))!, 'migration.sql'), 'utf8');
const templatesSql = readFileSync(resolve(PRISMA, 'migrations', migrations.find((m) => m.endsWith('_profile_templates'))!, 'migration.sql'), 'utf8');

const taxonomy = new Set([...taxonomySql.matchAll(/\('(SPECIALTY|MODALITY|POPULATION|LANGUAGE)', '([a-z0-9-]+)'/g)].map((m) => `${m[1]}:${m[2]}`));

describe('seed templates (§6.6)', () => {
  it('include the seven the spec lists', () => {
    expect(seed.templates.map((t: any) => t.title)).toEqual([
      'Counsellor in private practice',
      'Trainee counsellor under supervision',
      'Clinical psychologist',
      'Faith-integrated counsellor',
      'Child & adolescent specialist',
      'Couples & family therapist',
      'Workplace / corporate wellbeing practitioner',
    ]);
  });

  it('give guidance for every section', () => {
    expect(Object.keys(seed.guidance).sort()).toEqual([...SECTION_ORDER].sort());
  });

  it('only use sections the profile has', () => {
    for (const t of seed.templates) for (const key of Object.keys(t.sections)) expect(SECTION_ORDER).toContain(key);
  });

  it('suggest only taxonomy terms that exist', () => {
    const missing = seed.templates.flatMap((t: any) =>
      Object.entries(t.suggested as Record<string, string[]>).flatMap(([kind, keys]) =>
        keys.filter((k) => !taxonomy.has(`${kind}:${k}`)).map((k) => `${t.key}: ${kind}:${k}`),
      ),
    );
    expect(missing).toEqual([]);
  });

  it('have about examples long enough to publish', () => {
    for (const t of seed.templates) {
      const about = t.sections.about?.example;
      if (about) expect(about.length, t.key).toBeGreaterThanOrEqual(ABOUT_MIN_TO_PUBLISH);
    }
  });

  it('have headline examples within the 120-character limit', () => {
    for (const t of seed.templates) expect((t.sections.identity?.example ?? '').length, t.key).toBeLessThanOrEqual(120);
  });

  it('model good writing: no example triggers a writing tip', () => {
    const tips = seed.templates.flatMap((t: any) =>
      Object.entries(t.sections as Record<string, { example?: string }>).flatMap(([section, s]) =>
        writingTips({ [`${t.key}.${section}`]: s.example }),
      ),
    );
    expect(tips).toEqual([]);
  });

  it('are all in the migration, which never overwrites admin edits', () => {
    for (const t of seed.templates) expect(templatesSql).toContain(`('${t.key}',`);
    expect(templatesSql).toContain(`('general',`);
    expect(templatesSql).toMatch(/ON CONFLICT \("key"\) DO NOTHING;/);
  });
});
