import type { InstrumentDefinition } from './engine';

/**
 * The instruments the platform ships with. They are copied into the
 * AssessmentInstrument table the first time the API starts, and from then on
 * the stored copy is the one used, so platform admins can adjust wording and
 * rules without a deploy. Editing these files does not change an instrument
 * that is already stored.
 *
 * Each one's source says where it comes from and on what terms it is used.
 */

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}_${i + 1}`);
const items = (prefix: string, texts: string[]) => texts.map((text, i) => ({ id: `${prefix}_${i + 1}`, text }));
const scale = (labels: string[]) => labels.map((label, value) => ({ value, label }));

const FREQUENCY_2W = scale(['Not at all', 'Several days', 'More than half the days', 'Nearly every day']);

const CRISIS =
  'If you are thinking about harming yourself or feel you are not safe, please do not wait for your next session. ' +
  'Contact your practitioner now, or call 112 or go to the nearest hospital emergency department.';

export const PHQ_9: InstrumentDefinition = {
  key: 'PHQ_9',
  name: 'Patient Health Questionnaire (PHQ-9)',
  shortName: 'PHQ-9',
  measures: 'Depression',
  description: 'This is a short questionnaire about low mood and energy over the last two weeks. Your practitioner may use it to understand how you have been feeling and to plan support with you.',
  instructions: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
  estimatedMinutes: 3,
  tier: 'STARTER',
  clientResults: 'summary',
  source: 'Kroenke, Spitzer & Williams (2001). Free to use.',
  scale: FREQUENCY_2W,
  items: items('phq9', [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself, or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading or watching television',
    'Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead, or of hurting yourself in some way',
  ]),
  scoring: {
    total: { from: 'items' },
    headline: 'total',
    bands: [
      {
        min: 0, label: 'Minimal', level: 0,
        clinicianText: 'Minimal depressive symptoms. No action usually needed; repeat if clinically indicated.',
        clientText: 'Your answers suggest few signs of low mood over the past two weeks.',
      },
      {
        min: 5, label: 'Mild', level: 1,
        clinicianText: 'Mild symptoms. Watchful waiting; repeat PHQ-9 at follow-up.',
        clientText: 'Your answers suggest some signs of low mood. Your practitioner will talk this through with you.',
      },
      {
        min: 10, label: 'Moderate', level: 2,
        clinicianText: 'Moderate symptoms. Consider a treatment plan: counselling, follow-up and/or pharmacotherapy.',
        clientText: 'Your answers suggest low mood is affecting you. Your practitioner will talk with you about what might help.',
      },
      {
        min: 15, label: 'Moderately severe', level: 3,
        clinicianText: 'Moderately severe symptoms. Active treatment with psychotherapy and/or pharmacotherapy is indicated.',
        clientText: 'Your answers suggest low mood is having a real effect on you. Your practitioner will talk with you about support and next steps.',
      },
      {
        min: 20, label: 'Severe', level: 4,
        clinicianText: 'Severe symptoms. Prompt treatment; consider psychiatric referral, especially with poor response or functional impairment.',
        clientText: 'Your answers suggest you have been going through a very hard time. Your practitioner will be in touch about support and next steps.',
      },
    ],
  },
  rules: [
    {
      key: 'self_harm',
      when: { item: 'phq9_9', op: '>', value: 0 },
      level: 'urgent',
      clinicianMessage: 'Answered above zero on thoughts of being better off dead or of self-harm (item 9). Assess risk promptly.',
      clientMessage: CRISIS,
    },
  ],
};

export const GAD_7: InstrumentDefinition = {
  key: 'GAD_7',
  name: 'Generalized Anxiety Disorder scale (GAD-7)',
  shortName: 'GAD-7',
  measures: 'Anxiety',
  description: 'This short questionnaire asks about worry, tension and restlessness over the last two weeks. It helps your practitioner understand anxiety-related experiences and plan care with you.',
  instructions: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
  estimatedMinutes: 2,
  tier: 'STARTER',
  clientResults: 'summary',
  source: 'Spitzer, Kroenke, Williams & Löwe (2006). Free to use.',
  scale: FREQUENCY_2W,
  items: items('gad7', [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid, as if something awful might happen',
  ]),
  scoring: {
    total: { from: 'items' },
    headline: 'total',
    bands: [
      {
        min: 0, label: 'Minimal', level: 0,
        clinicianText: 'Minimal anxiety.',
        clientText: 'Your answers suggest few signs of anxiety over the past two weeks.',
      },
      {
        min: 5, label: 'Mild', level: 1,
        clinicianText: 'Mild anxiety. Monitor.',
        clientText: 'Your answers suggest some anxiety. Your practitioner will talk this through with you.',
      },
      {
        min: 10, label: 'Moderate', level: 2,
        clinicianText: 'Moderate anxiety. A score of 10 or more warrants further assessment for an anxiety disorder.',
        clientText: 'Your answers suggest anxiety is affecting you. Your practitioner will talk with you about what might help.',
      },
      {
        min: 15, label: 'Severe', level: 4,
        clinicianText: 'Severe anxiety. Active treatment is indicated.',
        clientText: 'Your answers suggest anxiety is having a big effect on you. Your practitioner will talk with you about support and next steps.',
      },
    ],
  },
  rules: [],
};

export const PCL_5: InstrumentDefinition = {
  key: 'PCL_5',
  name: 'PTSD Checklist for DSM-5 (PCL-5)',
  shortName: 'PCL-5',
  measures: 'Post-traumatic stress',
  description: 'This questionnaire asks about reactions that can follow a very stressful or frightening experience. Your practitioner may use it to understand how you have been coping over the past month.',
  instructions:
    'Below is a list of problems that people sometimes have in response to a very stressful experience. Keeping your worst event in mind, please read each problem and indicate how much you have been bothered by that problem in the past month.',
  estimatedMinutes: 7,
  tier: 'PRO',
  clientResults: 'summary',
  source: 'Weathers et al. (2013), National Center for PTSD. Public domain.',
  scale: scale(['Not at all', 'A little bit', 'Moderately', 'Quite a bit', 'Extremely']),
  items: items('pcl5', [
    'Repeated, disturbing, and unwanted memories of the stressful experience',
    'Repeated, disturbing dreams of the stressful experience',
    'Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)',
    'Feeling very upset when something reminded you of the stressful experience',
    'Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)',
    'Avoiding memories, thoughts, or feelings related to the stressful experience',
    'Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)',
    'Trouble remembering important parts of the stressful experience',
    'Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)',
    'Blaming yourself or someone else for the stressful experience or what happened after it',
    'Having strong negative feelings such as fear, horror, anger, guilt, or shame',
    'Loss of interest in activities that you used to enjoy',
    'Feeling distant or cut off from other people',
    'Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)',
    'Irritable behavior, angry outbursts, or acting aggressively',
    'Taking too many risks or doing things that could cause you harm',
    'Being "superalert" or watchful or on guard',
    'Feeling jumpy or easily startled',
    'Having difficulty concentrating',
    'Trouble falling or staying asleep',
  ]),
  scoring: {
    total: { from: 'items' },
    headline: 'total',
    // 31–33 is the commonly used cut-off for probable PTSD.
    bands: [
      {
        min: 0, label: 'Below the cut-off', level: 0,
        clinicianText: 'Below the usual cut-off for probable PTSD. Clusters may still show areas to address.',
        clientText: 'Thank you for answering. Your practitioner will go through your answers with you.',
      },
      {
        min: 31, label: 'Near the cut-off', level: 2,
        clinicianText: 'Just below the 33 cut-off. Consider a structured clinical interview.',
        clientText: 'Your answers suggest the experience is still affecting you. Your practitioner will talk this through with you.',
      },
      {
        min: 33, label: 'Probable PTSD: further assessment indicated', level: 3,
        clinicianText: 'At or above the cut-off for probable PTSD. Confirm with a clinical interview (e.g. CAPS-5) before diagnosis.',
        clientText: 'Your answers suggest the experience is still affecting you a lot. Your practitioner will talk with you about support and next steps.',
      },
    ],
    subscales: [
      { key: 'intrusion', label: 'Intrusion (B)', items: ids('pcl5', 5) },
      { key: 'avoidance', label: 'Avoidance (C)', items: ['pcl5_6', 'pcl5_7'] },
      { key: 'cognition_mood', label: 'Negative thoughts and mood (D)', items: [8, 9, 10, 11, 12, 13, 14].map((n) => `pcl5_${n}`) },
      { key: 'arousal', label: 'Arousal and reactivity (E)', items: [15, 16, 17, 18, 19, 20].map((n) => `pcl5_${n}`) },
    ],
  },
  rules: [
    {
      key: 'risk_taking',
      when: { item: 'pcl5_16', op: '>=', value: 3 },
      level: 'attention',
      clinicianMessage: 'Reported taking too many risks or doing things that could cause harm (item 16) "Quite a bit" or more.',
    },
  ],
};

const dass = (numbers: number[]) => numbers.map((n) => `dass21_${n}`);

export const DASS_21: InstrumentDefinition = {
  key: 'DASS_21',
  name: 'Depression Anxiety Stress Scales (DASS-21)',
  shortName: 'DASS-21',
  measures: 'Depression, anxiety and stress',
  description: 'This questionnaire looks at low mood, anxiety and stress over the past week. It helps your practitioner get a broad picture of how you have been feeling and what may need attention.',
  instructions:
    'Please read each statement and choose the answer that shows how much the statement applied to you over the past week. There are no right or wrong answers.',
  estimatedMinutes: 5,
  tier: 'PRO',
  clientResults: 'summary',
  source: 'Lovibond & Lovibond (1995). Public domain.',
  scale: scale([
    'Did not apply to me at all',
    'Applied to me to some degree, or some of the time',
    'Applied to me to a considerable degree, or a good part of the time',
    'Applied to me very much, or most of the time',
  ]),
  items: items('dass21', [
    'I found it hard to wind down',
    'I was aware of dryness of my mouth',
    "I couldn't seem to experience any positive feeling at all",
    'I experienced breathing difficulty (for example, excessively rapid breathing, breathlessness in the absence of physical exertion)',
    'I found it difficult to work up the initiative to do things',
    'I tended to over-react to situations',
    'I experienced trembling (for example, in the hands)',
    'I felt that I was using a lot of nervous energy',
    'I was worried about situations in which I might panic and make a fool of myself',
    'I felt that I had nothing to look forward to',
    'I found myself getting agitated',
    'I found it difficult to relax',
    'I felt down-hearted and blue',
    'I was intolerant of anything that kept me from getting on with what I was doing',
    'I felt I was close to panic',
    'I was unable to become enthusiastic about anything',
    "I felt I wasn't worth much as a person",
    'I felt that I was rather touchy',
    'I was aware of the action of my heart in the absence of physical exertion (for example, sense of heart rate increase, heart missing a beat)',
    'I felt scared without any good reason',
    'I felt that life was meaningless',
  ]),
  scoring: {
    total: { from: 'subscales' },
    headline: 'worst_subscale',
    allClearLabel: 'Normal on all scales',
    allClearClientText: 'Your answers are within the usual range for low mood, anxiety and stress over the past week.',
    // Each subscale is summed and doubled to match the DASS-42 norms.
    subscales: [
      {
        key: 'depression', label: 'Depression', items: dass([3, 5, 10, 13, 16, 17, 21]), multiplier: 2,
        bands: [
          { min: 0, label: 'Normal', level: 0 },
          { min: 10, label: 'Mild', level: 1, clinicianText: 'Mild depression subscale.', clientText: 'Some signs of low mood.' },
          { min: 14, label: 'Moderate', level: 2, clinicianText: 'Moderate depression subscale.', clientText: 'Low mood seems to be affecting you.' },
          { min: 21, label: 'Severe', level: 3, clinicianText: 'Severe depression subscale.', clientText: 'Low mood seems to be affecting you a lot.' },
          { min: 28, label: 'Extremely severe', level: 4, clinicianText: 'Extremely severe depression subscale. Prioritise follow-up.', clientText: 'Low mood seems to be affecting you a great deal.' },
        ],
      },
      {
        key: 'anxiety', label: 'Anxiety', items: dass([2, 4, 7, 9, 15, 19, 20]), multiplier: 2,
        bands: [
          { min: 0, label: 'Normal', level: 0 },
          { min: 8, label: 'Mild', level: 1, clinicianText: 'Mild anxiety subscale.', clientText: 'Some signs of anxiety.' },
          { min: 10, label: 'Moderate', level: 2, clinicianText: 'Moderate anxiety subscale.', clientText: 'Anxiety seems to be affecting you.' },
          { min: 15, label: 'Severe', level: 3, clinicianText: 'Severe anxiety subscale.', clientText: 'Anxiety seems to be affecting you a lot.' },
          { min: 20, label: 'Extremely severe', level: 4, clinicianText: 'Extremely severe anxiety subscale. Prioritise follow-up.', clientText: 'Anxiety seems to be affecting you a great deal.' },
        ],
      },
      {
        key: 'stress', label: 'Stress', items: dass([1, 6, 8, 11, 12, 14, 18]), multiplier: 2,
        bands: [
          { min: 0, label: 'Normal', level: 0 },
          { min: 15, label: 'Mild', level: 1, clinicianText: 'Mild stress subscale.', clientText: 'Some signs of stress.' },
          { min: 19, label: 'Moderate', level: 2, clinicianText: 'Moderate stress subscale.', clientText: 'Stress seems to be affecting you.' },
          { min: 26, label: 'Severe', level: 3, clinicianText: 'Severe stress subscale.', clientText: 'Stress seems to be affecting you a lot.' },
          { min: 34, label: 'Extremely severe', level: 4, clinicianText: 'Extremely severe stress subscale. Prioritise follow-up.', clientText: 'Stress seems to be affecting you a great deal.' },
        ],
      },
    ],
  },
  rules: [
    {
      key: 'meaningless',
      when: { item: 'dass21_21', op: '>=', value: 2 },
      level: 'urgent',
      clinicianMessage: 'Reported feeling that life was meaningless (item 21) to a considerable degree or more. Assess risk promptly.',
      clientMessage: CRISIS,
    },
  ],
};

// ── Anger, aggression and self-esteem ───────────────────────────────────
// None of these is a diagnostic test. The DAR-5 has a published screening
// cut-off; the Buss–Perry and Rosenberg scales are read against the client's
// own earlier scores, so their wording never claims a clinical threshold.

const CHARACTERISTIC = [
  { value: 1, label: 'Extremely uncharacteristic of me' },
  { value: 2, label: 'Somewhat uncharacteristic of me' },
  { value: 3, label: 'Neither uncharacteristic nor characteristic of me' },
  { value: 4, label: 'Somewhat characteristic of me' },
  { value: 5, label: 'Extremely characteristic of me' },
];

const bpaq = (n: number[]) => n.map((i) => `bpaq_${i}`);

export const BPAQ: InstrumentDefinition = {
  key: 'BPAQ',
  name: 'Buss–Perry Aggression Questionnaire (BPAQ)',
  shortName: 'Buss–Perry AQ',
  measures: 'Aggression: physical, verbal, anger and hostility',
  description: 'This questionnaire asks about patterns of irritability, anger and conflict in everyday life. Your practitioner may use it to understand how you manage frustration and to plan support with you.',
  instructions: 'Using the scale, say how characteristic or uncharacteristic each statement is of you. There are no right or wrong answers: answer for how you usually are, not how you would like to be.',
  estimatedMinutes: 10,
  tier: 'PRO',
  clientResults: 'summary',
  source: 'Buss & Perry (1992), Journal of Personality and Social Psychology 63(3), 452–459. Items 9 and 16 are reverse-scored.',
  scale: CHARACTERISTIC,
  items: items('bpaq', [
    'Some of my friends think I am a hothead.',
    'If I have to resort to violence to protect my rights, I will.',
    'When people are especially nice to me, I wonder what they want.',
    'I tell my friends openly when I disagree with them.',
    'I have become so mad that I have broken things.',
    "I can't help getting into arguments when people disagree with me.",
    'I wonder why sometimes I feel so bitter about things.',
    "Once in a while, I can't control the urge to strike another person.",
    'I am an even-tempered person.',
    'I am suspicious of overly friendly strangers.',
    'I have threatened people I know.',
    'I flare up quickly but get over it quickly.',
    'Given enough provocation, I may hit another person.',
    'When people annoy me, I may tell them what I think of them.',
    'I am sometimes eaten up with jealousy.',
    'I can think of no good reason for ever hitting a person.',
    'At times I feel I have gotten a raw deal out of life.',
    'I have trouble controlling my temper.',
    'When frustrated, I let my irritation show.',
    'I sometimes feel that people are laughing at me behind my back.',
    'I often find myself disagreeing with people.',
    'If somebody hits me, I hit back.',
    'I sometimes feel like a powder keg ready to explode.',
    'Other people always seem to get the breaks.',
    'There are people who pushed me so far that we came to blows.',
    'I know that "friends" talk about me behind my back.',
    "My friends say that I'm somewhat argumentative.",
    'Sometimes I fly off the handle for no good reason.',
    'I get into fights a little more than a normal person.',
  ]),
  scoring: {
    total: { from: 'subscales' },
    reverse: bpaq([9, 16]),
    headline: 'total',
    // No validated clinical cut-off: one band, read against the client's baseline.
    bands: [
      {
        min: 29, label: 'Scored', level: 0,
        clinicianText: 'Total 29–145; higher means more aggression. There is no clinical cut-off: compare the subscale profile and the client’s own earlier scores.',
        clientText: 'Thank you for completing this. Your practitioner will go through it with you, and doing it again later will show how things are changing.',
      },
    ],
    subscales: [
      { key: 'physical', label: 'Physical aggression', items: bpaq([2, 5, 8, 11, 13, 16, 22, 25, 29]) },
      { key: 'verbal', label: 'Verbal aggression', items: bpaq([4, 6, 14, 21, 27]) },
      { key: 'anger', label: 'Anger', items: bpaq([1, 9, 12, 18, 19, 23, 28]) },
      { key: 'hostility', label: 'Hostility', items: bpaq([3, 7, 10, 15, 17, 20, 24, 26]) },
    ],
  },
  rules: [
    {
      key: 'urge_to_strike',
      when: { item: 'bpaq_8', op: '>=', value: 4 },
      level: 'attention',
      clinicianMessage: 'Rated losing control of the urge to strike someone as characteristic of them (item 8). Ask about physical aggression and who is at risk.',
    },
    {
      key: 'threatened_people',
      when: { item: 'bpaq_11', op: '>=', value: 4 },
      level: 'attention',
      clinicianMessage: 'Rated threatening people they know as characteristic of them (item 11). Ask about threats and who is at risk.',
    },
  ],
};

export const DAR_5: InstrumentDefinition = {
  key: 'DAR_5',
  name: 'Dimensions of Anger Reactions (DAR-5)',
  shortName: 'DAR-5',
  measures: 'Anger: how often, how intense, how long, and its effect',
  description: 'This short questionnaire asks about how often anger occurs, how strong it feels and how it affects you. It helps your practitioner understand anger patterns so you can both plan ways to manage them.',
  instructions: 'Over the last 4 weeks, how much of the time has each of these been true for you?',
  estimatedMinutes: 2,
  tier: 'STARTER',
  clientResults: 'summary',
  source: 'Forbes et al. (2014), Journal of Affective Disorders 168, 1–7. Free to use. A total of 12 or more is the screening cut-off.',
  scale: [
    { value: 1, label: 'None or almost none of the time' },
    { value: 2, label: 'A little of the time' },
    { value: 3, label: 'Some of the time' },
    { value: 4, label: 'A lot of the time' },
    { value: 5, label: 'All or almost all of the time' },
  ],
  items: items('dar5', [
    'I found myself getting angry at people or situations.',
    'When I got angry, I got really mad.',
    'When I got angry, I stayed angry.',
    'When I got angry at someone, I wanted to hit them.',
    "My anger prevented me from getting along with people as well as I'd have liked to.",
  ]),
  scoring: {
    total: { from: 'items' },
    headline: 'total',
    bands: [
      {
        min: 5, label: 'Below the cut-off', level: 0,
        clinicianText: 'Total 5–11: below the screening cut-off for problematic anger.',
        clientText: 'Your answers suggest anger has not been causing you many problems over the past four weeks.',
      },
      {
        min: 12, label: 'Above the cut-off', level: 2,
        clinicianText: 'Total 12 or more: above the screening cut-off for problematic anger. Explore frequency, intensity, duration and impact.',
        clientText: 'Your answers suggest anger has been affecting you and the people around you. Your practitioner will talk this through with you.',
      },
    ],
  },
  rules: [
    {
      key: 'wanted_to_hit',
      when: { item: 'dar5_4', op: '>=', value: 4 },
      level: 'attention',
      clinicianMessage: 'Wanted to hit someone when angry a lot or all of the time in the last 4 weeks (item 4). Ask about physical aggression and who is at risk.',
    },
  ],
};

export const RSES: InstrumentDefinition = {
  key: 'RSES',
  name: 'Rosenberg Self-Esteem Scale (RSES)',
  shortName: 'Rosenberg',
  measures: 'Self-esteem',
  description: 'This questionnaire asks about how you generally view yourself and your worth. Your practitioner may use it to understand self-perception and to track changes over time together with you.',
  instructions: 'Below is a list of statements about how you feel about yourself in general. Choose how strongly you agree or disagree with each one.',
  estimatedMinutes: 3,
  tier: 'STARTER',
  clientResults: 'summary',
  source: 'Rosenberg (1965), Society and the Adolescent Self-Image. Free to use. Items 2, 5, 6, 8 and 9 are reverse-scored.',
  scale: [
    { value: 3, label: 'Strongly agree' },
    { value: 2, label: 'Agree' },
    { value: 1, label: 'Disagree' },
    { value: 0, label: 'Strongly disagree' },
  ],
  items: items('rses', [
    'On the whole, I am satisfied with myself.',
    'At times I think I am no good at all.',
    'I feel that I have a number of good qualities.',
    'I am able to do things as well as most other people.',
    'I feel I do not have much to be proud of.',
    'I certainly feel useless at times.',
    "I feel that I'm a person of worth, at least on an equal plane with others.",
    'I wish I could have more respect for myself.',
    'All in all, I am inclined to feel that I am a failure.',
    'I take a positive attitude toward myself.',
  ]),
  scoring: {
    total: { from: 'items' },
    reverse: ['rses_2', 'rses_5', 'rses_6', 'rses_8', 'rses_9'],
    headline: 'total',
    // Higher is better here: the lowest band is the one to notice.
    bands: [
      {
        min: 0, label: 'Low self-esteem', level: 2,
        clinicianText: 'Total below 15 (of 30): low self-esteem. Explore with the client; there is no formal clinical cut-off, so compare over time.',
        clientText: 'Your answers suggest you are being quite hard on yourself at the moment. Your practitioner will talk this through with you.',
      },
      {
        min: 15, label: 'Typical range', level: 0,
        clinicianText: 'Total 15–25 (of 30): the usual range of self-esteem.',
        clientText: 'Your answers suggest you see yourself in a generally balanced way.',
      },
      {
        min: 26, label: 'High self-esteem', level: 0,
        clinicianText: 'Total 26–30 (of 30): high self-esteem.',
        clientText: 'Your answers suggest you feel positively about yourself.',
      },
    ],
  },
  rules: [],
};

export const BUILTIN_INSTRUMENTS: InstrumentDefinition[] = [PHQ_9, GAD_7, PCL_5, DASS_21, BPAQ, DAR_5, RSES];
