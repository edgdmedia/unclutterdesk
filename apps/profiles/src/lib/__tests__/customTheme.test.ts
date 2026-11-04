import { describe, expect, it } from 'vitest';
import { GET } from '../../pages/theme/[hex].css';

const call = (hex: string) => (GET as any)({ params: { hex } }) as Response;

describe('custom colour stylesheet', () => {
  it('serves Calm with the readable accent for a valid colour, cached for a year', async () => {
    const res = call('FFEB3B');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
    const css = await res.text();
    expect(css).toMatch(/^\.theme-custom\{--bg:#F7FAFE;/);
    expect(css).not.toContain('--accent:#FFEB3B');
  });

  it('refuses anything that is not one uppercase 6-digit hex', () => {
    for (const bad of ['ffeb3b', 'FFF', 'GGGGGG', '..%2F', 'FFEB3B;color:red']) expect(call(bad).status).toBe(404);
  });
});
