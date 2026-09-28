import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatTile } from './StatTile';
import { MetricTile } from './MetricTile';

describe('StatTile', () => {
  it('shows the label, the value and a delta', () => {
    render(<StatTile label="Sessions" value={42} delta="+12%" deltaTone="up" />);
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('+12%').className).toContain('var(--desk-active');
  });

  it('truncates long values and keeps the full text as a tooltip', () => {
    const long = 'Wednesday 14 October 2026, 10:00 with Dr Jane Smith';
    render(<StatTile label="Next session" value={long} />);
    const value = screen.getByText(long);
    expect(value.className).toContain('truncate');
    expect(value.getAttribute('title')).toBe(long);
  });

  it('never forces its column wider', () => {
    const { container } = render(<StatTile label="x" value="y" variant="inset" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('min-w-0');
  });

  it('takes a runtime colour for the value', () => {
    render(<StatTile label="Next" value="Mon" valueColor="#123456" />);
    expect((screen.getByText('Mon') as HTMLElement).style.color).toBe('rgb(18, 52, 86)');
  });
});

describe('MetricTile', () => {
  it('shows the value over its label', () => {
    render(<MetricTile value={8} label="Total clients" />);
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Total clients')).toBeTruthy();
  });
});
