import { describe, it, expect } from 'vitest';
import { CLIENT_NAV, CLIENT_BOTTOM_NAV, clientSections } from '../clientNav';

describe('client menu', () => {
  it('lists the five portal pages in order', () => {
    expect(CLIENT_NAV.map((i) => [i.label, i.href])).toEqual([
      ['Home', '/portal'],
      ['Sessions', '/portal/sessions'],
      ['Forms & assessments', '/portal/forms'],
      ['Payments', '/portal/payments'],
      ['My details', '/portal/details'],
    ]);
  });

  it('gives phones Home, Sessions, Forms and Payments', () => {
    expect(CLIENT_BOTTOM_NAV.map((i) => i.label)).toEqual(['Home', 'Sessions', 'Forms', 'Payments']);
  });

  it('badges Forms & assessments only when something is waiting', () => {
    const item = (n?: number) => clientSections(n)[0].groups[0].items.find((i) => i.href === '/portal/forms')!;
    expect(item(0).badge).toBeUndefined();
    expect(item(undefined).badge).toBeUndefined();
    expect(item(2).badge).toBeTruthy();
  });
});
