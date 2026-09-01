import React from 'react';
import { NavItem } from './NavItem.jsx';
import { Logo } from '../brand/Logo.jsx';
import { AvatarChip } from '../core/AvatarChip.jsx';

/**
 * The 248px workspace shell sidebar. Slate in every tenancy — tenant color
 * enters only through the active item's gradient, never the background.
 */
export function Sidebar({ items = [], active, onSelect, user, assetBase = '', style, ...rest }) {
  return (
    <nav
      style={{
        width: 248,
        flex: 'none',
        background: 'var(--desk-sidebar)',
        padding: '20px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        ...style,
      }}
      {...rest}
    >
      <div style={{ padding: '4px 8px 22px' }}>
        <Logo variant="lockup" size={30} assetBase={assetBase} />
      </div>

      {items.map(it => (
        <NavItem
          key={it.key ?? it.label}
          label={it.label}
          icon={it.icon}
          count={it.count}
          countTone={it.countTone}
          active={(it.key ?? it.label) === active}
          onClick={() => onSelect && onSelect(it.key ?? it.label)}
        />
      ))}

      {user && (
        <div style={{
          marginTop: 'auto',
          borderTop: '1px solid rgba(255,255,255,.07)',
          padding: '14px 10px 2px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AvatarChip initials={user.initials} size={32} tone="slate" radius={10} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E2E8F0' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'var(--desk-text-muted)' }}>{user.role}</div>
          </div>
        </div>
      )}
    </nav>
  );
}
