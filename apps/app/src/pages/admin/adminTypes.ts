export interface AdminStats {
  tenants: number;
  activeTenants: number;
  staffCount: number;
  clientCount: number;
  bookings: number;
  forms: number;
  users: number;
  revenueKobo: number;
}

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  category: string | null;
  city: string | null;
  subscriptionTier: string;
  isActive: boolean;
  primaryColor: string;
  secondaryColor: string;
  createdAt: string;
  clients: number;
  bookings: number;
  services: number;
  revenueKobo: number;
}

export interface AdminTenantStaff {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
}

export interface AdminTenantDetail extends AdminTenant {
  address?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  primaryColor: string;
  secondaryColor: string;
  staff: AdminTenantStaff[];
  recentClients: { id: string; email: string; name: string; status: string }[];
  recentBookings: { id: string; status: string; client: string; service: string; startsAt: string | null }[];
}

export function formatNaira(kobo: number): string {
  return (
    '₦' +
    (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })
  );
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
