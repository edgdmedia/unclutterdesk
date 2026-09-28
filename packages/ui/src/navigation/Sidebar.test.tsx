import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar, type SidebarSection } from './Sidebar';

const icon = <svg data-testid="icon" />;
const SECTIONS: SidebarSection[] = [
  {
    key: 'main',
    groups: [
      {
        key: 'main',
        items: [
          { key: '/dashboard', label: 'Overview', href: '/dashboard', icon },
          { key: '/dashboard/clients', label: 'Clients', href: '/dashboard/clients', icon },
        ],
      },
    ],
  },
  {
    key: 'practice',
    label: 'Practice',
    collapsible: true,
    groups: [
      { key: 'ops', label: 'Operations', items: [{ key: '/dashboard/settings/team', label: 'Team & staff', href: '/dashboard/settings/team', icon, badge: <span>clinic</span> }] },
    ],
  },
];

const brand = (mode: string) => <span>brand-{mode}</span>;

describe('Sidebar, full', () => {
  it('renders every item with its label, and marks the active one', () => {
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} activeKey="/dashboard/clients" />);
    const clients = screen.getByRole('link', { name: 'Clients' });
    expect(clients.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getByText('clinic')).toBeTruthy();
    expect(screen.getByText('brand-full')).toBeTruthy();
  });

  it('collapses a section and reports it', () => {
    const onSectionToggle = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} openSections={{ practice: true }} onSectionToggle={onSectionToggle} />);
    const toggle = screen.getByRole('button', { name: /Practice/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(onSectionToggle).toHaveBeenCalledWith('practice', false);
  });

  it('hides a closed section’s items', () => {
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} openSections={{ practice: false }} />);
    expect(screen.queryByRole('link', { name: /Team & staff/ })).toBeNull();
  });

  it('offers Collapse when a toggle is given', () => {
    const onToggleCollapse = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} onToggleCollapse={onToggleCollapse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});

describe('Sidebar, rail', () => {
  it('rail links are named although their labels are hidden', () => {
    render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} openSections={{ practice: false }} />);
    // Rail shows every item, closed sections included: there is no section header to open.
    for (const name of ['Overview', 'Clients', 'Team & staff']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('aria-label')).toBe(name);
    }
    expect(screen.getByText('brand-rail')).toBeTruthy();
    expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
  });

  it('is 76px wide and the full sidebar is 248px', () => {
    const { container, rerender } = render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} />);
    expect(container.querySelector('aside')!.className).toContain('w-[76px]');
    rerender(<Sidebar sections={SECTIONS} mode="full" brand={brand} />);
    expect(container.querySelector('aside')!.className).toContain('w-[248px]');
  });

  it('offers Expand', () => {
    const onToggleCollapse = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} onToggleCollapse={onToggleCollapse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});

describe('Sidebar, overlay', () => {
  it('is a modal dialog that closes on Esc, the backdrop and the close button', () => {
    const onClose = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="overlay" brand={brand} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sidebar-backdrop'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('moves focus inside and keeps Tab there', () => {
    render(<Sidebar sections={SECTIONS} mode="overlay" brand={brand} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('calls onNavigate when an item is chosen', () => {
    const onNavigate = vi.fn();
    render(<Sidebar sections={SECTIONS} mode="overlay" brand={brand} onClose={() => {}} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'Clients' }));
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('Sidebar links', () => {
  it('uses the LinkComponent it is given', () => {
    const Custom = ({ href, children, ...rest }: any) => <a data-router href={href} {...rest}>{children}</a>;
    render(<Sidebar sections={SECTIONS} mode="full" brand={brand} LinkComponent={Custom} />);
    expect(screen.getByRole('link', { name: 'Overview' }).hasAttribute('data-router')).toBe(true);
  });

  it('renders the account slot for the current mode', () => {
    render(<Sidebar sections={SECTIONS} mode="rail" brand={brand} account={(m) => <span>account-{m}</span>} />);
    expect(screen.getByText('account-rail')).toBeTruthy();
  });
});
