import { describe, it, expect } from 'vitest';
import { allowedFormats, asFormat, listPrice, mapsLink, priceFor, timeErrors } from './formats';

const both = { offersOnline: true, offersInPerson: true, locationIds: [1n] };
const onlineOnly = { offersOnline: true, offersInPerson: false, locationIds: [] };
const inPersonOnly = { offersOnline: false, offersInPerson: true, locationIds: [1n] };

describe('formats', () => {
  it('reads old VIDEO slots as online', () => {
    expect(asFormat('VIDEO')).toBe('ONLINE');
    expect(asFormat('in_person')).toBe('IN_PERSON');
    expect(asFormat('phone')).toBeNull();
  });

  it('an online-only therapist never gets in person, even at a time that allows it (rule 1)', () => {
    expect(allowedFormats({ allowsOnline: true, allowsInPerson: true, locationId: 1n }, onlineOnly)).toEqual({ online: true, inPerson: false, locationId: null });
  });

  it('in person needs a location where the therapist works (rule 1)', () => {
    expect(allowedFormats({ allowsOnline: false, allowsInPerson: true, locationId: 2n }, both)).toEqual({ online: false, inPerson: false, locationId: null });
    expect(allowedFormats({ allowsOnline: false, allowsInPerson: true, locationId: 1n }, both)).toEqual({ online: false, inPerson: true, locationId: 1n });
  });

  it('prices by format and refuses a format the service does not offer (rules 2, 5)', () => {
    const f = [{ format: 'ONLINE', priceKobo: 3000000n, isActive: true }, { format: 'IN_PERSON', priceKobo: 3500000n, isActive: false }];
    expect(priceFor(f, 'ONLINE')).toBe(3000000n);
    expect(priceFor(f, 'IN_PERSON')).toBeNull();
    expect(listPrice(f)).toBe(3000000n);
  });

  it('builds a Google Maps search link without a key', () => {
    expect(mapsLink('12 Admiralty Way, Lekki', 'Lagos')).toBe('https://www.google.com/maps/search/?api=1&query=12%20Admiralty%20Way%2C%20Lekki%2C%20Lagos');
  });

  it('explains a time the therapist cannot work', () => {
    expect(timeErrors({ formats: ['IN_PERSON'], locationId: 1n }, { ...onlineOnly, name: 'Ada' }, [1n])).toEqual(['Ada only works online. Turn on in-person for Ada first.']);
    expect(timeErrors({ formats: ['ONLINE'], locationId: null }, { ...inPersonOnly, name: 'Ada' }, [1n])).toEqual(["Ada doesn't see clients online. Turn on online for Ada first."]);
    expect(timeErrors({ formats: ['IN_PERSON'], locationId: null }, { ...both, name: 'Ada' }, [1n])).toEqual(['Choose where in-person sessions happen.']);
    expect(timeErrors({ formats: ['IN_PERSON'], locationId: 9n }, { ...both, name: 'Ada' }, [1n, 9n])).toEqual(["Ada doesn't work at that location. Add it under Ada's locations first."]);
    expect(timeErrors({ formats: [], locationId: null }, { ...both, name: 'Ada' }, [1n])).toEqual(['Choose online, in person, or both.']);
  });
});
