import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';
import { stepsFromRecap } from './journalPlan';

/**
 * The Journal plan on the session page: written once (from the recap's
 * tick-box items if the practitioner likes), and showing how far the client
 * has got and what she shares.
 */
const apiGet = vi.fn();
const apiPut = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), put: (...a: unknown[]) => apiPut(...a), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), baseUrl: '' },
  API_BASE: '',
}));
const { JournalPlanPanel } = await import('./JournalPlanPanel');

const t = (text: string) => ({ type: 'text', text });
const task = (text: string) => ({ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [t(text)] }] });
const RECAP = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [t('Your practice this week:')] },
    { type: 'taskList', content: [task('Days 1–5: Sit quietly for ten minutes and notice your day'), task('Day 6: What went well?'), task('What would you like more of?')] },
  ],
});

describe('turning the recap’s tick-box items into steps', () => {
  it('reads "Days 1–5" as the same prompt for five days, and the rest as one a day', () => {
    expect(stepsFromRecap(RECAP)).toEqual([
      { kind: 'repeat', days: 5, prompt: 'Sit quietly for ten minutes and notice your day' },
      { kind: 'sequence', prompts: ['What went well?', 'What would you like more of?'] },
    ]);
  });

  it('finds nothing in a recap without tick-boxes', () => {
    expect(stepsFromRecap(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [t('No tasks')] }] }))).toEqual([]);
    expect(stepsFromRecap('')).toEqual([]);
  });
});

const VIEW = {
  available: true,
  plan: null,
  addedAt: null,
  deliveryTime: null,
  link: null,
  progress: null,
  syncError: null,
  shared: [],
};

let view: Record<string, unknown> = VIEW;
beforeEach(() => {
  view = VIEW;
  apiGet.mockReset();
  apiPut.mockReset();
  apiGet.mockImplementation(() => Promise.resolve(view));
});
afterEach(() => cleanup());

const renderPanel = () => renderWithApp(<JournalPlanPanel bookingId="900" clientFirstName="Ada" recap={RECAP} />);

describe('the Journal plan panel', () => {
  it('is not there when the practice does not have Journal', async () => {
    view = { available: false };
    renderPanel();
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('JOURNAL PLAN')).toBeNull();
    expect(screen.queryByRole('button', { name: /Journal plan/ })).toBeNull();
  });

  it('starts from the recap and saves the plan', async () => {
    apiPut.mockResolvedValue({ syncError: null });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Start from the recap’s tick-box items/ }));
    expect(screen.getByText('7 days, one prompt a day')).toBeTruthy();
    expect((screen.getByLabelText('Step 1 days') as HTMLInputElement).value).toBe('5');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'After our first session' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/journal-plan', {
        plan: {
          title: 'After our first session',
          intro: null,
          cadence: 'daily',
          steps: [
            { kind: 'repeat', days: 5, prompt: 'Sit quietly for ten minutes and notice your day' },
            { kind: 'sequence', prompts: ['What went well?', 'What would you like more of?'] },
          ],
        },
      }),
    );
  });

  it('shows the API’s reason when a plan is refused', async () => {
    apiPut.mockRejectedValue(new Error('Step 1 needs a prompt.'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Write a Journal plan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Step 1 needs a prompt.');
  });

  it('shows her progress and what she shares, and an entry she withdrew without its words', async () => {
    view = {
      ...VIEW,
      plan: { title: 'Reflection practice', intro: null, cadence: 'daily', steps: [{ kind: 'sequence', prompts: ['A', 'B', 'C'] }] },
      addedAt: '2026-11-06T10:00:00.000Z',
      deliveryTime: '07:30',
      link: { profileName: 'Ada', since: '2026-11-06T10:00:00.000Z' },
      progress: { status: 'active', total: 3, delivered: 2, responded: 2, lastRespondedAt: '2026-11-08T07:00:00.000Z', nextDeliveryAt: null },
      shared: [
        { id: '1', promptText: 'What went well?', content: 'I walked to work.', writtenAt: '2026-11-08T07:00:00.000Z', updatedAt: '2026-11-08T07:00:00.000Z', sharedAt: '2026-11-08T07:01:00.000Z', withdrawnAt: null },
        { id: '2', promptText: null, content: null, writtenAt: '2026-11-07T07:00:00.000Z', updatedAt: '2026-11-07T07:00:00.000Z', sharedAt: '2026-11-07T07:01:00.000Z', withdrawnAt: '2026-11-07T20:00:00.000Z' },
      ],
    };
    renderPanel();
    expect(await screen.findByText(/In Ada’s Journal since 6 Nov, prompt at 07:30\. 2 of 3 days answered, last on 8 Nov\./)).toBeTruthy();
    expect(screen.getByText('I walked to work.')).toBeTruthy();
    expect(screen.getByText('An entry shared on 7 Nov was withdrawn on 7 Nov.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save and update Ada’s Journal' })).toBeTruthy();
  });

  it('says when Journal could not be reached', async () => {
    view = { ...VIEW, link: { profileName: 'Ada', since: '2026-11-06T10:00:00.000Z' }, syncError: 'Unclutter Journal could not be reached. Try again in a moment.' };
    renderPanel();
    expect(await screen.findByText(/could not be reached.*last time Desk could reach it/)).toBeTruthy();
  });
});
