import { BadRequestException } from '@nestjs/common';

export interface EmergencyContact {
  name: string;
  relationship: string | null;
  phone: string | null;
}

export interface EmergencyContactInput {
  name?: string | null;
  relationship?: string | null;
  phone?: string | null;
}

type Columns = {
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
};

const clean = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s ? s : null;
};

/**
 * The columns to write. `legacy` is the single "emergency" box older app
 * builds still send; it becomes the name.
 */
export function emergencyContactData(input: EmergencyContactInput | undefined, legacy?: string): Columns {
  if (input) {
    const name = clean(input.name, 120);
    const relationship = clean(input.relationship, 60);
    const phone = clean(input.phone, 40);
    if (!name && (relationship || phone)) {
      throw new BadRequestException('Add the emergency contact’s name too.');
    }
    return { emergencyContactName: name, emergencyContactRelationship: relationship, emergencyContactPhone: phone };
  }
  const old = clean(legacy, 120);
  return old ? { emergencyContactName: old } : {};
}

export function emergencyContactOf(p: {
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
}): EmergencyContact | null {
  if (!p.emergencyContactName) return null;
  return { name: p.emergencyContactName, relationship: p.emergencyContactRelationship, phone: p.emergencyContactPhone };
}

export function emergencyContactText(c: EmergencyContact | null): string {
  if (!c) return '';
  return [c.relationship ? `${c.name} (${c.relationship})` : c.name, c.phone].filter(Boolean).join(' · ');
}
