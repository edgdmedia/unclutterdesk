import { describe, expect, it } from 'vitest';
import { BUILTIN_INSTRUMENTS, DASS_21, GAD_7, PCL_5, PHQ_9 } from './builtin-instruments';
import { publicDefinition, score, tierIncludes, validateAnswers, validateDefinition, type InstrumentDefinition } from './engine';

/** Answers every item with `value`, then applies any overrides. */
function answers(def: InstrumentDefinition, value: number, overrides: Record<string, number> = {}) {
  return { ...Object.fromEntries(def.items.map((i) => [i.id, value])), ...overrides };
}

/** Spreads `total` across items, filling each up to the scale's maximum. */
function totalling(def: InstrumentDefinition, total: number) {
  const top = Math.max(...def.scale.map((s) => s.value));
  const a = answers(def, 0);
  let left = total;
  for (const key of Object.keys(a)) {
    a[key] = Math.min(top, left);
    left -= a[key];
  }
  return a;
}

describe('the built-in library', () => {
  it('has PHQ-9, GAD-7, PCL-5 and DASS-21', () => {
    expect(BUILTIN_INSTRUMENTS.map((i) => i.key)).toEqual(['PHQ_9', 'GAD_7', 'PCL_5', 'DASS_21']);
  });

  it.each(BUILTIN_INSTRUMENTS.map((d) => [d.key, d]))('%s is a valid definition', (_key, def) => {
    expect(validateDefinition(def)).toEqual([]);
  });

  it.each([[PHQ_9, 9, 4], [GAD_7, 7, 4], [PCL_5, 20, 5], [DASS_21, 21, 4]] as const)('%s has its published length', (def, count, points) => {
    expect(def.items).toHaveLength(count);
    expect(def.scale).toHaveLength(points);
  });

  it('puts the common screeners on every plan and the longer ones on Pro', () => {
    expect(BUILTIN_INSTRUMENTS.map((d) => [d.key, d.tier])).toEqual([
      ['PHQ_9', 'STARTER'], ['GAD_7', 'STARTER'], ['PCL_5', 'PRO'], ['DASS_21', 'PRO'],
    ]);
  });

  it('never sends scoring or rules to the browser', () => {
    const shown = publicDefinition(PHQ_9);
    expect(shown).not.toHaveProperty('scoring');
    expect(shown).not.toHaveProperty('rules');
  });
});

describe('PHQ-9', () => {
  it.each([[4, 'Minimal'], [5, 'Mild'], [10, 'Moderate'], [15, 'Moderately severe'], [20, 'Severe']])('%i is %s', (total, label) => {
    // Spread over items 1–8 so item 9's rule stays out of it.
    const r = score(PHQ_9, { ...totalling({ ...PHQ_9, items: PHQ_9.items.slice(0, 8) }, total), phq9_9: 0 });
    expect(r.totalScore).toBe(total);
    expect(r.severity.label).toBe(label);
  });

  it('scores 27 as Severe', () => {
    const r = score(PHQ_9, answers(PHQ_9, 3));
    expect([r.totalScore, r.maxScore, r.severity.label]).toEqual([27, 27, 'Severe']);
  });

  // Any answer above zero on item 9 must reach the clinician, whatever the total.
  it('flags item 9 as urgent even when the total is minimal', () => {
    const r = score(PHQ_9, answers(PHQ_9, 0, { phq9_9: 1 }));
    expect(r.severity.label).toBe('Minimal');
    expect(r.flags.map((f) => [f.key, f.level])).toEqual([['self_harm', 'urgent']]);
  });

  it('gives the clinician guidance and the client plain wording', () => {
    const r = score(PHQ_9, answers(PHQ_9, 0, { phq9_1: 3, phq9_2: 3, phq9_3: 3, phq9_4: 3, phq9_5: 3 }));
    expect(r.clinicianText).toMatch(/Active treatment/);
    expect(r.client.summary).toMatch(/Your practitioner/);
    expect(JSON.stringify(r.client)).not.toMatch(/Moderately severe/);
    // PHQ-9 shows the client wording only, not the number.
    expect(r.client.score).toBeUndefined();
  });

  it('tells the client where to get help when item 9 fires', () => {
    const r = score(PHQ_9, answers(PHQ_9, 0, { phq9_9: 2 }));
    expect(r.client.messages.join(' ')).toMatch(/112/);
  });
});

describe('GAD-7', () => {
  it.each([[4, 'Minimal'], [5, 'Mild'], [10, 'Moderate'], [15, 'Severe']])('%i is %s', (total, label) => {
    expect(score(GAD_7, totalling(GAD_7, total)).severity.label).toBe(label);
  });
});

describe('PCL-5', () => {
  it('uses 33 as the probable PTSD cut-off', () => {
    const at = (total: number) => score(PCL_5, totalling(PCL_5, total)).severity.label;
    expect(at(30)).toBe('Below the cut-off');
    expect(at(32)).toBe('Near the cut-off');
    expect(at(33)).toMatch(/Probable PTSD/);
  });

  it('reports the four DSM-5 clusters', () => {
    const r = score(PCL_5, answers(PCL_5, 1));
    expect(r.subscales.map((s) => [s.key, s.score, s.max])).toEqual([
      ['intrusion', 5, 20], ['avoidance', 2, 8], ['cognition_mood', 7, 28], ['arousal', 6, 24],
    ]);
    expect([r.totalScore, r.maxScore]).toEqual([20, 80]);
  });
});

describe('DASS-21', () => {
  it('doubles each subscale', () => {
    const r = score(DASS_21, answers(DASS_21, 1));
    expect(r.subscales.map((s) => [s.score, s.max])).toEqual([[14, 42], [14, 42], [14, 42]]);
  });

  it('bands each subscale on its own cut-offs and leads with the worst', () => {
    const depression = Object.fromEntries([3, 5, 10, 13, 16, 17, 21].map((n) => [`dass21_${n}`, 2]));
    const r = score(DASS_21, answers(DASS_21, 0, depression));
    expect(Object.fromEntries(r.subscales.map((s) => [s.key, s.severity?.label]))).toEqual({
      depression: 'Extremely severe', anxiety: 'Normal', stress: 'Normal',
    });
    expect(r.severity.label).toBe('Extremely severe depression');
    expect(r.client.summary).toBe('Low mood seems to be affecting you a great deal.');
  });

  it('is normal when every answer is zero', () => {
    const r = score(DASS_21, answers(DASS_21, 0));
    expect(r.severity.label).toBe('Normal on all scales');
    expect(r.client.summary).toMatch(/usual range/);
  });
});

describe('rules come from the definition', () => {
  // The point of rule-based instruments: a new rule needs no code.
  it('applies a rule on a subscale that an admin added', () => {
    const def: InstrumentDefinition = {
      ...GAD_7,
      scoring: { ...GAD_7.scoring, subscales: [{ key: 'worry', label: 'Worry', items: ['gad7_2', 'gad7_3'] }] },
      rules: [{ key: 'worry_high', when: { subscale: 'worry', op: '>=', value: 5 }, level: 'attention', clinicianMessage: 'High worry.' }],
    };
    expect(validateDefinition(def)).toEqual([]);
    expect(score(def, answers(def, 0, { gad7_2: 3, gad7_3: 2 })).flags.map((f) => f.key)).toEqual(['worry_high']);
    expect(score(def, answers(def, 0, { gad7_2: 3, gad7_3: 1 })).flags).toEqual([]);
  });

  it('shows the client nothing when the instrument says so', () => {
    const r = score({ ...GAD_7, clientResults: 'none' }, answers(GAD_7, 3));
    expect(r.client).toEqual({ show: 'none', messages: [] });
  });

  it('shows the score too when the instrument allows it', () => {
    const r = score({ ...GAD_7, clientResults: 'score_and_summary' }, answers(GAD_7, 1));
    expect([r.client.score, r.client.maxScore]).toEqual([7, 21]);
  });
});

describe('checking a definition', () => {
  it('names each problem', () => {
    const broken = {
      ...GAD_7,
      key: 'bad key',
      tier: 'GOLD',
      scoring: { ...GAD_7.scoring, bands: [{ min: 5, label: 'A', level: 0 }, { min: 1, label: 'B', level: 9 }] },
      rules: [{ key: 'r', when: { item: 'nope', op: '~', value: 1 }, level: 'urgent', clinicianMessage: 'x' }],
    };
    const errors = validateDefinition(broken).join('\n');
    expect(errors).toMatch(/key must be/);
    expect(errors).toMatch(/tier must be/);
    expect(errors).toMatch(/level must be 0 to 4/);
    expect(errors).toMatch(/go up in order/);
    expect(errors).toMatch(/unknown question nope/);
    expect(errors).toMatch(/op must be/);
  });
});

describe('answers', () => {
  it('must cover every question', () => {
    const partial = answers(PHQ_9, 1);
    delete (partial as Record<string, number>).phq9_4;
    expect(validateAnswers(PHQ_9, partial)).toBe('Please answer every question.');
  });

  it.each([[4], [-1], [1.5], ['x']])('refuses %s outside the scale', (bad) => {
    expect(validateAnswers(PHQ_9, answers(PHQ_9, 0, { phq9_1: bad as number }))).toBe('Please answer every question.');
  });

  it('ignores anything that is not a question', () => {
    const cleaned = validateAnswers(PHQ_9, { ...answers(PHQ_9, 1), injected: 99 }) as Record<string, number>;
    expect(cleaned).not.toHaveProperty('injected');
    expect(Object.keys(cleaned)).toHaveLength(9);
  });
});

describe('plans', () => {
  it.each([
    ['STARTER', 'STARTER', true], ['STARTER', 'PRO', false], ['PRO', 'PRO', true], ['CLINIC', 'PRO', true], [null, 'PRO', false],
  ] as const)('%s includes %s: %s', (plan, needed, expected) => {
    expect(tierIncludes(plan, needed)).toBe(expected);
  });
});
