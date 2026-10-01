export type Step = 1 | 2 | 3 | 4 | 5;
export type FormatFilter = 'All' | 'Online' | 'In person';

export interface WizardState {
  step: Step;
  /** Where the wizard starts: 2 when the practice has one service and step 1 is skipped. */
  firstStep: 1 | 2;
  serviceId: string | null;
  weekIndex: 0 | 1 | 2 | 3;
  /** 'YYYY-MM-DD' in West Africa Time. */
  date: string | null;
  slotId: string | null;
  formatFilter: FormatFilter;
  note: string;
  discount: { code: string; status: 'idle' | 'applied' | 'invalid'; savingKobo: string; finalKobo: string | null };
  payMethod: 'online' | 'transfer';
  paymentStatus: 'idle' | 'pending' | 'failed' | 'paid';
  /** Shows "That time was just booked" on step 2. */
  slotTaken: boolean;
  /** Set once a booking exists, so a retried payment reuses it. */
  bookingId: string | null;
}

export type WizardAction =
  | { type: 'chooseService'; serviceId: string }
  | { type: 'setWeek'; weekIndex: 0 | 1 | 2 | 3 }
  | { type: 'chooseDate'; date: string }
  | { type: 'chooseSlot'; slotId: string }
  | { type: 'setFilter'; filter: FormatFilter }
  | { type: 'setNote'; note: string }
  | { type: 'discount'; discount: WizardState['discount'] }
  | { type: 'setPayMethod'; method: 'online' | 'transfer' }
  | { type: 'goTo'; step: Step }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'slotTaken' }
  | { type: 'booked'; bookingId: string }
  | { type: 'paymentFailed' }
  | { type: 'paid' };

export const STEP_PARAM: Record<Step, string> = { 1: 'service', 2: 'time', 3: 'details', 4: 'pay', 5: 'done' };

const NO_DISCOUNT: WizardState['discount'] = { code: '', status: 'idle', savingKobo: '0', finalKobo: null };

export function initialState({ singleServiceId }: { singleServiceId?: string | null }): WizardState {
  const single = Boolean(singleServiceId);
  return {
    step: single ? 2 : 1,
    firstStep: single ? 2 : 1,
    serviceId: singleServiceId ?? null,
    weekIndex: 0,
    date: null,
    slotId: null,
    formatFilter: 'All',
    note: '',
    discount: NO_DISCOUNT,
    payMethod: 'online',
    paymentStatus: 'idle',
    slotTaken: false,
    bookingId: null,
  };
}

/** The first step whose choice is still missing: sign-in is checked live, so it counts as step 3. */
function firstIncomplete(s: WizardState): Step {
  if (!s.serviceId) return 1;
  if (!s.slotId) return 2;
  return 3;
}

export function canContinue(s: WizardState, signedIn: boolean): boolean {
  switch (s.step) {
    case 1:
      return Boolean(s.serviceId);
    case 2:
      return Boolean(s.slotId);
    case 3:
      return signedIn;
    default:
      return true;
  }
}

export function wizardReducer(s: WizardState, a: WizardAction): WizardState {
  switch (a.type) {
    case 'chooseService':
      if (a.serviceId === s.serviceId) return s;
      // A different service has different times and formats.
      return { ...s, serviceId: a.serviceId, slotId: null, formatFilter: 'All', discount: NO_DISCOUNT, bookingId: null };
    case 'setWeek':
      return { ...s, weekIndex: a.weekIndex };
    case 'chooseDate':
      return a.date === s.date ? s : { ...s, date: a.date, slotId: null };
    case 'chooseSlot':
      return { ...s, slotId: a.slotId, slotTaken: false, bookingId: null };
    case 'setFilter':
      return { ...s, formatFilter: a.filter };
    case 'setNote':
      return { ...s, note: a.note };
    case 'discount':
      return { ...s, discount: a.discount };
    case 'setPayMethod':
      return { ...s, payMethod: a.method, paymentStatus: 'idle' };
    case 'goTo':
      // Only back to a step already done; going forward is what Continue is for.
      return a.step >= s.firstStep && a.step < s.step ? { ...s, step: a.step } : s;
    case 'next':
      return s.step < 4 ? { ...s, step: (s.step + 1) as Step } : s;
    case 'back':
      return s.step > s.firstStep && s.step < 5 ? { ...s, step: (s.step - 1) as Step } : s;
    case 'slotTaken':
      return { ...s, step: 2, slotId: null, slotTaken: true, bookingId: null, paymentStatus: 'idle' };
    case 'booked':
      return { ...s, bookingId: a.bookingId, paymentStatus: 'pending' };
    case 'paymentFailed':
      return { ...s, step: 4, paymentStatus: 'failed' };
    case 'paid':
      return { ...s, step: 5, paymentStatus: 'paid' };
    default:
      return s;
  }
}

/** The step to show for `?step=`: never one whose earlier choices are missing. */
export function stepFromUrl(raw: string | null, s: WizardState): Step {
  const entry = Object.entries(STEP_PARAM).find(([, name]) => name === raw);
  if (!entry) return s.step;
  const wanted = Number(entry[0]) as Step;
  const allowed = Math.max(s.firstStep, Math.min(wanted, firstIncomplete(s))) as Step;
  return allowed;
}
