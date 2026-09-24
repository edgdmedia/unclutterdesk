import { Prisma } from '@prisma/client';

/**
 * The forms every practice starts with.
 *
 * These lived only in prisma/seed.js, the development seed that empties the
 * database, so no real practice ever had them: new practices started with no
 * assessments at all, although the API already scores PHQ-9 and GAD-7. They
 * are now created with each new practice, and migration
 * 20260924170000_default_forms adds them to existing ones.
 *
 * Question ids must stay phq9_1..9 and gad7_1..7: IntakeService scores by them.
 * Answers are "0".."3"; the description gives the scale. PHQ-9 and GAD-7 are
 * free to use without permission (Pfizer).
 */
const FREQUENCY_SCALE =
  'Over the last 2 weeks, how often have you been bothered by the following? ' +
  '0 = Not at all, 1 = Several days, 2 = More than half the days, 3 = Nearly every day.';

const scaleItem = (id: string, label: string) => ({
  id,
  label,
  type: 'single_choice',
  options: ['0', '1', '2', '3'],
  required: true,
});

export const DEFAULT_FORMS = [
  {
    title: 'PHQ-9',
    slug: 'phq-9',
    systemKey: 'PHQ_9',
    targetType: 'ASSESSMENT',
    description: `Depression screening questionnaire. ${FREQUENCY_SCALE}`,
    schemaJson: [
      scaleItem('phq9_1', 'Little interest or pleasure in doing things'),
      scaleItem('phq9_2', 'Feeling down, depressed, or hopeless'),
      scaleItem('phq9_3', 'Trouble falling or staying asleep, or sleeping too much'),
      scaleItem('phq9_4', 'Feeling tired or having little energy'),
      scaleItem('phq9_5', 'Poor appetite or overeating'),
      scaleItem('phq9_6', 'Feeling bad about yourself, or that you are a failure or have let yourself or your family down'),
      scaleItem('phq9_7', 'Trouble concentrating on things, such as reading or watching television'),
      scaleItem('phq9_8', 'Moving or speaking so slowly that other people could have noticed, or being so fidgety or restless that you have been moving around a lot more than usual'),
      scaleItem('phq9_9', 'Thoughts that you would be better off dead, or of hurting yourself in some way'),
    ],
  },
  {
    title: 'GAD-7',
    slug: 'gad-7',
    systemKey: 'GAD_7',
    targetType: 'ASSESSMENT',
    description: `Anxiety screening questionnaire. ${FREQUENCY_SCALE}`,
    schemaJson: [
      scaleItem('gad7_1', 'Feeling nervous, anxious, or on edge'),
      scaleItem('gad7_2', 'Not being able to stop or control worrying'),
      scaleItem('gad7_3', 'Worrying too much about different things'),
      scaleItem('gad7_4', 'Trouble relaxing'),
      scaleItem('gad7_5', 'Being so restless that it is hard to sit still'),
      scaleItem('gad7_6', 'Becoming easily annoyed or irritable'),
      scaleItem('gad7_7', 'Feeling afraid, as if something awful might happen'),
    ],
  },
  {
    title: 'Leave a Review',
    slug: 'leave-a-review',
    systemKey: null,
    targetType: 'REVIEW',
    description: 'Collect client testimonials for your booking page. Nothing is published until you approve it.',
    schemaJson: [
      { id: 'rating', label: 'How would you rate your experience?', type: 'scale', required: true, options: ['1', '2', '3', '4', '5'] },
      { id: 'testimonial', label: 'What stood out about your experience?', type: 'textarea', required: false },
    ],
  },
] as const;

type Db = Pick<Prisma.TransactionClient, 'universalForm'>;

/**
 * Gives a practice any default form it does not have yet. Assessments are
 * matched by systemKey and the review form by type, so a practice that has
 * edited or replaced one is left alone. Safe to call more than once.
 */
export async function ensureDefaultForms(db: Db, tenantId: bigint): Promise<number> {
  const existing = await db.universalForm.findMany({
    where: { tenantId },
    select: { systemKey: true, targetType: true },
  });
  const missing = DEFAULT_FORMS.filter((form) =>
    form.systemKey
      ? !existing.some((e) => e.systemKey === form.systemKey)
      : !existing.some((e) => e.targetType === form.targetType),
  );
  for (const form of missing) {
    await db.universalForm.create({
      data: {
        tenantId,
        title: form.title,
        slug: form.slug,
        systemKey: form.systemKey,
        targetType: form.targetType,
        description: form.description,
        schemaJson: form.schemaJson as unknown as Prisma.InputJsonValue,
        reviewPublicationMode: 'MANUAL',
        reviewerDisplayMode: 'FIRST_NAME',
        isDefault: true,
        isActive: true,
      },
    });
  }
  return missing.length;
}
