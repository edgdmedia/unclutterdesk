import { describe, expect, it } from 'vitest';
import { displayValue, humaniseKey, labelledAnswers } from './form-answers';

describe('answers as people read them', () => {
  const schema = [
    { id: 'preferred_name', label: 'What should we call you?', type: 'text' },
    { id: 'previous_therapy', label: 'Have you had therapy before?', type: 'radio' },
    { id: 'concerns', label: 'What brings you here?', type: 'checkbox' },
  ];

  it("uses each question's label, in the form's order", () => {
    const out = labelledAnswers(schema, { concerns: ['Anxiety', 'Sleep'], previous_therapy: 'Yes', preferred_name: 'Subomi' });
    expect(out.map((a) => [a.label, a.display])).toEqual([
      ['What should we call you?', 'Subomi'],
      ['Have you had therapy before?', 'Yes'],
      ['What brings you here?', 'Anxiety, Sleep'],
    ]);
  });

  it('never shows a raw key, even for a field the form no longer has', () => {
    const out = labelledAnswers(schema, { anything_else: 'None', dateOfBirth: '5 August' });
    expect(out.map((a) => a.label)).toEqual(['Anything else', 'Date of birth']);
    expect(humaniseKey('consent_contact')).toBe('Consent contact');
  });

  it('writes values readably', () => {
    expect(displayValue(true)).toBe('Yes');
    expect(displayValue('')).toBe('—');
    expect(displayValue(null)).toBe('—');
    expect(displayValue([])).toBe('—');
  });

  it('copes with a missing or broken schema and answers', () => {
    expect(labelledAnswers(null, { phone: '0707' })).toEqual([{ id: 'phone', label: 'Phone', type: 'text', value: '0707', display: '0707' }]);
    expect(labelledAnswers(schema, null)).toEqual([]);
  });
});
