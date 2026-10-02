/**
 * BKG-06 / FRM-04: the five forms every practice starts with. Practices can
 * edit the wording; the system keys mark them as ours, so the app can offer
 * "reset to default" later and the backfill knows what to create.
 */
export type DefaultFormTemplate = {
  systemKey: string;
  title: string;
  description: string;
  targetType: string;
  schemaJson: unknown[];
  /** Skip it for a practice that already made its own form of this type (it would be a duplicate). */
  skipIfPracticeHasOwn?: boolean;
};

const RATING = ['1', '2', '3', '4', '5'];

export const CLIENT_INTAKE: DefaultFormTemplate = {
  systemKey: 'CLIENT_INTAKE',
  title: 'Client intake',
  description: 'The basics we need before your first session.',
  targetType: 'INTAKE',
  schemaJson: [
    { id: 'preferred_name', label: 'Preferred name', type: 'text', required: true },
    { id: 'date_of_birth', label: 'Date of birth', type: 'text', required: true },
    { id: 'phone', label: 'Phone number', type: 'text', required: true },
    { id: 'emergency_contact_name', label: 'Emergency contact name', type: 'text', required: true },
    { id: 'emergency_contact_phone', label: 'Emergency contact phone', type: 'text', required: true },
    { id: 'presenting_reason', label: 'What brings you to therapy?', type: 'textarea', required: true },
    { id: 'previous_therapy', label: 'Have you been to therapy before?', type: 'single_choice', required: true, options: ['Yes', 'No'] },
    { id: 'previous_therapy_details', label: 'If yes, a little about it (optional)', type: 'textarea', required: false },
    { id: 'current_medication', label: 'Are you currently taking any medication?', type: 'textarea', required: false },
    { id: 'anything_else', label: 'Anything else we should know?', type: 'textarea', required: false },
    { id: 'consent_contact', label: 'I agree to be contacted by phone or email about my care.', type: 'single_choice', required: true, options: ['I agree', 'I do not agree'] },
  ],
};

export const CONFIDENTIALITY: DefaultFormTemplate = {
  systemKey: 'CONFIDENTIALITY',
  title: 'Confidentiality',
  description: 'What we keep private, the few limits on it, and how your notes are stored.',
  targetType: 'CONSENT',
  schemaJson: [
    { id: 'kept_confidential', label: 'What stays confidential', type: 'text_block', required: false, text: 'What you say in sessions, your records and your identity are confidential. We share them inside the practice only with the people caring for you.' },
    { id: 'limits', label: 'The limits of confidentiality', type: 'text_block', required: false, text: 'We must speak up if you are at serious risk of harm to yourself or someone else, if a child or vulnerable adult is at risk, or if a court orders us to. We will tell you first whenever we safely can.' },
    { id: 'storage', label: 'How your notes are stored', type: 'text_block', required: false, text: 'Session notes are stored encrypted in your practice record. They are kept for as long as the law requires, and you can ask us for a copy or to correct them.' },
    { id: 'read_understood', label: 'I have read and understood this.', type: 'single_choice', required: true, options: ['Yes'] },
    { id: 'signature', label: 'Your signature', type: 'signature', required: true },
  ],
};

export const CONSENT_TO_TREATMENT: DefaultFormTemplate = {
  systemKey: 'CONSENT_TO_TREATMENT',
  title: 'Consent to treatment',
  description: 'How therapy works here, and your agreement to begin.',
  targetType: 'CONSENT',
  schemaJson: [
    { id: 'what_therapy_involves', label: 'What therapy involves', type: 'text_block', required: false, text: 'Therapy is a working relationship between you and your therapist. Together you will talk through what matters to you and agree on ways to work on it. Some sessions may feel uncomfortable; that is a normal part of change, and you can always say so.' },
    { id: 'sessions_and_cancellations', label: 'Sessions, cancellations and missed sessions', type: 'text_block', required: false, text: 'Sessions start and end at the booked time. If you need to cancel or move a session, please do it within the practice\'s cancellation notice period. A late cancellation or a missed session may still be charged.' },
    { id: 'online_sessions', label: 'Online sessions', type: 'text_block', required: false, text: 'For online sessions, join from a private, quiet place on a reliable connection. If the call drops, your therapist will try to reconnect or contact you.' },
    { id: 'your_rights', label: 'Your rights', type: 'text_block', required: false, text: 'You can ask questions about your care at any time, ask to see your records, and choose to stop therapy whenever you wish.' },
    { id: 'consent', label: 'I agree to receive therapy from this practice on these terms.', type: 'single_choice', required: true, options: ['I agree'] },
    { id: 'signature', label: 'Your signature', type: 'signature', required: true },
  ],
};

export const SESSION_FEEDBACK: DefaultFormTemplate = {
  systemKey: 'SESSION_FEEDBACK',
  title: 'Session feedback',
  description: 'A minute to tell us how your session went. Only the practice sees this.',
  targetType: 'FEEDBACK',
  skipIfPracticeHasOwn: true,
  schemaJson: [
    { id: 'helpfulness', label: 'How helpful was your session? (1 = not at all, 5 = very)', type: 'scale', required: true, options: RATING },
    { id: 'felt_heard', label: 'Did you feel heard and understood?', type: 'single_choice', required: true, options: ['Yes', 'Somewhat', 'No'] },
    { id: 'went_well', label: 'What went well?', type: 'textarea', required: false },
    { id: 'could_improve', label: 'What could be better?', type: 'textarea', required: false },
    { id: 'may_contact', label: 'May we contact you about your feedback?', type: 'single_choice', required: false, options: ['Yes', 'No'] },
  ],
};

export const PUBLIC_REVIEW: DefaultFormTemplate = {
  systemKey: 'PUBLIC_REVIEW',
  title: 'Leave a review',
  description: 'Share your experience. With your permission, the practice may show it on its booking page.',
  targetType: 'REVIEW',
  skipIfPracticeHasOwn: true,
  schemaJson: [
    { id: 'rating', label: 'Overall rating', type: 'scale', required: true, options: RATING },
    { id: 'testimonial', label: 'What would you like others to know?', type: 'textarea', required: true },
    { id: 'may_publish', label: 'May the practice show this review on its booking page?', type: 'single_choice', required: true, options: ['Yes', 'No'] },
  ],
};

/** In the order a client meets them: before the first session, then after sessions. */
export const DEFAULT_FORMS: DefaultFormTemplate[] = [CLIENT_INTAKE, CONSENT_TO_TREATMENT, CONFIDENTIALITY, SESSION_FEEDBACK, PUBLIC_REVIEW];

/** The defaults a client must complete before their first session. */
export const BEFORE_FIRST_SESSION = [CLIENT_INTAKE.systemKey, CONSENT_TO_TREATMENT.systemKey, CONFIDENTIALITY.systemKey];

/** The default forms this client has not filled in for this practice yet. */
export async function listPendingForms(
  prisma: any,
  tenantId: bigint,
  clientProfileId: bigint,
): Promise<{ id: string; title: string; kind: string; minutes: number }[]> {
  const forms = await prisma.universalForm.findMany({
    where: { tenantId, isActive: true, systemKey: { in: BEFORE_FIRST_SESSION } },
    orderBy: { createdAt: 'asc' },
  });
  const submitted = await prisma.universalFormSubmission.findMany({
    where: { tenantId, clientProfileId, formId: { in: forms.map((f: { id: bigint }) => f.id) } },
    select: { formId: true },
  });
  const done = new Set(submitted.map((s: { formId: bigint }) => s.formId.toString()));
  return forms
    .filter((f: { id: bigint }) => !done.has(f.id.toString()))
    .map((f: { id: bigint; title: string; targetType: string; schemaJson: any }) => ({
      id: f.id.toString(),
      title: f.title,
      kind: f.targetType,
      minutes: Math.max(2, Math.ceil((Array.isArray(f.schemaJson) ? f.schemaJson : []).filter((field: any) => field.type !== 'text_block').length / 3)),
    }));
}
