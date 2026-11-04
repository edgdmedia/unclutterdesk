import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowLeft, Loader2, Mail, Phone, MapPin } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { Card, CardHeader, Eyebrow, StatusBadge, AvatarChip, useToast } from '@unclutterdesk/ui';
import { AdminTenantDetail, formatNaira, formatDate } from './adminTypes';
import { ComplimentaryPlanForm, describePlan, type PlanView } from './ComplimentaryPlanForm';
import { TIER_NAMES, type Tier } from '../../utils/entitlements';
import { TENANT_ROOT_DOMAIN } from '../../config/domains';


export function AdminTenantDetailPage() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const { data: tenant, isLoading, mutate } = useSWR<AdminTenantDetail>(
    id ? `/v1/admin/tenants/${id}` : null,
  );
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planSaved = (plan: PlanView) => {
    void mutate((t) => (t ? { ...t, ...plan } : t), { revalidate: false });
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
      toast.success('Practice status updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the practice');
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const toggleEcosystem = async () => {
    if (!id || !tenant) return;
    const next = !tenant.ecosystemIntegrationEnabled;
    if (next && !window.confirm(`Link ${tenant.name} to the Unclutter Suite? Its clients will see Suite invitations.`)) {
      return;
    }
    setUpdating('ecosystem');
    setError(null);
    try {
      const updated = await api.patch<{ id: string; ecosystemIntegrationEnabled: boolean }>(
        `/v1/admin/tenants/${id}`,
        { ecosystemIntegrationEnabled: next },
      );
      await mutate(
        (t) => (t ? { ...t, ecosystemIntegrationEnabled: updated.ecosystemIntegrationEnabled } : t),
        { revalidate: false },
      );
      toast.success(updated.ecosystemIntegrationEnabled ? 'Suite integration on' : 'Suite integration off');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update Suite integration');
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  if (isLoading || !tenant) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--desk-text-subtle)]">
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
        className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--desk-text-muted)] hover:text-[var(--desk-pine-600)]"
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
              <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">{tenant.name}</h1>
              <StatusBadge status={tenant.isActive ? 'Active' : 'Inactive'} />
            </div>
            <div className="text-[13px] text-[var(--desk-text-muted)] mt-1">
              {tenant.slug}.{TENANT_ROOT_DOMAIN}{tenant.customDomain ? ` · ${tenant.customDomain}` : ''} · Joined{' '}
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
              ? 'bg-[var(--desk-danger-bg)] text-[var(--desk-danger)] hover:bg-[var(--desk-danger-bg)]'
              : 'bg-[var(--desk-active-bg)] text-[var(--desk-active)] hover:bg-[var(--desk-active-bg)]'
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
          { label: 'Plan', value: TIER_NAMES[tenant.subscriptionTier as Tier] ?? tenant.subscriptionTier },
          { label: 'Clients', value: String(tenant.clients) },
          { label: 'Bookings', value: String(tenant.bookings) },
          { label: 'Revenue', value: formatNaira(tenant.revenueKobo) },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-[18px] border border-[var(--desk-border)] p-[16px_18px] shadow-[0_1px_3px_0_rgba(15,23,42,0.06)]">
            <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--desk-text)] block leading-none">
              {s.value}
            </span>
            <span className="text-[11px] text-[var(--desk-text-muted)] font-medium block mt-2">{s.label}</span>
          </div>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader
          eyebrow="Billing"
          title="Subscription"
          action={<span className="text-[12px] text-[var(--desk-text-muted)]">{describePlan(tenant)}</span>}
        />
        <div className="mb-4">
          <ComplimentaryPlanForm tenantId={tenant.id} plan={tenant} onSaved={planSaved} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px] text-[var(--desk-text-body)]">
          <div className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 text-[var(--desk-text-subtle)]" /> {tenant.publicEmail || 'No public email'}
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="h-4 w-4 text-[var(--desk-text-subtle)]" /> {tenant.publicPhone || 'No public phone'}
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 text-[var(--desk-text-subtle)]" /> {tenant.city || '—'}
            {tenant.address ? `, ${tenant.address}` : ''}
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          eyebrow="Ecosystem"
          title="Unclutter Suite integration"
          action={
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(tenant.ecosystemIntegrationEnabled)}
              aria-label="Unclutter Suite integration"
              onClick={toggleEcosystem}
              disabled={updating === 'ecosystem'}
              className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                tenant.ecosystemIntegrationEnabled ? 'bg-[var(--desk-pine-600)]' : 'bg-[var(--desk-pine-200)]'
              }`}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                style={{ left: tenant.ecosystemIntegrationEnabled ? 22 : 2 }}
              />
            </button>
          }
        />
        <p className="text-[13px] text-[var(--desk-text-body)] leading-relaxed">
          {tenant.ecosystemIntegrationEnabled
            ? 'On. Journal can send clients to this practice, and its clients are invited to link an Unclutter account after their first session summary.'
            : 'Off. This practice has no link to the Unclutter Suite: no Journal referrals, no Suite invitations, no bridge endpoints.'}
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader eyebrow="Team" title={`Staff (${tenant.staff.length})`} />
          <div className="space-y-3">
            {tenant.staff.length === 0 && (
              <p className="text-[13px] text-[var(--desk-text-subtle)]">No staff members yet.</p>
            )}
            {tenant.staff.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <AvatarChip
                  size="sm"
                  initials={s.name.split(' ').slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?'}
                  src={s.avatarUrl}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[var(--desk-text)] truncate">{s.name}</div>
                  <div className="text-[11.5px] text-[var(--desk-text-subtle)]">{s.role} · {s.email}</div>
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
              <p className="text-[13px] text-[var(--desk-text-subtle)]">No clients yet.</p>
            )}
            {tenant.recentClients.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <AvatarChip
                  size="sm"
                  initials={c.name.split(' ').slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?'}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[var(--desk-text)] truncate">{c.name}</div>
                  <div className="text-[11.5px] text-[var(--desk-text-subtle)]">{c.email}</div>
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
              <tr className="border-b border-[var(--desk-border)]">
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Client</th>
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Service</th>
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Scheduled</th>
                <th className="pb-3 text-[10px] font-black tracking-[0.16em] uppercase text-[var(--desk-text-subtle)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenant.recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-[13px] text-[var(--desk-text-subtle)]">No bookings yet.</td>
                </tr>
              )}
              {tenant.recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-[var(--desk-border-soft)] last:border-0">
                  <td className="py-3.5 text-[13px] font-bold text-[var(--desk-text)]">{b.client}</td>
                  <td className="py-3.5 text-[13px] text-[var(--desk-text-body)]">{b.service}</td>
                  <td className="py-3.5 text-[12.5px] text-[var(--desk-text-muted)]">
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
