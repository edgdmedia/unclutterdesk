import { ClipboardList, CreditCard, FileText, Home, UserRound, type LucideIcon } from 'lucide-react';
import type { SidebarSection } from '@unclutterdesk/ui';

interface ClientNavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** POR-03: the portal menu, decided 2 Oct 2026. */
export const CLIENT_NAV: ClientNavEntry[] = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/sessions', label: 'Sessions', icon: ClipboardList },
  { href: '/portal/forms', label: 'Forms & assessments', icon: FileText },
  { href: '/portal/payments', label: 'Payments', icon: CreditCard },
  { href: '/portal/details', label: 'My details', icon: UserRound },
];

/** The phone's bottom bar; My details is under "More" and the account menu. */
export const CLIENT_BOTTOM_NAV: ClientNavEntry[] = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/sessions', label: 'Sessions', icon: ClipboardList },
  { href: '/portal/forms', label: 'Forms', icon: FileText },
  { href: '/portal/payments', label: 'Payments', icon: CreditCard },
];

export function clientSections(formsTodo?: number): SidebarSection[] {
  return [
    {
      key: 'portal',
      groups: [
        {
          key: 'main',
          items: CLIENT_NAV.map((i) => ({
            key: i.href,
            label: i.label,
            href: i.href,
            icon: <i.icon strokeWidth={2.5} />,
            badge:
              i.href === '/portal/forms' && formsTodo && formsTodo > 0 ? (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--brand-primary,#0F3A53)] text-white text-[11px] font-bold grid place-items-center">
                  {formsTodo}
                </span>
              ) : undefined,
          })),
        },
      ],
    },
  ];
}
