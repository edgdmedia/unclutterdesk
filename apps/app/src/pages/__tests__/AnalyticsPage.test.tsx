import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsPage } from '../AnalyticsPage';

describe('AnalyticsPage', () => {
  it('renders the range segmented control without crashing', () => {
    render(
      <MemoryRouter>
        <AnalyticsPage clients={[]} sessions={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('30 days')).toBeTruthy();
    expect(screen.getByText('90 days')).toBeTruthy();
    expect(screen.getByText('12 months')).toBeTruthy();
  });
});
