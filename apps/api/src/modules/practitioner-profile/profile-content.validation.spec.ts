import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_CONTENT_LIMITS,
  parseGuidance,
  parseGuidanceUpdate,
  parseTemplateSections,
  parseTemplateUpdate,
} from './profile-content.validation';

describe('profile content validation (§6.6)', () => {
  it('accepts a full template edit', () => {
    expect(
      parseTemplateUpdate({
        title: 'Counsellor in private practice',
        description: 'For counsellors seeing adults.',
        kind: 'COUNSELLOR',
        isActive: true,
        sortOrder: 10,
        reason: 'clarity pass',
        sections: {
          identity: { prompt: 'Who do you help?', example: 'Counsellor for adults' },
          about: { prompt: 'What is a first session like?', example: null },
        },
      }),
    ).toEqual({
      title: 'Counsellor in private practice',
      description: 'For counsellors seeing adults.',
      kind: 'COUNSELLOR',
      isActive: true,
      sortOrder: 10,
      reason: 'clarity pass',
      sections: {
        identity: { prompt: 'Who do you help?', example: 'Counsellor for adults' },
        about: { prompt: 'What is a first session like?', example: null },
      },
    });
  });

  it.each([
    ['unknown section', { sections: { favourite: { prompt: 'x' } } }],
    ['unknown section field', { sections: { identity: { prompt: 'x', colour: 'red' } } }],
    ['missing prompt', { sections: { identity: { example: 'x' } } }],
    ['empty prompt', { sections: { identity: { prompt: '   ' } } }],
    ['unknown top-level field', { title: 'x', colour: 'red' }],
    ['empty edit', {}],
  ])('rejects %s', (_name, body) => {
    expect(() => parseTemplateUpdate(body)).toThrow(BadRequestException);
  });

  it('rejects an unknown practitioner kind', () => {
    expect(() => parseTemplateUpdate({ kind: 'WIZARD' })).toThrow(/known practitioner kind/);
  });

  it('accepts null to clear a kind', () => {
    expect(parseTemplateUpdate({ kind: null }).kind).toBeNull();
  });

  it('rejects a fractional or wild sort order', () => {
    expect(() => parseTemplateUpdate({ sortOrder: 1.5 })).toThrow(/whole number/);
    expect(() => parseTemplateUpdate({ sortOrder: PROFILE_CONTENT_LIMITS.sortOrder + 1 })).toThrow(/whole number/);
  });

  it('bounds title, description, prompt and example lengths', () => {
    expect(() => parseTemplateUpdate({ title: 'x'.repeat(PROFILE_CONTENT_LIMITS.title + 1) })).toThrow(/at most/);
    expect(() => parseTemplateUpdate({ description: 'x'.repeat(PROFILE_CONTENT_LIMITS.description + 1) })).toThrow(/at most/);
    expect(() =>
      parseTemplateUpdate({ sections: { identity: { prompt: 'x'.repeat(PROFILE_CONTENT_LIMITS.prompt + 1) } } }),
    ).toThrow(/at most/);
    expect(() =>
      parseTemplateUpdate({
        sections: { about: { prompt: 'x', example: 'x'.repeat(PROFILE_CONTENT_LIMITS.example + 1) } },
      }),
    ).toThrow(/at most/);
  });

  it('accepts a partial guidance edit and trims it', () => {
    expect(parseGuidanceUpdate({ guidance: { about: '  Write to the reader.  ' }, reason: 'tone' })).toEqual({
      guidance: { about: 'Write to the reader.' },
      reason: 'tone',
    });
  });

  it('rejects empty or malformed guidance', () => {
    expect(() => parseGuidance({})).toThrow(/at least one section/);
    expect(() => parseGuidance({ unknown: 'Text' })).toThrow(/Unknown profile section/);
    expect(() => parseGuidance({ about: '   ' })).toThrow(/required/);
    expect(() => parseGuidance({ about: 42 })).toThrow(/must be text/);
    expect(() => parseGuidanceUpdate({})).toThrow(/guidance is required/);
    expect(() => parseGuidanceUpdate({ guidance: { about: 'x' }, extra: true })).toThrow(/unknown field/);
  });

  it('bounds guidance length', () => {
    expect(() => parseGuidance({ about: 'x'.repeat(PROFILE_CONTENT_LIMITS.guidance + 1) })).toThrow(/at most/);
  });

  it('keeps only the prompt when an example is omitted, so the stored one is preserved', () => {
    expect(parseTemplateSections({ about: { prompt: 'What is it like?' } })).toEqual({
      about: { prompt: 'What is it like?' },
    });
  });

  it('accepts null to remove a section', () => {
    expect(parseTemplateUpdate({ sections: { about: null } })).toEqual({ sections: { about: null } });
    expect(parseTemplateSections({ about: null, identity: { prompt: 'Who?' } })).toEqual({
      about: null,
      identity: { prompt: 'Who?' },
    });
  });
});