import { describe, expect, it } from 'vitest';
import { practiceNotFoundResponse } from './not-found';

describe('the practice-not-found page', () => {
  it('links home to the configured marketing site', async () => {
    const res = practiceNotFoundResponse('nope.example', 'https://therapysts.com');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('href="https://therapysts.com"');
  });

  it('escapes the host and the link', async () => {
    const body = await practiceNotFoundResponse('<b>x</b>', 'https://a.example/"x').text();
    expect(body).not.toContain('<b>x</b>');
    expect(body).toContain('href="https://a.example/&quot;x"');
  });
});
