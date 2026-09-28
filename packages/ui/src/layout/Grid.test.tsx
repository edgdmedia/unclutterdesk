import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Grid, gridClasses } from './Grid';

describe('Grid', () => {
  it('turns column counts into content-width container classes', () => {
    expect(gridClasses({ base: 1, sm: 2, lg: 4 })).toBe(
      'grid-cols-1 @min-[480px]/page:grid-cols-2 @min-[960px]/page:grid-cols-4',
    );
    expect(gridClasses({ base: 2, md: 3, xl: 6 })).toBe(
      'grid-cols-2 @min-[640px]/page:grid-cols-3 @min-[1200px]/page:grid-cols-6',
    );
  });

  it('renders a grid with the gap from the spacing scale', () => {
    render(
      <Grid cols={{ base: 1, lg: 4 }} gap="lg" className="items-start">
        <span>one</span>
      </Grid>,
    );
    const grid = screen.getByText('one').parentElement!;
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('@min-[960px]/page:grid-cols-4');
    expect(grid.className).toContain('gap-5');
    expect(grid.className).toContain('items-start');
  });

  it('lets an item span columns', () => {
    render(
      <Grid cols={{ base: 1, xl: 3 }}>
        <Grid.Item span={{ base: 1, xl: 2 }}>wide</Grid.Item>
      </Grid>,
    );
    expect(screen.getByText('wide').className).toContain('@min-[1200px]/page:col-span-2');
  });
});
