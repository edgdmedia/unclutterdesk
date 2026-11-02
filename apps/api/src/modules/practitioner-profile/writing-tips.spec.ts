import { describe, expect, it } from 'vitest';
import { writingTips } from './writing-tips';

const kinds = (text: string) => writingTips({ about: text }).map((t) => t.kind);

describe('writing tips (§6.7)', () => {
  it.each([
    ['I have a 95% success rate', 'outcome-claim'],
    ['80% of clients feel better in 6 weeks', 'outcome-claim'],
    ['Results guaranteed', 'outcome-claim'],
    ['I can cure your anxiety', 'outcome-claim'],
    ['The best therapist in Lagos', 'superlative'],
    ['No. 1 counsellor', 'superlative'],
    ['A client named Tunde came to me', 'client-detail'],
    ['Mrs Adeyemi came to me after her loss', 'client-detail'],
    ['Call me on 0803 123 4567', 'phone-number'],
    ['WhatsApp +234 803 123 4567', 'phone-number'],
  ])('flags %j as %s', (text, kind) => {
    expect(kinds(text)).toContain(kind);
  });

  it.each([
    'I use CBT and person-centred approaches.',
    'I have worked with adults for 6 years.',
    'I trained at the University of Lagos in 2015.',
    'Sessions are 50 minutes.',
    'I work best with clients who want practical tools.',
  ])('leaves ordinary text alone: %j', (text) => {
    expect(kinds(text)).toEqual([]);
  });

  it('marks client details as a strong warning', () => {
    expect(writingTips({ about: 'A client named Tunde came' })[0]).toMatchObject({ severity: 'strong', field: 'about' });
  });

  it('reports a repeated phrase once per field', () => {
    expect(writingTips({ about: 'guaranteed. Guaranteed!' })).toHaveLength(1);
  });
});
