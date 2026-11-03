import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { href: '/admin/profile-content/templates', label: 'Templates' },
  { href: '/admin/profile-content/taxonomy', label: 'Taxonomy' },
  { href: '/admin/profile-content/guidance', label: 'Guidance' },
];

/** The three profile-content screens share one tab strip so admins can move between them. */
export function ProfileContentTabs() {
  const location = useLocation();
  return (
    <nav aria-label="Profile content" className="mt-5 flex flex-wrap gap-1.5 border-b border-[#E2E8F0] pb-2">
      {TABS.map((tab) => {
        const active = location.pathname === tab.href;
        return (
          <Link
            key={tab.href}
            to={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`h-9 inline-flex items-center rounded-[10px] px-3 text-[13px] font-bold no-underline ${
              active ? 'bg-[#0F172A] text-white' : 'text-[#475569] hover:bg-[#F1F5F9]'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}