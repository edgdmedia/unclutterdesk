export interface TenantBrand {
  id: string;
  name: string;
  slug: string;
  customDomain?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  cancellationHours: number;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
}

export interface TherapistProfile {
  profileId: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  publicUsername?: string;
  specialty?: string;
  credentials?: string;
  yearsExperience?: number;
  welcomeMessage?: string;
  modalities?: string[];
  languages?: string[];
  isPublic: boolean;
  status: 'active' | 'inactive' | 'pending';
}

export interface ConsultServiceItem {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  priceKobo: number;
  isActive: boolean;
}

export interface AvailabilitySlot {
  id: string;
  providerProfileId: string;
  serviceId?: string;
  startsAt: string;
  endsAt: string;
  channel: string;
  isActive: boolean;
}

export interface CreateBookingDto {
  serviceId: string;
  availabilityId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
  discountCode?: string;
}

export interface BookingResult {
  id: string;
  status: string;
  serviceTitle: string;
  startsAt: string;
  videoRoomLink?: string;
  therapistName: string;
}

export * from './joinWindow';
