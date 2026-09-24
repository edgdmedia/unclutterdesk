/** Shapes returned by /v1/assessments. Scoring stays on the server. */
export interface AssessmentDefinition {
  key: string;
  name: string;
  shortName: string;
  measures: string;
  instructions: string;
  scale: string[];
  items: Array<{ id: string; text: string }>;
  estimatedMinutes: number;
}

export interface LibraryEntry extends AssessmentDefinition {
  enabled: boolean;
}

export interface AssessmentSubscale {
  key: string;
  label: string;
  score: number;
  max: number;
  severity: { label: string; level: number };
}

export interface AssessmentResultRow {
  id: string;
  instrumentKey: string;
  shortName: string;
  totalScore: number;
  maxScore: number | null;
  severity: string;
  severityLevel: number;
  subscales: AssessmentSubscale[];
  flags: Array<{ key: string; message: string }>;
  answers: Record<string, number>;
  completedAt: string;
}

export interface PendingAssessment {
  id: string;
  instrumentKey: string;
  shortName: string;
  sentAt: string;
  expiresAt: string;
}

export interface AssessmentRequestRow {
  id: string;
  name: string;
  details: string | null;
  status: 'OPEN' | 'PLANNED' | 'ADDED' | 'DECLINED';
  adminNote: string | null;
  createdAt: string;
  practice?: { id: string; name: string; slug: string };
}

/** Severity 0–4, from none to the most severe band. */
export const SEVERITY_STYLES = [
  { bg: '#ECFDF5', fg: '#047857' },
  { bg: '#F0FDF4', fg: '#15803D' },
  { bg: '#FFFBEB', fg: '#B45309' },
  { bg: '#FFF7ED', fg: '#C2410C' },
  { bg: '#FEF2F2', fg: '#B91C1C' },
];

export function severityStyle(level: number) {
  return SEVERITY_STYLES[Math.max(0, Math.min(4, level))];
}

export const REQUEST_STATUS_LABEL: Record<AssessmentRequestRow['status'], string> = {
  OPEN: 'Received',
  PLANNED: 'Planned',
  ADDED: 'Added',
  DECLINED: 'Declined',
};
