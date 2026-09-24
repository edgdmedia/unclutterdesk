import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, instrument, publicDefinition, validateAnswers } from './instruments';

/** Answers every item with `value`, then applies any overrides. */
function answers(key: string, value: number, overrides: Record<string, number> = {}) {
  const inst = instrument(key)!;
  return { ...Object.fromEntries(inst.items.map((i) => [i.id, value])), ...overrides };
}

describe('the library', () => {
  it('has PHQ-9, GAD-7, PCL-5 and DASS-21', () => {
    expect(INSTRUMENTS.map((i) => i.key)).toEqual(['PHQ_9', 'GAD_7', 'PCL_5', 'DASS_21']);
  });

  it.each([['PHQ_9', 9, 4], ['GAD_7', 7, 4], ['PCL_5', 20, 5], ['DASS_21', 21, 4]])(
    '%s has %i items on a %i-point scale',
    (key, count, points) => {
      const inst = instrument(key as string)!;
      expect(inst.items).toHaveLength(count as number);
      expect(inst.scale).toHaveLength(points as number);
      expect(new Set(inst.items.map((i) => i.id)).size).toBe(count);
    },
  );

  it('never sends the scoring function to the browser', () => {
    expect(publicDefinition(instrument('PHQ_9')!)).not.toHaveProperty('score');
  });
});

describe('PHQ-9', () => {
  const score = (a: Record<string, number>) => instrument('PHQ_9')!.score(a);

  it.each([
    [{ phq9_1: 4 }, 'Minimal'],
    [{ phq9_1: 3, phq9_2: 2 }, 'Mild'],
    [{ phq9_1: 3, phq9_2: 3, phq9_3: 3, phq9_4: 1 }, 'Moderate'],
    [{ phq9_1: 3, phq9_2: 3, phq9_3: 3, phq9_4: 3, phq9_5: 3 }, 'Moderately severe'],
  ])('bands %o as %s', (overrides, label) => {
    expect(score(answers('PHQ_9', 0, overrides)).severity.label).toBe(label);
  });

  it('scores 27 as Severe', () => {
    const result = score(answers('PHQ_9', 3));
    expect(result.totalScore).toBe(27);
    expect(result.severity.label).toBe('Severe');
  });

  // Any answer above zero on item 9 must reach the clinician, whatever the total.
  it('flags item 9 even when the total is minimal', () => {
    const result = score(answers('PHQ_9', 0, { phq9_9: 1 }));
    expect(result.severity.label).toBe('Minimal');
    expect(result.flags.map((f) => f.key)).toEqual(['self_harm']);
  });
});

describe('GAD-7', () => {
  it.each([[4, 'Minimal'], [5, 'Mild'], [10, 'Moderate'], [15, 'Severe']])('%i is %s', (total, label) => {
    const a = answers('GAD_7', 0);
    let left = total;
    for (const key of Object.keys(a)) {
      a[key] = Math.min(3, left);
      left -= a[key];
    }
    expect(instrument('GAD_7')!.score(a).severity.label).toBe(label);
  });
});

describe('PCL-5', () => {
  const score = (a: Record<string, number>) => instrument('PCL_5')!.score(a);

  it('uses 33 as the probable PTSD cut-off', () => {
    const at = (total: number) => {
      const a = answers('PCL_5', 0);
      let left = total;
      for (const key of Object.keys(a)) {
        a[key] = Math.min(4, left);
        left -= a[key];
      }
      return score(a).severity.label;
    };
    expect(at(30)).toBe('Below the cut-off');
    expect(at(32)).toBe('Near the cut-off');
    expect(at(33)).toMatch(/Probable PTSD/);
  });

  it('reports the four DSM-5 clusters', () => {
    const result = score(answers('PCL_5', 1));
    expect(result.subscales.map((s) => [s.key, s.score])).toEqual([
      ['intrusion', 5],
      ['avoidance', 2],
      ['cognition_mood', 7],
      ['arousal', 6],
    ]);
    expect(result.totalScore).toBe(20);
  });
});

describe('DASS-21', () => {
  const score = (a: Record<string, number>) => instrument('DASS_21')!.score(a);

  // Subscales are doubled to match DASS-42 norms.
  it('doubles each subscale', () => {
    const result = score(answers('DASS_21', 1));
    expect(result.subscales.map((s) => s.score)).toEqual([14, 14, 14]);
  });

  it('bands each subscale on its own cut-offs', () => {
    // Depression items 3,5,10,13,16,17,21 at 2 each: 14 × 2 = 28, extremely severe.
    const depression = Object.fromEntries([3, 5, 10, 13, 16, 17, 21].map((n) => [`dass21_${n}`, 2]));
    const result = score(answers('DASS_21', 0, depression));
    const bySubscale = Object.fromEntries(result.subscales.map((s) => [s.key, s.severity.label]));
    expect(bySubscale).toEqual({ depression: 'Extremely severe', anxiety: 'Normal', stress: 'Normal' });
    expect(result.severity.label).toBe('Extremely severe depression');
  });

  it('is normal when every answer is zero', () => {
    expect(score(answers('DASS_21', 0)).severity.label).toBe('Normal on all scales');
  });
});

describe('answers', () => {
  const phq = instrument('PHQ_9')!;

  it('must cover every question', () => {
    const partial = answers('PHQ_9', 1);
    delete (partial as Record<string, number>).phq9_4;
    expect(validateAnswers(phq, partial)).toBe('Please answer every question.');
  });

  it.each([[4], [-1], [1.5], ['x']])('refuses %s outside the scale', (bad) => {
    expect(validateAnswers(phq, answers('PHQ_9', 0, { phq9_1: bad as number }))).toBe('Please answer every question.');
  });

  it('ignores anything that is not a question', () => {
    const cleaned = validateAnswers(phq, { ...answers('PHQ_9', 1), injected: 99 }) as Record<string, number>;
    expect(cleaned).not.toHaveProperty('injected');
    expect(Object.keys(cleaned)).toHaveLength(9);
  });
});
