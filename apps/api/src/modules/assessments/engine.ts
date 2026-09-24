/**
 * The assessment engine.
 *
 * An instrument is data, not code: its questions, answer scale, score bands,
 * subscales and risk rules are all in its definition, which the platform
 * stores and platform admins can edit. This file only knows how to check a
 * definition and apply it to a client's answers.
 *
 * Every band and rule can carry two pieces of wording: one for the clinician,
 * one for the client. Clients are never shown clinical labels unless the
 * instrument says so.
 *
 * These are screening tools. Results support a clinician's judgement; they are
 * not a diagnosis.
 */

export type Level = 0 | 1 | 2 | 3 | 4;
export type Tier = 'STARTER' | 'PRO' | 'CLINIC';
export type Comparison = '>=' | '>' | '==' | '<=' | '<';

export interface Band {
  /** Lowest score in this band. Bands are listed from the lowest up. */
  min: number;
  /** The clinical label, e.g. "Moderately severe". */
  label: string;
  /** 0 (none) to 4 (most severe); drives colour and sorting. */
  level: Level;
  /** What this band suggests, for the clinician. */
  clinicianText?: string;
  /** Plain-language wording for the client. */
  clientText?: string;
}

export interface SubscaleDefinition {
  key: string;
  label: string;
  items: string[];
  /** e.g. 2 for DASS-21, whose subscales are doubled to match DASS-42 norms. */
  multiplier?: number;
  bands?: Band[];
}

export interface RuleDefinition {
  key: string;
  /** What the rule looks at: one item, a subscale, or the total. */
  when: { item?: string; subscale?: string; total?: true; op: Comparison; value: number };
  /** "urgent" alerts the practice on every channel. */
  level: 'attention' | 'urgent';
  clinicianMessage: string;
  /** Shown to the client when the rule fires, e.g. where to get help now. */
  clientMessage?: string;
}

export interface InstrumentDefinition {
  key: string;
  name: string;
  shortName: string;
  measures: string;
  instructions: string;
  estimatedMinutes: number;
  /** The lowest plan that can use it. */
  tier: Tier;
  /** What the client sees afterwards: their score too, only the wording, or only a thank-you. */
  clientResults: 'score_and_summary' | 'summary' | 'none';
  scale: Array<{ value: number; label: string }>;
  items: Array<{ id: string; text: string }>;
  scoring: {
    /** Total of these items (default: all), times the multiplier; or the sum of subscales. */
    total: { from: 'items' | 'subscales'; items?: string[]; multiplier?: number };
    bands?: Band[];
    subscales?: SubscaleDefinition[];
    /** How the headline is chosen: the total's band, or the most severe subscale. */
    headline: 'total' | 'worst_subscale';
    /** Headline when every subscale is in its lowest band. */
    allClearLabel?: string;
    allClearClientText?: string;
  };
  rules: RuleDefinition[];
  /** Where the wording and scoring come from. */
  source?: string;
}

export interface Severity {
  label: string;
  level: Level;
}

export interface SubscaleResult {
  key: string;
  label: string;
  score: number;
  max: number;
  severity: Severity | null;
  clinicianText?: string;
  clientText?: string;
}

export interface FlagResult {
  key: string;
  level: 'attention' | 'urgent';
  message: string;
  clientMessage?: string;
}

export interface AssessmentResult {
  totalScore: number;
  maxScore: number;
  severity: Severity;
  clinicianText?: string;
  subscales: SubscaleResult[];
  flags: FlagResult[];
  /** Exactly what the client may see. */
  client: {
    show: InstrumentDefinition['clientResults'];
    headline?: string;
    summary?: string;
    score?: number;
    maxScore?: number;
    subscales?: Array<{ label: string; text?: string }>;
    messages: string[];
  };
}

// ── Checking a definition ──────────────────────────────────────────────

const OPS: Comparison[] = ['>=', '>', '==', '<=', '<'];
const TIERS: Tier[] = ['STARTER', 'PRO', 'CLINIC'];
const TIER_RANK: Record<Tier, number> = { STARTER: 0, PRO: 1, CLINIC: 2 };

export function tierIncludes(plan: string | null | undefined, needed: Tier): boolean {
  const rank = TIER_RANK[(plan || 'STARTER').toUpperCase() as Tier] ?? 0;
  return rank >= TIER_RANK[needed];
}

function checkBands(where: string, bands: Band[] | undefined, errors: string[]) {
  if (!bands) return;
  if (!Array.isArray(bands) || bands.length === 0) {
    errors.push(`${where}: bands must be a non-empty list.`);
    return;
  }
  bands.forEach((b, i) => {
    if (typeof b?.min !== 'number') errors.push(`${where}: band ${i + 1} needs a numeric min.`);
    if (!b?.label) errors.push(`${where}: band ${i + 1} needs a label.`);
    if (![0, 1, 2, 3, 4].includes(b?.level)) errors.push(`${where}: band ${i + 1} level must be 0 to 4.`);
    if (i > 0 && b.min <= bands[i - 1].min) errors.push(`${where}: bands must go up in order of min.`);
  });
}

/** Every problem with a definition, in words an admin can act on. Empty when valid. */
export function validateDefinition(def: unknown): string[] {
  const errors: string[] = [];
  const d = def as InstrumentDefinition;
  if (!d || typeof d !== 'object') return ['The definition must be a JSON object.'];

  if (!/^[A-Z0-9_]{2,40}$/.test(d.key ?? '')) errors.push('key must be 2–40 capital letters, digits or underscores, e.g. PHQ_9.');
  for (const field of ['name', 'shortName', 'measures', 'instructions'] as const) {
    if (!d[field] || typeof d[field] !== 'string') errors.push(`${field} is required.`);
  }
  if (!Number.isInteger(d.estimatedMinutes) || d.estimatedMinutes < 1) errors.push('estimatedMinutes must be a whole number of minutes.');
  if (!TIERS.includes(d.tier)) errors.push(`tier must be one of ${TIERS.join(', ')}.`);
  if (!['score_and_summary', 'summary', 'none'].includes(d.clientResults)) {
    errors.push('clientResults must be score_and_summary, summary or none.');
  }

  if (!Array.isArray(d.scale) || d.scale.length < 2) errors.push('scale needs at least two answer choices.');
  else {
    const values = d.scale.map((s) => s?.value);
    if (values.some((v) => !Number.isInteger(v))) errors.push('Each scale choice needs a whole-number value.');
    if (new Set(values).size !== values.length) errors.push('Scale values must be different from each other.');
    if (d.scale.some((s) => !s?.label)) errors.push('Each scale choice needs a label.');
  }

  const itemIds = new Set<string>();
  if (!Array.isArray(d.items) || d.items.length === 0) errors.push('items needs at least one question.');
  else {
    d.items.forEach((item, i) => {
      if (!/^[a-z0-9_]{1,40}$/.test(item?.id ?? '')) errors.push(`Question ${i + 1} needs an id of lowercase letters, digits or underscores.`);
      if (!item?.text) errors.push(`Question ${i + 1} needs text.`);
      if (itemIds.has(item?.id)) errors.push(`Question id ${item.id} is used twice.`);
      itemIds.add(item?.id);
    });
  }

  const s = d.scoring;
  const subscaleKeys = new Set<string>();
  if (!s || typeof s !== 'object') errors.push('scoring is required.');
  else {
    if (!['items', 'subscales'].includes(s.total?.from)) errors.push('scoring.total.from must be items or subscales.');
    for (const id of s.total?.items ?? []) if (!itemIds.has(id)) errors.push(`scoring.total.items names an unknown question ${id}.`);
    checkBands('scoring.bands', s.bands, errors);
    for (const sub of s.subscales ?? []) {
      if (!sub?.key || !sub?.label) errors.push('Each subscale needs a key and a label.');
      if (subscaleKeys.has(sub.key)) errors.push(`Subscale ${sub.key} is listed twice.`);
      subscaleKeys.add(sub.key);
      if (!Array.isArray(sub.items) || sub.items.length === 0) errors.push(`Subscale ${sub.key} needs questions.`);
      for (const id of sub.items ?? []) if (!itemIds.has(id)) errors.push(`Subscale ${sub.key} names an unknown question ${id}.`);
      checkBands(`Subscale ${sub.key}`, sub.bands, errors);
    }
    if (s.total?.from === 'subscales' && subscaleKeys.size === 0) errors.push('A total from subscales needs subscales.');
    if (s.headline === 'total' && !s.bands) errors.push('A headline from the total needs scoring.bands.');
    if (s.headline === 'worst_subscale' && !(s.subscales ?? []).some((x) => x.bands)) {
      errors.push('A headline from the worst subscale needs subscales with bands.');
    }
    if (!['total', 'worst_subscale'].includes(s.headline)) errors.push('scoring.headline must be total or worst_subscale.');
  }

  const ruleKeys = new Set<string>();
  if (!Array.isArray(d.rules)) errors.push('rules must be a list (it can be empty).');
  else {
    d.rules.forEach((r, i) => {
      const where = `Rule ${r?.key || i + 1}`;
      if (!r?.key) errors.push(`Rule ${i + 1} needs a key.`);
      if (ruleKeys.has(r?.key)) errors.push(`${where} is listed twice.`);
      ruleKeys.add(r?.key);
      const w = r?.when;
      const targets = [w?.item, w?.subscale, w?.total].filter((x) => x !== undefined).length;
      if (targets !== 1) errors.push(`${where}: "when" must name exactly one of item, subscale or total.`);
      if (w?.item !== undefined && !itemIds.has(w.item)) errors.push(`${where} names an unknown question ${w.item}.`);
      if (w?.subscale !== undefined && !subscaleKeys.has(w.subscale)) errors.push(`${where} names an unknown subscale ${w.subscale}.`);
      if (!OPS.includes(w?.op)) errors.push(`${where}: op must be one of ${OPS.join(' ')}.`);
      if (typeof w?.value !== 'number') errors.push(`${where} needs a numeric value.`);
      if (!['attention', 'urgent'].includes(r?.level)) errors.push(`${where}: level must be attention or urgent.`);
      if (!r?.clinicianMessage) errors.push(`${where} needs a clinicianMessage.`);
    });
  }
  return errors;
}

// ── Scoring ─────────────────────────────────────────────────────────────

const compare = (a: number, op: Comparison, b: number) =>
  op === '>=' ? a >= b : op === '>' ? a > b : op === '==' ? a === b : op === '<=' ? a <= b : a < b;

function bandFor(score: number, bands: Band[] | undefined): Band | null {
  if (!bands?.length) return null;
  let found = bands[0];
  for (const b of bands) if (score >= b.min) found = b;
  return found;
}

const maxValue = (def: InstrumentDefinition) => Math.max(...def.scale.map((s) => s.value));
const sum = (answers: Record<string, number>, ids: string[]) => ids.reduce((t, id) => t + (answers[id] ?? 0), 0);

/** Applies an instrument's definition to answers already checked by validateAnswers. */
export function score(def: InstrumentDefinition, answers: Record<string, number>): AssessmentResult {
  const top = maxValue(def);
  const subscales: SubscaleResult[] = (def.scoring.subscales ?? []).map((sub) => {
    const m = sub.multiplier ?? 1;
    const value = sum(answers, sub.items) * m;
    const band = bandFor(value, sub.bands);
    return {
      key: sub.key,
      label: sub.label,
      score: value,
      max: sub.items.length * top * m,
      severity: band ? { label: band.label, level: band.level } : null,
      ...(band?.clinicianText ? { clinicianText: band.clinicianText } : {}),
      ...(band?.clientText ? { clientText: band.clientText } : {}),
    };
  });

  let totalScore: number;
  let maxScore: number;
  if (def.scoring.total.from === 'subscales') {
    totalScore = subscales.reduce((t, s) => t + s.score, 0);
    maxScore = subscales.reduce((t, s) => t + s.max, 0);
  } else {
    const ids = def.scoring.total.items ?? def.items.map((i) => i.id);
    const m = def.scoring.total.multiplier ?? 1;
    totalScore = sum(answers, ids) * m;
    maxScore = ids.length * top * m;
  }

  let severity: Severity;
  let clinicianText: string | undefined;
  let clientSummary: string | undefined;
  let clientHeadline: string | undefined;
  if (def.scoring.headline === 'worst_subscale') {
    const banded = subscales.filter((s) => s.severity);
    const worst = banded.reduce((w, s) => (s.severity!.level > w.severity!.level ? s : w), banded[0]);
    if (!worst || worst.severity!.level === 0) {
      severity = { label: def.scoring.allClearLabel ?? 'Within the normal range', level: 0 };
      clientSummary = def.scoring.allClearClientText;
    } else {
      severity = { label: `${worst.severity!.label} ${worst.label.toLowerCase()}`, level: worst.severity!.level };
      clinicianText = worst.clinicianText;
      clientSummary = worst.clientText;
    }
    clientHeadline = clientSummary ? undefined : severity.label;
  } else {
    const band = bandFor(totalScore, def.scoring.bands)!;
    severity = { label: band.label, level: band.level };
    clinicianText = band.clinicianText;
    clientSummary = band.clientText;
  }

  const flags: FlagResult[] = [];
  for (const rule of def.rules) {
    const w = rule.when;
    const value =
      w.item !== undefined ? answers[w.item] : w.subscale !== undefined ? subscales.find((s) => s.key === w.subscale)?.score : totalScore;
    if (value !== undefined && compare(value, w.op, w.value)) {
      flags.push({
        key: rule.key,
        level: rule.level,
        message: rule.clinicianMessage,
        ...(rule.clientMessage ? { clientMessage: rule.clientMessage } : {}),
      });
    }
  }

  const show = def.clientResults;
  const messages = flags.map((f) => f.clientMessage).filter((m): m is string => Boolean(m));
  return {
    totalScore,
    maxScore,
    severity,
    ...(clinicianText ? { clinicianText } : {}),
    subscales,
    flags,
    client:
      show === 'none'
        ? { show, messages }
        : {
            show,
            ...(clientHeadline ? { headline: clientHeadline } : {}),
            ...(clientSummary ? { summary: clientSummary } : {}),
            ...(show === 'score_and_summary' ? { score: totalScore, maxScore } : {}),
            ...(subscales.some((s) => s.clientText)
              ? { subscales: subscales.filter((s) => s.clientText).map((s) => ({ label: s.label, text: s.clientText })) }
              : {}),
            messages,
          },
  };
}

/**
 * Checks a client's answers: every question answered with one of the scale's
 * values. Returns the cleaned answers, or a message for the client.
 */
export function validateAnswers(def: InstrumentDefinition, raw: unknown): Record<string, number> | string {
  if (!raw || typeof raw !== 'object') return 'Answers are missing.';
  const allowed = new Set(def.scale.map((s) => s.value));
  const answers: Record<string, number> = {};
  for (const item of def.items) {
    const value = Number((raw as Record<string, unknown>)[item.id]);
    if (!Number.isInteger(value) || !allowed.has(value)) return 'Please answer every question.';
    answers[item.id] = value;
  }
  return answers;
}

/** What a practice or client may see of an instrument: no scoring or rules. */
export function publicDefinition(def: InstrumentDefinition) {
  return {
    key: def.key,
    name: def.name,
    shortName: def.shortName,
    measures: def.measures,
    instructions: def.instructions,
    estimatedMinutes: def.estimatedMinutes,
    tier: def.tier,
    scale: def.scale,
    items: def.items,
  };
}
