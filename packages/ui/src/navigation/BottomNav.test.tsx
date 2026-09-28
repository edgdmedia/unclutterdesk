import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BottomNav } from './BottomNav';

const icon = <svg />;

describe('BottomNav', () => {
  it('renders links for items with an href and marks the active one', () => {
    render(
      <BottomNav
        items={[
          { key: '/dashboard', label: 'Today', icon, href: '/dashboard' },
          { key: '/dashboard/clients', label: 'Clients', icon, href: '/dashboard/clients' },
        ]}
        active="/dashboard/clients"
      />,
    );
    expect(screen.getByRole('link', { name: 'Clients' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Today' }).getAttribute('aria-current')).toBeNull();
  });

  it('still supports onSelect for items without an href', () => {
    const onSelect = vi.fn();
    render(<BottomNav items={[{ key: 'a', label: 'Alpha', icon }]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('adds a More button that opens the menu', () => {
    const onMore = vi.fn();
    render(<BottomNav items={[]} onMore={onMore} />);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(more);
    expect(onMore).toHaveBeenCalled();
  });
});
