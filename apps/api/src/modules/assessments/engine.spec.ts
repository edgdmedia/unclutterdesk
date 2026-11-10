import { describe, expect, it } from 'vitest';
import { BPAQ, BUILTIN_INSTRUMENTS, DAR_5, DASS_21, GAD_7, PCL_5, PHQ_9, RSES } from './builtin-instruments';
import { publicDefinition, score, validateAnswers, validateDefinition, type InstrumentDefinition } from './engine';

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
  it('has PHQ-9, GAD-7, PCL-5, DASS-21, Buss–Perry, DAR-5 and Rosenberg', () => {
    expect(BUILTIN_INSTRUMENTS.map((i) => i.key)).toEqual(['PHQ_9', 'GAD_7', 'PCL_5', 'DASS_21', 'BPAQ', 'DAR_5', 'RSES']);
  });

  it.each(BUILTIN_INSTRUMENTS.map((d) => [d.key, d]))('%s is a valid definition', (_key, def) => {
    expect(validateDefinition(def)).toEqual([]);
  });

  it.each([[PHQ_9, 9, 4], [GAD_7, 7, 4], [PCL_5, 20, 5], [DASS_21, 21, 4], [BPAQ, 29, 5], [DAR_5, 5, 5], [RSES, 10, 4]] as const)('%s has its published length', (def, count, points) => {
    expect(def.items).toHaveLength(count);
    expect(def.scale).toHaveLength(points);
  });

  it('puts the common screeners on every plan and the longer ones on Pro', () => {
    expect(BUILTIN_INSTRUMENTS.map((d) => [d.key, d.tier])).toEqual([
      ['PHQ_9', 'STARTER'], ['GAD_7', 'STARTER'], ['PCL_5', 'PRO'], ['DASS_21', 'PRO'],
      ['BPAQ', 'PRO'], ['DAR_5', 'STARTER'], ['RSES', 'STARTER'],
    ]);
  });

  it('never sends scoring or rules to the browser', () => {
    const shown = publicDefinition(PHQ_9);
    expect(shown).not.toHaveProperty('scoring');
    expect(shown).not.toHaveProperty('rules');
  });

  it('sends description for instruments that have it', () => {
    const shown = publicDefinition(PHQ_9);
    expect(shown).toHaveProperty('description');
    expect(shown.description).toMatch(/low mood/);
  });

  it('omits description when it is absent', () => {
    const def = { ...PHQ_9, description: undefined };
    const shown = publicDefinition(def);
    expect(shown).not.toHaveProperty('description');
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

// Questions worded the other way round are flipped before they are added up.
describe('reverse-scored questions', () => {
  it('refuses a reverse list naming a question the instrument does not have', () => {
    const bad = { ...DAR_5, scoring: { ...DAR_5.scoring, reverse: ['dar5_99'] } };
    expect(validateDefinition(bad)).toContain('scoring.reverse names an unknown question dar5_99.');
  });

  it('flips them on the scale, whatever the scale starts at', () => {
    // Rosenberg, 0–3: "strongly agree" (3) everywhere means the five negative statements count 0.
    expect(score(RSES, answers(RSES, 3)).totalScore).toBe(15);
    // Buss–Perry, 1–5: "extremely characteristic" (5) on item 9 counts 1.
    const r = score(BPAQ, answers(BPAQ, 1, { bpaq_9: 5 }));
    expect(r.subscales.find((x) => x.key === 'anger')!.score).toBe(7);
  });

  it('leaves single-question rules on the answer the client gave', () => {
    const r = score(BPAQ, answers(BPAQ, 1, { bpaq_8: 4 }));
    expect(r.flags.map((f) => f.key)).toEqual(['urge_to_strike']);
  });
});

describe('Buss–Perry Aggression Questionnaire', () => {
  it('scores its four subscales and a total of 29–145', () => {
    const low = score(BPAQ, answers(BPAQ, 1, { bpaq_9: 5, bpaq_16: 5 }));
    expect(low.totalScore).toBe(29);
    const high = score(BPAQ, answers(BPAQ, 5, { bpaq_9: 1, bpaq_16: 1 }));
    expect(high.totalScore).toBe(145);
    expect(high.subscales.map((x) => [x.key, x.score])).toEqual([['physical', 45], ['verbal', 25], ['anger', 35], ['hostility', 40]]);
  });

  it('claims no clinical threshold', () => {
    const r = score(BPAQ, answers(BPAQ, 5));
    expect(r.severity).toEqual({ label: 'Scored', level: 0 });
  });

  it('every question is in exactly one subscale', () => {
    const all = BPAQ.scoring.subscales!.flatMap((x) => x.items).sort();
    expect(all).toEqual(BPAQ.items.map((i) => i.id).sort());
  });
});

describe('DAR-5', () => {
  it('uses the published cut-off of 12', () => {
    expect(score(DAR_5, answers(DAR_5, 1, { dar5_1: 3, dar5_2: 3, dar5_3: 3 })).severity.label).toBe('Below the cut-off'); // 11
    expect(score(DAR_5, answers(DAR_5, 1, { dar5_1: 3, dar5_2: 3, dar5_3: 3, dar5_5: 2 })).severity).toEqual({ label: 'Above the cut-off', level: 2 }); // 12
  });

  it('asks the practitioner to look when the client often wanted to hit someone', () => {
    expect(score(DAR_5, answers(DAR_5, 1, { dar5_4: 4 })).flags.map((f) => f.key)).toEqual(['wanted_to_hit']);
    expect(score(DAR_5, answers(DAR_5, 1, { dar5_4: 3 })).flags).toEqual([]);
  });
});

describe('Rosenberg Self-Esteem Scale', () => {
  const positive = ['rses_1', 'rses_3', 'rses_4', 'rses_7', 'rses_10'];
  const strongly = (agreePositive: number, agreeNegative: number) =>
    Object.fromEntries(RSES.items.map((i) => [i.id, positive.includes(i.id) ? agreePositive : agreeNegative]));

  it('scores 0–30, higher meaning higher self-esteem', () => {
    expect(score(RSES, strongly(3, 0)).totalScore).toBe(30);
    expect(score(RSES, strongly(0, 3)).totalScore).toBe(0);
  });

  it('marks below 15 as low, and only that as something to notice', () => {
    expect(score(RSES, strongly(0, 3)).severity).toEqual({ label: 'Low self-esteem', level: 2 });
    expect(score(RSES, strongly(2, 1)).severity).toEqual({ label: 'Typical range', level: 0 }); // 20
    expect(score(RSES, strongly(3, 0)).severity).toEqual({ label: 'High self-esteem', level: 0 });
  });
});
