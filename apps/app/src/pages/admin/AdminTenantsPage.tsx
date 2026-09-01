import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { Loader2, Building2, Search } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { Card, Eyebrow, StatusBadge } from '@unclutterdesk/ui';
import { AdminTenant, formatNaira, formatDate } from './adminTypes';

export function AdminTenantsPage() {
  const { data: tenants, isLoading, mutate } = useSWR<AdminTenant[]>('/v1/admin/tenants');
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = (tenants ?? []).filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.customDomain || '').toLowerCase().includes(q)
    );
  });

  const handleToggle = async (t: AdminTenant) => {
    setUpdatingId(t.id);
    setError(null);
    try {
      const updated = await api.patch<{ id: string; isActive: boolean }>(`/v1/admin/tenants/${t.id}`, {
        isActive: !t.isActive,
      });
      await mutate(
        (list) => (list ?? []).map((x) => (x.id === updated.id ? { ...x, isActive: updated.isActive } : x)),
        { revalidate: false },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex-1 min-w-0 px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <div className="mt-1 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Tenants</h1>
          <p className="mt-1 text-[13.5px] text-[#64748B]">
            Every practice on the unclutterOS platform.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-white px-4 h-[44px] w-full sm:w-[280px]">
          <Search className="h-4 w-4 text-[#94A3B8]" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search practices…"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-[#0F172A] placeholder:text-[#94A3B8]"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 text-xs font-medium text-red-600 bg-red-50 rounded-[12px] px-3.5 py-2.5">
          {error}
        </p>
      )}

      <Card className="mt-6">
        {isLoading || !tenants ? (
          <div className="flex items-center justify-center py-16 text-[#94A3B8]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tenants…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-8 w-8 text-[#CBD5E1] mb-3" strokeWidth={1.5} />
            <p className="text-[14px] font-semibold text-[#64748B]">No practices found</p>
            <p className="text-[12.5px] text-[#94A3B8] mt-1">
              {query ? 'Try a different search term.' : 'Tenants will appear here once they onboard.'}
            </p>
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
                  <th className="pb-3 text-right text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Manage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="py-3.5">
                      <Link to={`/admin/tenants/${t.id}`} className="flex items-center gap-3 group">
                        <div
                          className="h-9 w-9 rounded-[12px] text-white flex items-center justify-center font-extrabold text-sm shrink-0"
                          style={{ backgroundColor: t.primaryColor || '#0F3A53' }}
                        >
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
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggle(t)}
                        disabled={updatingId === t.id}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-[12px] font-bold cursor-pointer transition-colors disabled:opacity-50 ${
                          t.isActive
                            ? 'bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6]'
                            : 'bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5]'
                        }`}
                      >
                        {updatingId === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t.isActive ? 'Pause' : 'Activate'}
                      </button>
                    </td>
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
