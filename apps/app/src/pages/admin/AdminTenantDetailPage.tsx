import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowLeft, Loader2, Mail, Phone, MapPin } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { Card, CardHeader, Eyebrow, StatusBadge, AvatarChip } from '@unclutterdesk/ui';
import { AdminTenantDetail, formatNaira, formatDate } from './adminTypes';

const TIERS = ['STARTER', 'PRO', 'CLINIC'] as const;

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tenant, isLoading, mutate } = useSWR<AdminTenantDetail>(
    id ? `/v1/admin/tenants/${id}` : null,
  );
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeTier = async (tier: string) => {
    if (!id) return;
    setUpdating(`tier:${tier}`);
    setError(null);
    try {
      const updated = await api.patch<{ id: string; subscriptionTier: string }>(
        `/v1/admin/tenants/${id}`,
        { subscriptionTier: tier },
      );
      await mutate(
        (t) => (t ? { ...t, subscriptionTier: updated.subscriptionTier } : t),
        { revalidate: false },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const toggleActive = async () => {
    if (!id || !tenant) return;
    setUpdating('active');
    setError(null);
    try {
      const updated = await api.patch<{ id: string; isActive: boolean }>(`/v1/admin/tenants/${id}`, {
        isActive: !tenant.isActive,
      });
      await mutate(
        (t) => (t ? { ...t, isActive: updated.isActive } : t),
        { revalidate: false },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  if (isLoading || !tenant) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#94A3B8]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tenant…
      </div>
    );
  }

  const initials = tenant.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="flex-1 min-w-0 px-[32px] py-[28px] max-w-[1100px] w-full">
      <Link
        to="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#64748B] hover:text-[#0F3A53]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All tenants
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-[22px] text-white flex items-center justify-center font-extrabold text-xl shrink-0 shadow-sm"
            style={{ backgroundColor: tenant.primaryColor || '#0F3A53' }}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">{tenant.name}</h1>
              <StatusBadge status={tenant.isActive ? 'Active' : 'Inactive'} />
            </div>
            <div className="text-[13px] text-[#64748B] mt-1">
              {tenant.slug}.unclutterdesk.com{tenant.customDomain ? ` · ${tenant.customDomain}` : ''} · Joined{' '}
              {formatDate(tenant.createdAt)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleActive}
          disabled={updating === 'active'}
          className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-[12px] text-[13px] font-bold cursor-pointer transition-colors disabled:opacity-50 ${
            tenant.isActive
              ? 'bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6]'
              : 'bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5]'
          }`}
        >
          {updating === 'active' && <Loader2 className="h-4 w-4 animate-spin" />}
          {tenant.isActive ? 'Pause practice' : 'Activate practice'}
        </button>
      </div>

      {error && (
        <p className="mt-4 text-xs font-medium text-red-600 bg-red-50 rounded-[12px] px-3.5 py-2.5">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {[
          { label: 'Subscription tier', value: tenant.subscriptionTier },
          { label: 'Clients', value: String(tenant.clients) },
          { label: 'Bookings', value: String(tenant.bookings) },
          { label: 'Revenue', value: formatNaira(tenant.revenueKobo) },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-[18px] border border-[#E2E8F0] p-[16px_18px] shadow-[0_1px_3px_0_rgba(15,23,42,0.06)]">
            <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0F172A] block leading-none">
              {s.value}
            </span>
            <span className="text-[11px] text-[#64748B] font-medium block mt-2">{s.label}</span>
          </div>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader
          eyebrow="Billing"
          title="Subscription"
          action={
            <div className="flex items-center gap-1.5">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => changeTier(tier)}
                  disabled={updating === `tier:${tier}` || tenant.subscriptionTier === tier}
                  className={`h-8 px-3 rounded-[10px] text-[12px] font-bold cursor-pointer transition-colors disabled:cursor-default ${
                    tenant.subscriptionTier === tier
                      ? 'bg-[#0F3A53] text-white'
                      : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                  }`}
                >
                  {updating === `tier:${tier}` ? '…' : tier}
                </button>
              ))}
            </div>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px] text-[#475569]">
          <div className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 text-[#94A3B8]" /> {tenant.publicEmail || 'No public email'}
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="h-4 w-4 text-[#94A3B8]" /> {tenant.publicPhone || 'No public phone'}
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 text-[#94A3B8]" /> {tenant.city || '—'}
            {tenant.address ? `, ${tenant.address}` : ''}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader eyebrow="Team" title={`Staff (${tenant.staff.length})`} />
          <div className="space-y-3">
            {tenant.staff.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No staff members yet.</p>
            )}
            {tenant.staff.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <AvatarChip
                  size="sm"
                  initials={s.name.split(' ').slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?'}
                  src={s.avatarUrl}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#0F172A] truncate">{s.name}</div>
                  <div className="text-[11.5px] text-[#94A3B8]">{s.role} · {s.email}</div>
                </div>
                <div className="ml-auto">
                  <StatusBadge status={s.status === 'active' ? 'Active' : 'Inactive'} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Clients" title={`Recent clients (${tenant.recentClients.length})`} />
          <div className="space-y-3">
            {tenant.recentClients.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No clients yet.</p>
            )}
            {tenant.recentClients.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <AvatarChip
                  size="sm"
                  initials={c.name.split(' ').slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?'}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#0F172A] truncate">{c.name}</div>
                  <div className="text-[11.5px] text-[#94A3B8]">{c.email}</div>
                </div>
                <div className="ml-auto">
                  <StatusBadge status={c.status === 'active' ? 'Active' : 'Inactive'} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader eyebrow="Activity" title={`Recent bookings (${tenant.recentBookings.length})`} />
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Client</th>
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Service</th>
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Scheduled</th>
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[#94A3B8]">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenant.recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-[13px] text-[#94A3B8]">No bookings yet.</td>
                </tr>
              )}
              {tenant.recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="py-3.5 text-[13px] font-bold text-[#0F172A]">{b.client}</td>
                  <td className="py-3.5 text-[13px] text-[#475569]">{b.service}</td>
                  <td className="py-3.5 text-[12.5px] text-[#64748B]">
                    {b.startsAt
                      ? new Date(b.startsAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="py-3.5">
                    <StatusBadge status={b.status.charAt(0) + b.status.slice(1).toLowerCase()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
