import { UnclutterLockup, useBrand, type SidebarMode } from '@unclutterdesk/ui';

export function PracticeBrand({ mode }: { mode: SidebarMode }) {
  const brand = useBrand();
  if (mode === 'rail') return <UnclutterLockup variant="dark" showText={false} markSize={30} />;
  if (brand.logoUrl) {
    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <img src={brand.logoUrl} alt={brand.name} className="h-7 w-7 rounded-[9px] object-cover border border-white/10" />
        <span className="font-semibold text-[16px] tracking-[-0.02em] text-[#F8FAFC] truncate">{brand.name}</span>
      </div>
    );
  }
  return <UnclutterLockup variant="dark" markSize={32} />;
}
