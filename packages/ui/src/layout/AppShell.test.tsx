import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import type { SidebarSection } from '../navigation/Sidebar';
import { installMatchMedia, setViewportWidth } from '../test/matchMedia';

const sections: SidebarSection[] = [
  { key: 'main', groups: [{ key: 'main', items: [{ key: '/a', label: 'Overview', href: '/a', icon: <svg /> }] }] },
];
const sidebar = { sections, brand: () => <span>brand</span> };
const bottomNav = { items: [{ key: '/a', label: 'Today', icon: <svg />, href: '/a' }] };

function shell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  return render(
    <AppShell sidebar={sidebar} bottomNav={bottomNav} {...props}>
      <p>page</p>
    </AppShell>,
  );
}

const aside = () => document.querySelector('aside');

describe('AppShell on a desktop', () => {
  it('shows the full sidebar, or the rail when collapsed, and no bottom bar', () => {
    installMatchMedia(1440);
    const { rerender } = shell();
    expect(aside()!.className).toContain('w-[248px]');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    rerender(
      <AppShell sidebar={sidebar} bottomNav={bottomNav} collapsed>
        <p>page</p>
      </AppShell>,
    );
    expect(aside()!.className).toContain('w-[76px]');
  });

  it('collapses through onCollapsedChange', () => {
    installMatchMedia(1440);
    const onCollapsedChange = vi.fn();
    shell({ onCollapsedChange });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });
});

describe('AppShell on a tablet', () => {
  it('always shows the rail, even if the desktop preference is expanded', () => {
    installMatchMedia(820);
    shell({ collapsed: false });
    expect(aside()!.className).toContain('w-[76px]');
  });

  it('expands over the page rather than beside it', () => {
    installMatchMedia(820);
    const onCollapsedChange = vi.fn();
    shell({ onCollapsedChange });
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    expect(onCollapsedChange).not.toHaveBeenCalled();
  });

  it('closes the overlay when the screen becomes desktop width', () => {
    installMatchMedia(820);
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    act(() => setViewportWidth(1400));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(aside()!.className).toContain('w-[248px]');
  });
});

describe('AppShell on a phone', () => {
  it('has no inline sidebar and shows the bottom bar with More', () => {
    installMatchMedia(390);
    shell();
    expect(aside()).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('opens the menu from More and returns focus to the opener on close', () => {
    installMatchMedia(390);
    shell();
    const more = screen.getByRole('button', { name: 'More' });
    more.focus();
    fireEvent.click(more);
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('closes the menu after choosing a page', () => {
    installMatchMedia(390);
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('AppShell content', () => {
  it('pads the content only when the bottom bar shows', () => {
    installMatchMedia(390);
    const { unmount } = shell();
    expect(screen.getByTestId('app-content').className).toContain('pb-[84px]');
    unmount();
    installMatchMedia(1440);
    shell();
    expect(screen.getByTestId('app-content').className).not.toContain('pb-[84px]');
  });

  it('keeps the content column from being forced wider', () => {
    shell();
    expect(screen.getByTestId('app-content').className).toContain('min-w-0');
  });

  it('renders a banner above the page', () => {
    shell({ banner: <div role="alert">Could not load</div> });
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('the header slot', () => {
  it('renders the header above the content, right-aligned', () => {
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.queryByTestId('app-header')).toBeNull();
    render(
      <AppShell header={<button>bell</button>}>
        <p>page</p>
      </AppShell>,
    );
    const bar = screen.getByTestId('app-header');
    expect(bar.querySelector('button')).toBeTruthy();
    expect(bar.className).toContain('justify-end');
  });
});
