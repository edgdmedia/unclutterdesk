import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Page } from './Page';
import { PageHeader } from './PageHeader';

describe('Page', () => {
  it('names the page container and caps content at 1440px', () => {
    const { container } = render(<Page>content</Page>);
    const root = container.firstElementChild!;
    expect(root.className).toContain('@container/page');
    expect(root.className).toContain('min-w-0');
    expect(screen.getByRole('main').className).toContain('max-w-[1440px]');
  });

  it('has a narrow size for form pages', () => {
    render(<Page size="narrow">form</Page>);
    expect(screen.getByRole('main').className).toContain('max-w-[880px]');
  });

  it('renders its header above the content', () => {
    render(<Page header={<PageHeader title="Analytics" />}>body</Page>);
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeTruthy();
  });
});

describe('PageHeader', () => {
  it('shows the eyebrow, breadcrumb and actions', () => {
    render(
      <PageHeader
        eyebrow="PRACTICE ANALYTICS"
        breadcrumb={<a href="/clients">Clients</a>}
        title="Ada Ola"
        actions={<button>Book a session</button>}
      />,
    );
    expect(screen.getByText('PRACTICE ANALYTICS')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Book a session' })).toBeTruthy();
  });

  it('truncates a long title rather than widening the page', () => {
    render(<PageHeader title={'A very long practice name '.repeat(8)} />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('truncate');
  });

  it('folds secondary actions into a "More actions" menu for narrow pages', () => {
    render(<PageHeader title="Client" secondaryActions={<button>Export file</button>} />);
    const more = screen.getByRole('button', { name: 'More actions' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
    // jsdom cannot evaluate container queries, so the inline copy is present too.
    expect(screen.getAllByRole('button', { name: 'Export file' }).length).toBe(2);
  });
});

describe('Page with a side panel', () => {
  it('puts children in the main column and the aside in a 372px panel', () => {
    const { container } = render(
      <Page layout="main-aside" aside={<div>side</div>}>
        <div>main</div>
      </Page>,
    );
    const grid = container.querySelector('[class*="372px"]');
    expect(grid).toBeTruthy();
    expect(grid?.textContent).toContain('main');
    expect(grid?.textContent).toContain('side');
  });

  it('is unchanged without the layout', () => {
    const { container } = render(<Page><div>only</div></Page>);
    expect(container.querySelector('[class*="372px"]')).toBeNull();
  });
});
