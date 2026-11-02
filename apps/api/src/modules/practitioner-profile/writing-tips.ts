/**
 * Writing tips (spec §6.7): rule-based, warnings only, never blocking. Run
 * over the therapist's own free text (headline, about, approach,
 * qualifications). Each tip names the field and what to do instead.
 */

export type TipKind = 'outcome-claim' | 'superlative' | 'client-detail' | 'phone-number';
export type TipSeverity = 'suggestion' | 'strong';

export interface WritingTip {
  field: string;
  kind: TipKind;
  severity: TipSeverity;
  /** The words that triggered it, as written. */
  match: string;
  message: string;
}

const RULES: { kind: TipKind; severity: TipSeverity; pattern: RegExp; message: string }[] = [
  {
    kind: 'outcome-claim',
    severity: 'suggestion',
    pattern: /\b(success rate|\d{1,3}\s?% of (?:my )?clients|guarantee[ds]?|cure[ds]?|cures?)\b/gi,
    message: 'Outcome claims can mislead. Describe your approach and experience instead.',
  },
  {
    kind: 'superlative',
    severity: 'suggestion',
    pattern: /\b(the best|best (?:therapist|counsellor|counselor|psychologist)|no\.?\s?1|number one|#1|top[- ]rated)\b/gi,
    message: 'Superlatives read as marketing. Specific, factual wording builds more trust.',
  },
  {
    kind: 'client-detail',
    severity: 'strong',
    // Case-sensitive on purpose: a capitalised name is what makes it identifying.
    pattern:
      /\b(?:(?:[Mm]y|[Aa]|[Oo]ne) (?:client|patient),? (?:named|called) [A-Z][a-z]+|(?:[Cc]lient|[Pp]atient) [A-Z][a-z]+ (?:who|came|told|was)|(?:[Mm]rs?|[Mm]s|[Mm]iss)\.? [A-Z][a-z]+ (?:came|told|was|who))/g,
    message: 'This may identify a client. Remove it to protect client confidentiality.',
  },
  {
    kind: 'phone-number',
    severity: 'suggestion',
    pattern: /(?:\+?234[\s-]?|\b0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b|\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g,
    message: 'Phone numbers in your text get copied and spammed. Use the contact fields or booking instead.',
  },
];

export function writingTips(fields: Record<string, string | null | undefined>): WritingTip[] {
  const tips: WritingTip[] = [];
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    for (const rule of RULES) {
      const seen = new Set<string>();
      for (const m of text.matchAll(rule.pattern)) {
        const match = m[0].trim();
        if (seen.has(match.toLowerCase())) continue;
        seen.add(match.toLowerCase());
        tips.push({ field, kind: rule.kind, severity: rule.severity, match, message: rule.message });
      }
    }
  }
  return tips;
}
