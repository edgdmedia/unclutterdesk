import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapsLink } from '../consult/formats';

const LIMITS = { name: 120, address: 240, city: 80, directions: 500 };

export interface LocationDto {
  name?: string;
  address?: string;
  city?: string;
  directions?: string | null;
}

/**
 * SET-06: the places a practice sees clients. Clients never pick a location —
 * it comes from the time they book — and they receive the address, directions
 * and a maps link after booking.
 */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private clean(dto: LocationDto, partial = false) {
    const out: { name?: string; address?: string; city?: string; directions?: string | null } = {};
    for (const key of ['name', 'address', 'city', 'directions'] as const) {
      if (dto[key] === undefined && partial) continue;
      const value = String(dto[key] ?? '').trim();
      if (key !== 'directions' && !value) {
        throw new BadRequestException(
          key === 'address' ? 'Add the street address.' : key === 'city' ? 'Add the city.' : 'Give the location a name.',
        );
      }
      if (value.length > LIMITS[key]) throw new BadRequestException(`Keep the ${key} under ${LIMITS[key]} characters.`);
      (out as any)[key] = key === 'directions' ? (value || null) : value;
    }
    return out;
  }

  private async view(tenantId: bigint, l: any) {
    const upcomingInPerson = await this.prisma.consultBooking.count({
      where: {
        tenantId,
        locationId: l.id,
        status: { not: 'CANCELLED' },
        availability: { startsAt: { gte: new Date() } },
      },
    });
    return {
      id: l.id.toString(),
      name: l.name,
      address: l.address,
      city: l.city,
      directions: l.directions ?? null,
      isActive: l.isActive,
      mapsUrl: mapsLink(l.address, l.city),
      upcomingInPerson,
    };
  }

  async list(tenantId: bigint) {
    const rows = await this.prisma.practiceLocation.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    return Promise.all(rows.map((l) => this.view(tenantId, l)));
  }

  async create(tenantId: bigint, dto: LocationDto) {
    const data = this.clean(dto);
    const clash = await this.prisma.practiceLocation.findFirst({ where: { tenantId, name: data.name, isActive: true } });
    if (clash) throw new BadRequestException('A location with that name already exists.');
    const l = await this.prisma.practiceLocation.create({
      data: { tenantId, name: data.name!, address: data.address!, city: data.city!, directions: data.directions ?? null },
    });
    return this.view(tenantId, l);
  }

  async update(tenantId: bigint, id: bigint, dto: LocationDto) {
    const existing = await this.prisma.practiceLocation.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Location not found');
    const data = this.clean(dto, true);
    if (data.name && data.name !== existing.name) {
      const clash = await this.prisma.practiceLocation.findFirst({ where: { tenantId, name: data.name, isActive: true, NOT: { id } } });
      if (clash) throw new BadRequestException('A location with that name already exists.');
    }
    await this.prisma.practiceLocation.updateMany({
      where: { id: existing.id, tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.directions !== undefined ? { directions: data.directions } : {}),
      },
    });
    const l = await this.prisma.practiceLocation.findFirst({ where: { id: existing.id, tenantId } });
    return this.view(tenantId, l);
  }

  /**
   * Rule 9: refuse while future in-person bookings use it. Otherwise take in
   * person off every weekly time and open slot that pointed here — deleting
   * any that are then neither online nor in person — and report how many
   * changed. (Slot regeneration from the pattern lands in Task 5; the in-place
   * edits here already leave every open row correct.)
   */
  async deactivate(tenantId: bigint, id: bigint) {
    const existing = await this.prisma.practiceLocation.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Location not found');

    const total = await this.prisma.consultBooking.count({
      where: { tenantId, locationId: id, status: { not: 'CANCELLED' }, availability: { startsAt: { gte: new Date() } } },
    });
    if (total > 0) {
      const rows = await this.prisma.consultBooking.findMany({
        where: { tenantId, locationId: id, status: { not: 'CANCELLED' }, availability: { startsAt: { gte: new Date() } } },
        include: { client: { select: { firstName: true, lastName: true } }, availability: { select: { startsAt: true } } },
        take: 5,
      });
      const who = rows.map((b: any) => {
        const name = [b.client?.firstName, b.client?.lastName].filter(Boolean).join(' ') || 'a client';
        const day = b.availability?.startsAt ? new Date(b.availability.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : '';
        return `${name} (${day})`;
      });
      throw new BadRequestException(`${total} upcoming in-person ${total === 1 ? 'session uses' : 'sessions use'} ${existing.name}: ${who.join('; ')}${total > rows.length ? '; …' : ''}.`);
    }

    await this.prisma.practiceLocation.updateMany({ where: { id, tenantId }, data: { isActive: false } });
    await this.prisma.therapistLocation.deleteMany({ where: { locationId: id } });
    const weekly = await this.prisma.therapistWeeklyTime.updateMany({
      where: { locationId: id },
      data: { allowsInPerson: false, locationId: null },
    });
    const open = await this.prisma.consultAvailability.updateMany({
      where: { tenantId, locationId: id, isActive: true, startsAt: { gte: new Date() } },
      data: { allowsInPerson: false, locationId: null },
    });
    // Times left allowing neither are no longer times at all.
    await this.prisma.consultAvailability.deleteMany({
      where: { tenantId, isActive: true, startsAt: { gte: new Date() }, locationId: null, allowsInPerson: false, allowsOnline: false },
    });
    await this.prisma.therapistWeeklyTime.deleteMany({
      where: { locationId: null, allowsInPerson: false, allowsOnline: false },
    });
    return { deactivated: true, changedTimes: weekly.count + open.count };
  }
}
