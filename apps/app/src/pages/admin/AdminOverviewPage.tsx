import React from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import {
  Building2,
  Users,
  CalendarDays,
  ClipboardList,
  Wallet,
  TrendingUp,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { Card, CardHeader, Eyebrow, StatusBadge } from '@unclutterdesk/ui';
import {
  AdminStats,
  AdminTenant,
  formatNaira,
  formatCount,
  formatDate,
} from './adminTypes';

export function AdminOverviewPage() {
  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR<AdminStats>('/v1/admin/stats');
  const { data: tenants, isLoading: tenantsLoading } = useSWR<AdminTenant[]>('/v1/admin/tenants');

  const activeTenantCount = tenants?.filter((t) => t.isActive).length ?? 0;

  const tiles: { label: string; value: string; icon: typeof Building2; accent?: string }[] = [
    { label: 'Practice tenants', value: stats ? formatCount(stats.tenants) : '—', icon: Building2 },
    { label: 'Active tenants', value: stats ? formatCount(stats.activeTenants) : '—', icon: TrendingUp },
    { label: 'Staff members', value: stats ? formatCount(stats.staffCount) : '—', icon: Users },
    { label: 'Clients', value: stats ? formatCount(stats.clientCount) : '—', icon: Users },
    { label: 'Bookings', value: stats ? formatCount(stats.bookings) : '—', icon: CalendarDays },
    { label: 'Forms & assessments', value: stats ? formatCount(stats.forms) : '—', icon: ClipboardList },
  ];

  return (
    <div className="flex-1 min-w-0 px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <div className="mt-1 flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Overview</h1>
        <p className="text-[13.5px] text-[#64748B]">
          {tenantsLoading || !tenants
            ? 'Loading tenant activity…'
            : `${activeTenantCount} of ${tenants.length} tenants active`}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="bg-white rounded-[18px] border border-[#E2E8F0] p-[16px_18px] shadow-[0_1px_3px_0_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0F172A] leading-none">
                  {t.value}
                </span>
                <Icon className="h-[18px] w-[18px] text-[#0F3A53]" strokeWidth={2} />
              </div>
              <span className="text-[11px] text-[#64748B] font-medium block mt-2">{t.label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow>Gross revenue</Eyebrow>
              <div className="text-[30px] font-extrabold tracking-[-0.04em] text-[#0F172A] mt-1">
                {stats ? formatNaira(stats.revenueKobo) : '—'}
              </div>
              <p className="text-[12px] text-[#64748B] mt-1">
                Across {stats ? formatCount(stats.bookings) : '—'} bookings
              </p>
            </div>
            <div className="h-12 w-12 rounded-[16px] bg-[#0F3A53] text-[#E3B341] flex items-center justify-center">
              <Wallet className="h-5 w-5" strokeWidth={2} />
            </div>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Registered users', value: stats ? formatCount(stats.users) : '—' },
              { label: 'Active tenants', value: stats ? formatCount(stats.activeTenants) : '—' },
              { label: 'Clients', value: stats ? formatCount(stats.clientCount) : '—' },
              { label: 'Forms', value: stats ? formatCount(stats.forms) : '—' },
            ].map((s) => (
              <div key={s.label} className="p-[12px_14px] rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0F172A] block leading-none mb-1">
                  {s.value}
                </span>
                <span className="text-[11px] text-[#64748B] font-medium block">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {statsError && (
        <p className="mt-4 text-xs font-medium text-red-600 bg-red-50 rounded-[12px] px-3.5 py-2.5">
          Could not load platform statistics: {statsError.message}
        </p>
      )}

      <Card className="mt-6">
        <CardHeader
          eyebrow="Directory"
          title="Recent tenants"
          action={
            <Link
              to="/admin/tenants"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#0F3A53] hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {tenantsLoading || !tenants ? (
          <div className="flex items-center justify-center py-12 text-[#94A3B8]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tenants…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Practice</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Plan</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Clients</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Bookings</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Revenue</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Status</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Joined</th>
                </tr>
              </thead>
              <tbody>
                {tenants.slice(0, 6).map((t) => (
                  <tr key={t.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="py-3.5">
                      <Link to={`/admin/tenants/${t.id}`} className="flex items-center gap-3 group">
                        <div className="h-9 w-9 rounded-[12px] bg-[#0F3A53] text-white flex items-center justify-center font-extrabold text-sm shrink-0">
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-bold text-[#0F172A] group-hover:text-[#0F3A53]">
                            {t.name}
                          </div>
                          <div className="text-[11.5px] text-[#94A3B8]">
                            {t.slug}.unclutterdesk.com{t.customDomain ? ` · ${t.customDomain}` : ''}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5">
                      <span className="text-[12px] font-bold text-[#64748B]">{t.subscriptionTier}</span>
                    </td>
                    <td className="py-3.5 text-[13px] font-semibold text-[#0F172A]">{t.clients}</td>
                    <td className="py-3.5 text-[13px] font-semibold text-[#0F172A]">{t.bookings}</td>
                    <td className="py-3.5 text-[13px] font-semibold text-[#0F172A]">
                      {formatNaira(t.revenueKobo)}
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={t.isActive ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="py-3.5 text-[12.5px] text-[#64748B]">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
