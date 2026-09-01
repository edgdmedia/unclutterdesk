const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing data in reverse order of dependencies
  await prisma.token.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.notificationDispatch.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.webPushSubscription.deleteMany();
  await prisma.bankSubaccount.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.universalFormSubmission.deleteMany();
  await prisma.universalForm.deleteMany();
  await prisma.consultBooking.deleteMany();
  await prisma.consultAvailability.deleteMany();
  await prisma.consultService.deleteMany();
  await prisma.consultTherapistProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('🧹 Cleaned existing database tables.');

  // 2. Hash default password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 3. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: 1,
      name: 'Dr. Jane Smith Therapy',
      shortName: 'Dr. Jane Smith',
      slug: 'dr-smith',
      primaryColor: '#0F3A53',
      secondaryColor: '#E3B341',
      welcomeTitle: 'Dr. Jane Smith',
      welcomeMessage: 'A calm, evidence-based therapy practice in Lagos helping you feel steady again.',
      publicEmail: 'hello@smiththerapy.ng',
      publicPhone: '+234 801 234 5678',
      city: 'Lagos',
      address: '14 Admiralty Way, Lekki Phase 1',
      category: 'Clinical psychology',
      subscriptionTier: 'PRO',
      isActive: true,
    }
  });
  console.log('🏢 Created Tenant:', tenant.name);

  // 4. Create Users (Jane - Owner, Nkem - Therapist)
  const userJane = await prisma.user.create({
    data: {
      id: 1,
      email: 'dr.jane@smiththerapy.ng',
      username: 'drjanesmith',
      password: hashedPassword,
    }
  });
  const userNkem = await prisma.user.create({
    data: {
      id: 2,
      email: 'nkem@smiththerapy.ng',
      username: 'nkemeze',
      password: hashedPassword,
    }
  });
  const userPlatformAdmin = await prisma.user.create({
    data: {
      id: 3,
      email: 'admin@unclutterdesk.com',
      username: 'platformadmin',
      password: hashedPassword,
      platformRole: 'SUPER_ADMIN',
    }
  });
  console.log('👥 Created Users');

  // 5. Create Profiles
  const profileJane = await prisma.profile.create({
    data: {
      id: 1,
      tenantId: 1,
      userId: 1,
      username: 'drjanesmith',
      email: 'dr.jane@smiththerapy.ng',
      role: 'OWNER',
      type: 'therapist',
      firstName: 'Jane',
      lastName: 'Smith',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    }
  });
  const profileNkem = await prisma.profile.create({
    data: {
      id: 2,
      tenantId: 1,
      userId: 2,
      username: 'nkemeze',
      email: 'nkem@smiththerapy.ng',
      role: 'THERAPIST',
      type: 'therapist',
      firstName: 'Nkem',
      lastName: 'Eze',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    }
  });
  console.log('👤 Created Staff Profiles');

  // 6. Create Therapist Profiles
  await prisma.consultTherapistProfile.create({
    data: {
      profileId: 1,
      tenantId: 1,
      publicUsername: 'drjane',
      bookingEmail: 'dr.jane@smiththerapy.ng',
      notificationEmail: 'hello@smiththerapy.ng',
      welcomeMessage: 'A calm, evidence-based therapy practice in Lagos. I help people steady their thoughts, rebuild routines and feel like themselves again.',
      specialty: 'Clinical Psychologist',
      credentials: 'MSc Clinical Psychology, Licensed by NCP',
      yearsExperience: 12,
      modalities: ['Anxiety', 'Burnout', 'Trauma (EMDR)', 'Life transitions', 'Grief'],
      isPublic: true,
      languages: ['English', 'Yoruba'],
    }
  });
  await prisma.consultTherapistProfile.create({
    data: {
      profileId: 2,
      tenantId: 1,
      publicUsername: 'nkemeze',
      bookingEmail: 'nkem@smiththerapy.ng',
      specialty: 'Counselling Psychologist',
      isPublic: true,
      languages: ['English', 'Igbo'],
    }
  });

  // 7. Create Clients (Profiles without User accounts)
  const clientAdaeze = await prisma.profile.create({
    data: {
      id: 3,
      tenantId: 1,
      username: 'adaeze_okonkwo',
      email: 'adaeze@email.com',
      role: 'CLIENT',
      type: 'user',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      status: 'active',
    }
  });
  const clientTunde = await prisma.profile.create({
    data: {
      id: 4,
      tenantId: 1,
      username: 'tunde_bello',
      email: 'tunde@email.com',
      role: 'CLIENT',
      type: 'user',
      firstName: 'Tunde',
      lastName: 'Bello',
      status: 'active',
    }
  });
  const clientNgozi = await prisma.profile.create({
    data: {
      id: 5,
      tenantId: 1,
      username: 'ngozi_michael',
      email: 'ngozi@email.com',
      role: 'CLIENT',
      type: 'user',
      firstName: 'Ngozi & Michael',
      lastName: 'Okoye',
      status: 'active',
    }
  });
  const clientEmeka = await prisma.profile.create({
    data: {
      id: 6,
      tenantId: 1,
      username: 'emeka_nwosu',
      email: 'emeka@email.com',
      role: 'CLIENT',
      type: 'user',
      firstName: 'Emeka',
      lastName: 'Nwosu',
      status: 'active',
    }
  });
  console.log('👤 Created Client Profiles');

  // 8. Create Services
  const serviceIndiv = await prisma.consultService.create({
    data: {
      id: 1,
      tenantId: 1,
      title: 'Individual Therapy',
      description: 'One-on-one session focused on mental health, anxiety, and depression.',
      durationMinutes: 50,
      priceKobo: BigInt(3500000), // ₦35,000
      isActive: true,
    }
  });
  const serviceCouples = await prisma.consultService.create({
    data: {
      id: 2,
      tenantId: 1,
      title: 'Couples Therapy',
      description: 'Joint session focused on relationship dynamics, communication, and conflict resolution.',
      durationMinutes: 80,
      priceKobo: BigInt(5500000), // ₦55,000
      isActive: true,
    }
  });
  console.log('🛠 Created Services');

  // 9. Create Availabilities (for Dr. Jane, profileId: 1)
  const slots = [];
  let availId = 1;
  const baseDay = new Date();
  baseDay.setUTCHours(0, 0, 0, 0);
  for (const offset of [1, 2, 3, 4]) {
    const day = new Date(baseDay);
    day.setUTCDate(day.getUTCDate() + offset);
    for (const hour of [9, 11, 14, 16]) {
      const startsAt = new Date(day);
      startsAt.setUTCHours(hour, 0, 0, 0);
      const endsAt = new Date(day);
      endsAt.setUTCHours(hour + 1, 0, 0, 0);
      const av = await prisma.consultAvailability.create({
        data: {
          id: BigInt(availId++),
          tenantId: 1,
          providerProfileId: 1,
          serviceId: 1,
          startsAt,
          endsAt,
          channel: 'VIDEO',
          isActive: true,
        }
      });
      slots.push(av);
    }
  }
  const pastDay = new Date(baseDay);
  pastDay.setUTCDate(pastDay.getUTCDate() - 7);
  const pastStart = new Date(pastDay);
  pastStart.setUTCHours(9, 0, 0, 0);
  const pastEnd = new Date(pastDay);
  pastEnd.setUTCHours(10, 0, 0, 0);
  const pastSlot = await prisma.consultAvailability.create({
    data: {
      id: BigInt(availId++),
      tenantId: 1,
      providerProfileId: 1,
      serviceId: 1,
      startsAt: pastStart,
      endsAt: pastEnd,
      channel: 'VIDEO',
      isActive: false,
    }
  });
  console.log('📅 Seeded Availability Slots');

  // 10. Create Bookings
  const booking1 = await prisma.consultBooking.create({
    data: {
      id: 1,
      tenantId: 1,
      serviceId: 1,
      availabilityId: slots[0].id,
      clientProfileId: 3, // Adaeze
      status: 'CONFIRMED',
      notes: 'Initial check-in regarding anxiety symptoms.',
    }
  });
  const booking2 = await prisma.consultBooking.create({
    data: {
      id: 2,
      tenantId: 1,
      serviceId: 1,
      availabilityId: slots[4].id,
      clientProfileId: 4, // Tunde
      status: 'CONFIRMED',
    }
  });
  await prisma.consultBooking.create({
    data: {
      id: 3,
      tenantId: 1,
      serviceId: 1,
      availabilityId: pastSlot.id,
      clientProfileId: 3,
      status: 'COMPLETED',
      notes: 'Completed follow-up session.',
    }
  });
  console.log('📅 Seeded Bookings');

  // 11. Create Clinical SOAP Notes
  await prisma.clinicalNote.create({
    data: {
      id: 1,
      tenantId: 1,
      bookingId: 1,
      clientProfileId: 3, // Adaeze
      authorProfileId: 1, // Dr. Jane
      subjective: 'Client reports panic attack frequency reduced over past 14 days. Expresses improved confidence in managing stress.',
      objective: 'Grooming intact, affect congruent with mood, calm speech rhythm. GAD-7 score: 9 (Mild anxiety).',
      assessment: 'Good response to Cognitive Behavioral Therapy protocol. Anxiety symptoms decreasing steadily.',
      plan: 'Continue bi-weekly 50-minute individual therapy sessions. Practice 4-7-8 breathing exercise daily.',
      isLocked: true,
    }
  });
  console.log('📝 Seeded SOAP Notes');

  // 12. Create Intake Form
  const form = await prisma.universalForm.create({
    data: {
      id: 1,
      tenantId: 1,
      title: 'PHQ-9',
      slug: 'phq-9',
      systemKey: 'PHQ_9',
      description: 'Standard depression screening questionnaire.',
      targetType: 'ASSESSMENT',
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      schemaJson: [
        { id: 'phq9_1', label: 'Little interest or pleasure in doing things', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_2', label: 'Feeling down, depressed, or hopeless', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_3', label: 'Trouble falling or staying asleep, or sleeping too much', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_4', label: 'Feeling tired or having little energy', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_5', label: 'Poor appetite or overeating', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_6', label: 'Feeling bad about yourself', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_7', label: 'Trouble concentrating on things', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_8', label: 'Moving or speaking slowly or being fidgety', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'phq9_9', label: 'Thoughts that you would be better off dead or of hurting yourself', type: 'single_choice', options: ['0', '1', '2', '3'], required: true }
      ],
      isDefault: true,
      isActive: true,
    }
  });

  // 13. Create Form Submission
  await prisma.universalFormSubmission.create({
    data: {
      id: 1,
      tenantId: 1,
      formId: form.id,
      bookingId: 1,
      clientProfileId: 3, // Adaeze
      targetType: 'ASSESSMENT',
      status: 'UNREAD',
      answersJson: {
        phq9_1: '1',
        phq9_2: '2',
        phq9_3: '2',
        phq9_4: '1',
        phq9_5: '1',
        phq9_6: '2',
        phq9_7: '1',
        phq9_8: '1',
        phq9_9: '1'
      },
      derivedJson: {
        instrument: 'PHQ_9',
        totalScore: 12,
        severity: 'Moderate',
        item9Risk: true,
      },
    }
  });

  const gad7Form = await prisma.universalForm.create({
    data: {
      id: 2,
      tenantId: 1,
      title: 'GAD-7',
      slug: 'gad-7',
      systemKey: 'GAD_7',
      description: 'Standard anxiety screening questionnaire.',
      targetType: 'ASSESSMENT',
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      schemaJson: [
        { id: 'gad7_1', label: 'Feeling nervous, anxious, or on edge', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_2', label: 'Not being able to stop or control worrying', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_3', label: 'Worrying too much about different things', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_4', label: 'Trouble relaxing', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_5', label: 'Being so restless that it is hard to sit still', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_6', label: 'Becoming easily annoyed or irritable', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
        { id: 'gad7_7', label: 'Feeling afraid as if something awful might happen', type: 'single_choice', options: ['0', '1', '2', '3'], required: true },
      ],
      isDefault: true,
      isActive: true,
    }
  });

  await prisma.universalFormSubmission.create({
    data: {
      id: 2,
      tenantId: 1,
      formId: gad7Form.id,
      bookingId: 1,
      clientProfileId: 3,
      targetType: 'ASSESSMENT',
      status: 'UNREAD',
      answersJson: {
        gad7_1: '2',
        gad7_2: '2',
        gad7_3: '1',
        gad7_4: '1',
        gad7_5: '1',
        gad7_6: '1',
        gad7_7: '1',
      },
      derivedJson: {
        instrument: 'GAD_7',
        totalScore: 9,
        severity: 'Mild',
      },
    }
  });

  await prisma.universalForm.create({
    data: {
      id: 3,
      tenantId: 1,
      title: 'Leave a Review',
      description: 'Collect public client testimonials for your practice landing page.',
      targetType: 'REVIEW',
      reviewPublicationMode: 'MANUAL',
      reviewerDisplayMode: 'FIRST_NAME',
      schemaJson: [
        { id: 'rating', label: 'How would you rate your experience?', type: 'scale', required: true, options: ['1', '2', '3', '4', '5'] },
        { id: 'testimonial', label: 'What stood out about your experience?', type: 'textarea', required: false }
      ],
      isDefault: true,
      isActive: true,
    }
  });
  console.log('📋 Seeded Intake + Review Forms');

  for (const table of [
    'Tenant',
    'User',
    'Profile',
    'ConsultService',
    'ConsultAvailability',
    'ConsultBooking',
    'ClinicalNote',
    'UniversalForm',
    'UniversalFormSubmission',
  ]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true);`,
    );
  }

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  });
