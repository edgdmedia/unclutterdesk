import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderWithApp, screen } from '../../../test/renderWithApp';
import { AssessmentQuestionnaire } from '../AssessmentQuestionnaire';
import type { AssessmentDefinition } from '../../../utils/assessments';

const BASE: AssessmentDefinition = {
  key: 'RSES',
  name: 'Rosenberg Self-Esteem Scale (RSES)',
  shortName: 'Rosenberg',
  measures: 'Self-esteem',
  instructions: 'Below is a list of statements about how you feel about yourself in general.',
  estimatedMinutes: 3,
  tier: 'STARTER',
  scale: [
    { value: 3, label: 'Strongly agree' },
    { value: 2, label: 'Agree' },
    { value: 1, label: 'Disagree' },
    { value: 0, label: 'Strongly disagree' },
  ],
  items: [{ id: 'rses_1', text: 'On the whole, I am satisfied with myself.' }],
};

function render(assessment: AssessmentDefinition) {
  return renderWithApp(
    <AssessmentQuestionnaire assessment={assessment} color="#0F3A53" firstName="Ada" onSubmit={vi.fn()} />,
  );
}

describe('the assessment questionnaire intro', () => {
  it('names the instrument, explains it and reassures the client', () => {
    render({ ...BASE, description: 'This questionnaire asks about how you generally view yourself.' });

    expect(screen.getByRole('heading', { name: 'Hi Ada, here is the Rosenberg Self-Esteem Scale (RSES)' })).toBeTruthy();
    expect(screen.getByText('This questionnaire asks about how you generally view yourself.')).toBeTruthy();
    expect(screen.getByText(/About 3 minutes/)).toBeTruthy();
    expect(screen.getByText('There are no right or wrong answers')).toBeTruthy();
    expect(screen.getByText('Your answers go only to your practitioner')).toBeTruthy();
    expect(screen.getByText('Below is a list of statements about how you feel about yourself in general.')).toBeTruthy();
  });

  it('keeps the intake heading for a questionnaire without a description', () => {
    render(BASE);

    expect(screen.getByRole('heading', { name: 'Hi Ada, a few questions before we talk' })).toBeTruthy();
    expect(screen.queryByText('This questionnaire asks about how you generally view yourself.')).toBeNull();
  });
});