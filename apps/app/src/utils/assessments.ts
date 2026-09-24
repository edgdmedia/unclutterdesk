/** Shapes returned by /v1/assessments. Scoring and rules stay on the server. */
export type Tier = 'STARTER' | 'PRO' | 'CLINIC';

export interface AssessmentDefinition {
  key: string;
  name: string;
  shortName: string;
  measures: string;
  instructions: string;
  estimatedMinutes: number;
  tier: Tier;
  scale: Array<{ value: number; label: string }>;
  items: Array<{ id: string; text: string }>;
}

export interface LibraryEntry extends AssessmentDefinition {
  enabled: boolean;
  /** Whether the practice's plan includes it. */
  onPlan: boolean;
}

/** Exactly what a client may see of their result. */
export interface ClientResult {
  show: 'score_and_summary' | 'summary' | 'none';
  headline?: string;
  summary?: string;
  score?: number;
  maxScore?: number;
  subscales?: Array<{ label: string; text?: string }>;
  messages: string[];
}

export interface AssessmentSubscale {
  key: string;
  label: string;
  score: number;
  max: number;
  severity: { label: string; level: number } | null;
  clinicianText?: string;
  clientText?: string;
}

export interface AssessmentFlag {
  key: string;
  level: 'attention' | 'urgent';
  message: string;
  clientMessage?: string;
}

export interface AssessmentResultRow {
  id: string;
  instrumentKey: string;
  instrumentVersion: number;
  shortName: string;
  totalScore: number;
  maxScore: number | null;
  severity: string;
  severityLevel: number;
  clinicianText: string | null;
  subscales: AssessmentSubscale[];
  flags: AssessmentFlag[];
  clientView: ClientResult | null;
  answers: Record<string, number>;
  completedAt: string;
}

export interface PendingAssessment {
  id: string;
  instrumentKey: string;
  shortName: string;
  message: string | null;
  sentAt: string;
}

export interface PracticeAssignment {
  id: string;
  shortName: string;
  client: { id: string; name: string };
  status: 'SENT' | 'COMPLETED';
  sentAt: string;
  completedAt: string | null;
  result: { totalScore: number; severity: string; severityLevel: number; hasFlags: boolean } | null;
}

/** One of the signed-in client's own assessments. */
export interface MyAssessment {
  id: string;
  shortName: string;
  name: string;
  measures: string;
  estimatedMinutes: number;
  status: 'SENT' | 'COMPLETED';
  message: string | null;
  sentAt: string;
  completedAt: string | null;
  result: ClientResult | null;
}

export interface PracticeBrand {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

/** GET /v1/assessments/public/:token and /v1/assessments/mine/:id */
export type OpenedAssessment =
  | { status: 'OPEN'; practice: PracticeBrand; firstName: string | null; message: string | null; assessment: AssessmentDefinition }
  | { status: 'COMPLETED'; practice: PracticeBrand; shortName: string; completedAt: string | null; result?: ClientResult }
  | { status: 'CANCELLED'; practice: PracticeBrand };

export type RequestType = 'ASSESSMENT' | 'FEATURE' | 'SERVICE' | 'FEEDBACK' | 'OTHER';
export type RequestStatus = 'OPEN' | 'PLANNED' | 'DONE' | 'DECLINED';

export interface PlatformRequestRow {
  id: string;
  type: RequestType;
  subject: string;
  details: string | null;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  practice?: { id: string; name: string; slug: string };
}

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  ASSESSMENT: 'New assessment',
  FEATURE: 'Feature',
  SERVICE: 'Service',
  FEEDBACK: 'Feedback',
  OTHER: 'Something else',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  OPEN: 'Received',
  PLANNED: 'Planned',
  DONE: 'Done',
  DECLINED: 'Declined',
};

export const PLAN_LABEL: Record<Tier, string> = { STARTER: 'Starter', PRO: 'Pro', CLINIC: 'Clinic' };

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
