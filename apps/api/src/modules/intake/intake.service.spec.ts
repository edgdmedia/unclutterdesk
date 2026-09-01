import { describe, expect, test, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { IntakeService } from './intake.service';

function createPrismaMock() {
  return {
    universalForm: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    universalFormSubmission: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  } as any;
}

describe('IntakeService PHQ-9 scoring', () => {
  test('returns derived PHQ-9 score and severity for a system template submission', async () => {
    const prisma = createPrismaMock();
    const service = new IntakeService(prisma);

    prisma.universalForm.findFirst.mockResolvedValue({
      id: BigInt(10),
      tenantId: BigInt(1),
      title: 'PHQ-9',
      description: 'Depression screening',
      targetType: 'ASSESSMENT',
      schemaJson: [
        { id: 'phq9_1', label: 'Little interest', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_2', label: 'Feeling down', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_3', label: 'Sleep trouble', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_4', label: 'Low energy', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_5', label: 'Appetite', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_6', label: 'Self worth', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_7', label: 'Concentration', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_8', label: 'Motor changes', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_9', label: 'Self harm thoughts', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
      ],
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      slug: 'PHQ_9',
      systemKey: 'PHQ_9',
    });

    prisma.profile.findFirst.mockResolvedValue({
      id: BigInt(99),
      tenantId: BigInt(1),
      email: 'ada@example.com',
      username: 'ada',
      role: 'CLIENT',
      firstName: 'Ada',
      lastName: 'Okafor',
    });

    prisma.universalFormSubmission.create.mockImplementation(async ({ data }: any) => ({
      id: BigInt(101),
      ...data,
      createdAt: new Date(),
    }));

    const result = await service.submitIntakeAnswers(BigInt(1), {
      formId: '10',
      clientEmail: 'ada@example.com',
      clientName: 'Ada Okafor',
      answersJson: {
        phq9_1: '1',
        phq9_2: '2',
        phq9_3: '1',
        phq9_4: '2',
        phq9_5: '1',
        phq9_6: '1',
        phq9_7: '1',
        phq9_8: '0',
        phq9_9: '0',
      },
    });

    expect(result.derived).toEqual({
      instrument: 'PHQ_9',
      totalScore: 9,
      severity: 'Mild',
      item9Risk: false,
    });
  });

  test('returns derived GAD-7 score and severity for a system template submission', async () => {
    const prisma = createPrismaMock();
    const service = new IntakeService(prisma);

    prisma.universalForm.findFirst.mockResolvedValue({
      id: BigInt(11),
      tenantId: BigInt(1),
      title: 'GAD-7',
      description: 'Anxiety screening',
      targetType: 'ASSESSMENT',
      schemaJson: [
        { id: 'gad7_1', label: 'Feeling nervous', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_2', label: 'Unable to stop worrying', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_3', label: 'Worrying too much', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_4', label: 'Trouble relaxing', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_5', label: 'Restless', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_6', label: 'Easily annoyed', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_7', label: 'Feeling afraid', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
      ],
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      slug: 'GAD_7',
      systemKey: 'GAD_7',
    });

    prisma.profile.findFirst.mockResolvedValue({
      id: BigInt(99),
      tenantId: BigInt(1),
      email: 'ada@example.com',
      username: 'ada',
      role: 'CLIENT',
      firstName: 'Ada',
      lastName: 'Okafor',
    });

    prisma.universalFormSubmission.create.mockImplementation(async ({ data }: any) => ({
      id: BigInt(102),
      ...data,
      createdAt: new Date(),
    }));

    const result = await service.submitIntakeAnswers(BigInt(1), {
      formId: '11',
      clientEmail: 'ada@example.com',
      clientName: 'Ada Okafor',
      answersJson: {
        gad7_1: '2',
        gad7_2: '2',
        gad7_3: '1',
        gad7_4: '1',
        gad7_5: '1',
        gad7_6: '1',
        gad7_7: '1',
      },
    });

    expect(result.derived).toEqual({
      instrument: 'GAD_7',
      totalScore: 9,
      severity: 'Mild',
    });
  });

  test('rejects schema edits for system templates', async () => {
    const prisma = createPrismaMock();
    const service = new IntakeService(prisma);

    prisma.universalForm.findFirst.mockResolvedValue({
      id: BigInt(11),
      tenantId: BigInt(1),
      title: 'PHQ-9',
      description: 'Depression screening',
      targetType: 'ASSESSMENT',
      schemaJson: [{ id: 'phq9_1', label: 'Little interest', type: 'single_choice', options: ['0', '1', '2', '3'], required: true }],
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      slug: 'phq-9',
      systemKey: 'PHQ_9',
    });

    await expect(
      service.updateForm(BigInt(1), BigInt(11), {
        schemaJson: [{ id: 'changed', label: 'Changed', type: 'text' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('allows activation changes for system templates', async () => {
    const prisma = createPrismaMock();
    const service = new IntakeService(prisma);

    prisma.universalForm.findFirst.mockResolvedValue({
      id: BigInt(11),
      tenantId: BigInt(1),
      title: 'PHQ-9',
      description: 'Depression screening',
      targetType: 'ASSESSMENT',
      schemaJson: [{ id: 'phq9_1', label: 'Little interest', type: 'single_choice', options: ['0', '1', '2', '3'], required: true }],
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      slug: 'phq-9',
      systemKey: 'PHQ_9',
    });

    prisma.universalForm.update.mockResolvedValue({
      id: BigInt(11),
      tenantId: BigInt(1),
      title: 'PHQ-9',
      description: 'Depression screening',
      targetType: 'ASSESSMENT',
      schemaJson: [{ id: 'phq9_1', label: 'Little interest', type: 'single_choice', options: ['0', '1', '2', '3'], required: true }],
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      isDefault: true,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      slug: 'phq-9',
      systemKey: 'PHQ_9',
    });

    const result = await service.updateForm(BigInt(1), BigInt(11), {
      isActive: false,
    });

    expect(result.isActive).toBe(false);
  });
});
