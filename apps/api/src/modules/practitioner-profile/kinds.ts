import type { PractitionerKind } from '@prisma/client';

/** Every kind a profile can have (§6.1). */
export const PRACTITIONER_KINDS: readonly PractitionerKind[] = ['COUNSELLOR', 'PSYCHOTHERAPIST', 'PSYCHOLOGIST', 'PSYCHIATRIST', 'SOCIAL_WORKER', 'TRAINEE'];

/** The words a profile shows for each kind (§6.1). Used by the PDF and the link-preview image. */
export const PRACTITIONER_KIND_LABELS: Record<PractitionerKind, string> = {
  COUNSELLOR: 'Counsellor',
  PSYCHOTHERAPIST: 'Psychotherapist',
  PSYCHOLOGIST: 'Psychologist',
  PSYCHIATRIST: 'Psychiatrist',
  SOCIAL_WORKER: 'Social worker',
  TRAINEE: 'Trainee counsellor',
};
