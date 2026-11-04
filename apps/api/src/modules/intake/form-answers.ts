/**
 * A form submission's answers as people read them: each with its question's
 * label from the form, in the form's order, and a readable value. Used
 * wherever answers are shown (submissions, session prep, the client page),
 * so a raw field key like "preferred_name" never reaches a screen.
 */
export interface FormFieldLike {
  id?: string;
  label?: string;
  type?: string;
}

export interface LabelledAnswer {
  id: string;
  label: string;
  type: string;
  value: unknown;
  /** The value as text: lists joined, yes/no, and "—" for nothing. */
  display: string;
}

/** "preferred_name" or "anythingElse" → "Preferred name" / "Anything else", for a field the form no longer has. */
export function humaniseKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((v) => displayValue(v)).join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value).trim();
  return text || '—';
}

export function labelledAnswers(schemaJson: unknown, answersJson: unknown): LabelledAnswer[] {
  const fields = Array.isArray(schemaJson) ? (schemaJson as FormFieldLike[]) : [];
  const answers = answersJson && typeof answersJson === 'object' && !Array.isArray(answersJson) ? (answersJson as Record<string, unknown>) : {};
  const out: LabelledAnswer[] = [];
  const used = new Set<string>();
  for (const field of fields) {
    if (!field.id || !(field.id in answers)) continue;
    used.add(field.id);
    const value = answers[field.id];
    out.push({ id: field.id, label: field.label?.trim() || humaniseKey(field.id), type: field.type || 'text', value, display: displayValue(value) });
  }
  for (const [id, value] of Object.entries(answers)) {
    if (used.has(id)) continue;
    out.push({ id, label: humaniseKey(id), type: 'text', value, display: displayValue(value) });
  }
  return out;
}
