import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { Loader2, Building2, Search } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { Card, Eyebrow, StatusBadge, useToast } from '@unclutterdesk/ui';
import { AdminTenant, formatNaira, formatDate } from './adminTypes';
import { TENANT_ROOT_DOMAIN } from '../../config/domains';

export function AdminTenantsPage() {
  const toast = useToast();
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
      toast.success('Practice status updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the practice');
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
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">Tenants</h1>
          <p className="mt-1 text-[13.5px] text-[var(--desk-text-muted)]">
            Every practice on the Unclutter Desk platform.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-[14px] border border-[var(--desk-border)] bg-white px-4 h-[44px] w-full sm:w-[280px]">
          <Search className="h-4 w-4 text-[var(--desk-text-subtle)]" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search practices…"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-[var(--desk-text)] placeholder:text-[var(--desk-text-subtle)]"
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
          <div className="flex items-center justify-center py-16 text-[var(--desk-text-subtle)]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tenants…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-8 w-8 text-[var(--desk-pine-200)] mb-3" strokeWidth={1.5} />
            <p className="text-[14px] font-semibold text-[var(--desk-text-muted)]">No practices found</p>
            <p className="text-[12.5px] text-[var(--desk-text-subtle)] mt-1">
              {query ? 'Try a different search term.' : 'Tenants will appear here once they onboard.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--desk-border)]">
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Practice</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Plan</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Clients</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Bookings</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Revenue</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Status</th>
                  <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Joined</th>
                  <th className="pb-3 text-right text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Manage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--desk-border-soft)] last:border-0 hover:bg-[var(--desk-surface)]">
                    <td className="py-3.5">
                      <Link to={`/admin/tenants/${t.id}`} className="flex items-center gap-3 group">
                        <div
                          className="h-9 w-9 rounded-[12px] text-white flex items-center justify-center font-extrabold text-sm shrink-0"
                          style={{ backgroundColor: t.primaryColor || '#0F3A53' }}
                        >
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-bold text-[var(--desk-text)] group-hover:text-[var(--desk-pine-600)]">
                            {t.name}
                          </div>
                          <div className="text-[11.5px] text-[var(--desk-text-subtle)]">
                            {t.slug}.{TENANT_ROOT_DOMAIN}{t.customDomain ? ` · ${t.customDomain}` : ''}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5">
                      <span className="text-[12px] font-bold text-[var(--desk-text-muted)]">{t.subscriptionTier}</span>
                    </td>
                    <td className="py-3.5 text-[13px] font-semibold text-[var(--desk-text)]">{t.clients}</td>
                    <td className="py-3.5 text-[13px] font-semibold text-[var(--desk-text)]">{t.bookings}</td>
                    <td className="py-3.5 text-[13px] font-semibold text-[var(--desk-text)]">
                      {formatNaira(t.revenueKobo)}
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={t.isActive ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="py-3.5 text-[12.5px] text-[var(--desk-text-muted)]">{formatDate(t.createdAt)}</td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggle(t)}
                        disabled={updatingId === t.id}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-[12px] font-bold cursor-pointer transition-colors disabled:opacity-50 ${
                          t.isActive
                            ? 'bg-[var(--desk-danger-bg)] text-[var(--desk-danger)] hover:bg-[var(--desk-danger-bg)]'
                            : 'bg-[var(--desk-active-bg)] text-[var(--desk-active)] hover:bg-[var(--desk-active-bg)]'
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
