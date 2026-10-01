/**
 * BKG-06: the two forms every practice starts with — a client intake and a
 * confidentiality agreement. Practices can edit the wording; the system keys
 * mark them as ours, so the app can offer "reset to default" later and the
 * backfill knows what to create.
 */
export type DefaultFormTemplate = {
  systemKey: string;
  title: string;
  description: string;
  targetType: string;
  schemaJson: unknown[];
};

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

export const DEFAULT_FORMS: DefaultFormTemplate[] = [CLIENT_INTAKE, CONFIDENTIALITY];

/** The default forms this client has not filled in for this practice yet. */
export async function listPendingForms(
  prisma: any,
  tenantId: bigint,
  clientProfileId: bigint,
): Promise<{ id: string; title: string; kind: string; minutes: number }[]> {
  const forms = await prisma.universalForm.findMany({
    where: { tenantId, isActive: true, systemKey: { in: ['CLIENT_INTAKE', 'CONFIDENTIALITY'] } },
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
