// @ts-nocheck
import React from 'react';
import { NavItem } from './NavItem';
import { Logo } from './Logo';
import { AvatarChip } from './AvatarChip';

/**
 * The workspace shell sidebar — 248px expanded, 76px collapsed. Slate in
 * every tenancy — tenant color enters only through the active item's
 * gradient, never the background.
 */
export function Sidebar({ items = [], active, onSelect, user, assetBase = '', collapsed = false, onToggleCollapse, style, ...rest }: any) {
  const [hover, setHover] = React.useState(false);
  return (
    <nav
      style={{
        width: collapsed ? 76 : 248,
        flex: 'none',
        background: 'var(--desk-sidebar)',
        padding: collapsed ? '20px 10px' : '20px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'stretch',
        gap: 3,
        transition: 'width var(--dur-toggle) ease-out, padding var(--dur-toggle) ease-out',
        ...style,
      }}
      {...rest}
    >
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '4px 0 22px' : '4px 8px 22px',
        width: '100%',
      }}>
        <Logo variant={collapsed ? 'mark' : 'lockup'} size={30} assetBase={assetBase} />
      </div>

      {items.map(it => (
        <NavItem
          key={it.key ?? it.label}
          label={it.label}
          icon={it.icon}
          count={it.count}
          countTone={it.countTone}
          collapsed={collapsed}
          active={(it.key ?? it.label) === active}
          onClick={() => onSelect && onSelect(it.key ?? it.label)}
        />
      ))}

      {onToggleCollapse && (
        <button
          type="button"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            marginTop: 8, width: collapsed ? 44 : '100%', height: 36, flex: 'none',
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 11, padding: collapsed ? 0 : '0 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: hover ? 'var(--desk-sidebar-hover)' : 'transparent',
            color: 'var(--desk-text-subtle)', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)',
            transition: 'background var(--dur-color) ease-out',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d={collapsed ? 'M15 4v16M10 10l-2 2 2 2' : 'M9 4v16M15 10l2 2-2 2'} />
          </svg>
          {!collapsed && 'Collapse'}
        </button>
      )}

      {user && (
        <div style={{
          marginTop: onToggleCollapse ? 10 : 'auto',
          borderTop: '1px solid rgba(255,255,255,.07)',
          padding: collapsed ? '14px 0 2px' : '14px 10px 2px',
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
        }}>
          <AvatarChip initials={user.initials} size={32} tone="slate" radius={10} />
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E2E8F0' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'var(--desk-text-muted)' }}>{user.role}</div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
