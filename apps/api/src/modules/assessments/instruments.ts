/**
 * The platform's library of standard assessments.
 *
 * Unlike forms, these are not per-practice data: the wording, the answer scale
 * and the scoring are fixed by the published instrument, so they live here in
 * code and no practice can edit them. A practice only switches an instrument
 * on, sends it to clients, and reads the results.
 *
 * Adding one means adding an entry here with its scoring, and a test.
 * All four below are free to use for clinical purposes.
 *
 * These are screening tools. Results support a clinician's judgement; they
 * are not a diagnosis, and every result screen says so.
 */

export type Severity = { label: string; level: 0 | 1 | 2 | 3 | 4 };

export interface Subscale {
  key: string;
  label: string;
  score: number;
  max: number;
  severity: Severity;
}

export interface AssessmentResult {
  totalScore: number;
  maxScore: number;
  severity: Severity;
  subscales: Subscale[];
  /** Answers a clinician must see promptly, e.g. PHQ-9 item 9 above zero. */
  flags: Array<{ key: string; message: string }>;
}

export interface Instrument {
  key: string;
  name: string;
  shortName: string;
  measures: string;
  /** Shown to the client above the questions. */
  instructions: string;
  /** Answer choices, in order; the index is the item's score. */
  scale: string[];
  items: Array<{ id: string; text: string }>;
  estimatedMinutes: number;
  score(answers: Record<string, number>): AssessmentResult;
}

const band = (score: number, bands: Array<[number, string]>): Severity => {
  let level = 0;
  for (let i = 0; i < bands.length; i++) if (score >= bands[i][0]) level = i;
  return { label: bands[level][1], level: Math.min(level, 4) as Severity['level'] };
};

const sum = (answers: Record<string, number>, ids: string[]) => ids.reduce((t, id) => t + answers[id], 0);

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}_${i + 1}`);

const FREQUENCY_2W = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];

const PHQ9: Instrument = {
  key: 'PHQ_9',
  name: 'Patient Health Questionnaire (PHQ-9)',
  shortName: 'PHQ-9',
  measures: 'Depression',
  instructions: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
  scale: FREQUENCY_2W,
  estimatedMinutes: 3,
  items: [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself, or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading or watching television',
    'Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead, or of hurting yourself in some way',
  ].map((text, i) => ({ id: `phq9_${i + 1}`, text })),
  score(a) {
    const total = sum(a, ids('phq9', 9));
    return {
      totalScore: total,
      maxScore: 27,
      severity: band(total, [[0, 'Minimal'], [5, 'Mild'], [10, 'Moderate'], [15, 'Moderately severe'], [20, 'Severe']]),
      subscales: [],
      flags:
        a.phq9_9 > 0
          ? [{ key: 'self_harm', message: 'Answered above zero on thoughts of being better off dead or of self-harm (item 9). Follow up promptly.' }]
          : [],
    };
  },
};

const GAD7: Instrument = {
  key: 'GAD_7',
  name: 'Generalized Anxiety Disorder scale (GAD-7)',
  shortName: 'GAD-7',
  measures: 'Anxiety',
  instructions: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
  scale: FREQUENCY_2W,
  estimatedMinutes: 2,
  items: [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid, as if something awful might happen',
  ].map((text, i) => ({ id: `gad7_${i + 1}`, text })),
  score(a) {
    const total = sum(a, ids('gad7', 7));
    return {
      totalScore: total,
      maxScore: 21,
      severity: band(total, [[0, 'Minimal'], [5, 'Mild'], [10, 'Moderate'], [15, 'Severe']]),
      subscales: [],
      flags: [],
    };
  },
};

const PCL5_CLUSTERS: Array<[string, string, number[]]> = [
  ['intrusion', 'Intrusion (B)', [1, 2, 3, 4, 5]],
  ['avoidance', 'Avoidance (C)', [6, 7]],
  ['cognition_mood', 'Negative thoughts and mood (D)', [8, 9, 10, 11, 12, 13, 14]],
  ['arousal', 'Arousal and reactivity (E)', [15, 16, 17, 18, 19, 20]],
];

const PCL5: Instrument = {
  key: 'PCL_5',
  name: 'PTSD Checklist for DSM-5 (PCL-5)',
  shortName: 'PCL-5',
  measures: 'Post-traumatic stress',
  instructions:
    'Below is a list of problems that people sometimes have in response to a very stressful experience. Keeping your worst event in mind, please read each problem and indicate how much you have been bothered by that problem in the past month.',
  scale: ['Not at all', 'A little bit', 'Moderately', 'Quite a bit', 'Extremely'],
  estimatedMinutes: 7,
  items: [
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
  ].map((text, i) => ({ id: `pcl5_${i + 1}`, text })),
  score(a) {
    const total = sum(a, ids('pcl5', 20));
    return {
      totalScore: total,
      maxScore: 80,
      // 31–33 is the commonly used cut-off for probable PTSD.
      severity: total >= 33 ? { label: 'Probable PTSD: further assessment indicated', level: 3 } : total >= 31 ? { label: 'Near the cut-off', level: 2 } : { label: 'Below the cut-off', level: 0 },
      subscales: PCL5_CLUSTERS.map(([key, label, items]) => {
        const score = sum(a, items.map((n) => `pcl5_${n}`));
        return { key, label, score, max: items.length * 4, severity: { label: '', level: 0 } };
      }),
      flags:
        a.pcl5_16 >= 3
          ? [{ key: 'risk_taking', message: 'Reported taking too many risks or doing things that could cause harm (item 16) "Quite a bit" or more.' }]
          : [],
    };
  },
};

// DASS-21 subscale items; each subscale is summed and doubled to match the DASS-42 norms.
const DASS: Array<[string, string, number[], Array<[number, string]>]> = [
  ['depression', 'Depression', [3, 5, 10, 13, 16, 17, 21], [[0, 'Normal'], [10, 'Mild'], [14, 'Moderate'], [21, 'Severe'], [28, 'Extremely severe']]],
  ['anxiety', 'Anxiety', [2, 4, 7, 9, 15, 19, 20], [[0, 'Normal'], [8, 'Mild'], [10, 'Moderate'], [15, 'Severe'], [20, 'Extremely severe']]],
  ['stress', 'Stress', [1, 6, 8, 11, 12, 14, 18], [[0, 'Normal'], [15, 'Mild'], [19, 'Moderate'], [26, 'Severe'], [34, 'Extremely severe']]],
];

const DASS21: Instrument = {
  key: 'DASS_21',
  name: 'Depression Anxiety Stress Scales (DASS-21)',
  shortName: 'DASS-21',
  measures: 'Depression, anxiety and stress',
  instructions:
    'Please read each statement and choose the answer that shows how much the statement applied to you over the past week. There are no right or wrong answers.',
  scale: [
    'Did not apply to me at all',
    'Applied to me to some degree, or some of the time',
    'Applied to me to a considerable degree, or a good part of the time',
    'Applied to me very much, or most of the time',
  ],
  estimatedMinutes: 5,
  items: [
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
  ].map((text, i) => ({ id: `dass21_${i + 1}`, text })),
  score(a) {
    const subscales = DASS.map(([key, label, items, bands]) => {
      const score = sum(a, items.map((n) => `dass21_${n}`)) * 2;
      return { key, label, score, max: 42, severity: band(score, bands) };
    });
    const worst = subscales.reduce((w, s) => (s.severity.level > w.severity.level ? s : w), subscales[0]);
    return {
      totalScore: subscales.reduce((t, s) => t + s.score, 0),
      maxScore: 126,
      severity: worst.severity.level === 0 ? { label: 'Normal on all scales', level: 0 } : { label: `${worst.severity.label} ${worst.label.toLowerCase()}`, level: worst.severity.level },
      subscales,
      flags:
        a.dass21_21 >= 2
          ? [{ key: 'meaningless', message: 'Reported feeling that life was meaningless (item 21) to a considerable degree or more. Follow up promptly.' }]
          : [],
    };
  },
};

export const INSTRUMENTS: Instrument[] = [PHQ9, GAD7, PCL5, DASS21];

export function instrument(key: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.key === key);
}

/**
 * Checks a client's answers before scoring: every item answered, each with a
 * whole number on the instrument's own scale. Returns the cleaned answers.
 */
export function validateAnswers(inst: Instrument, raw: unknown): Record<string, number> | string {
  if (!raw || typeof raw !== 'object') return 'Answers are missing.';
  const answers: Record<string, number> = {};
  const max = inst.scale.length - 1;
  for (const item of inst.items) {
    const value = Number((raw as Record<string, unknown>)[item.id]);
    if (!Number.isInteger(value) || value < 0 || value > max) {
      return 'Please answer every question.';
    }
    answers[item.id] = value;
  }
  return answers;
}

/** What the library shows: the instrument without its scoring function. */
export function publicDefinition(inst: Instrument) {
  const { score: _score, ...definition } = inst;
  return definition;
}
