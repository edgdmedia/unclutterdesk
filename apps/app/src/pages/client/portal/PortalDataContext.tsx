import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../../utils/apiClient';
import { useAuth } from '../../../context/AuthContext';
import type { MyAssessment } from '../../../utils/assessments';
import type { ManualPayment } from '../../../components/payments/TransferDetails';

export type PortalSession = {
  icalToken?: string;
  id: string;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  status: string;
  priceKobo: string;
  therapistName: string;
  /** SET-06: online sessions are joined in the room; in person ones have none. */
  format?: string;
  paymentMethod?: string;
  manualPayment?: ManualPayment | null;
};

export type PortalPayload = {
  clientName: string;
  upcoming: PortalSession[];
  past: PortalSession[];
};

export type Payment = {
  bookingId: string;
  serviceTitle: string;
  sessionAt: string;
  amountKobo: string;
  discountCode: string | null;
  status: string;
  paidAt: string | null;
  reference: string | null;
  bookedAt: string;
};

export type PaymentsPayload = {
  payments: Payment[];
  totalPaidKobo: string;
  outstandingKobo: string;
};

interface PortalData {
  portal: PortalPayload;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
  formsList: Array<{ id: string; title?: string }>;
  formsTodo: number | null;
  assessments: MyAssessment[];
  waitingAssessments: MyAssessment[];
  hasReviewForm: boolean;
  /** Bumped whenever a booking moves elsewhere, so Payments refetches on next mount. */
  paymentsStale: number;
  markPaymentsStale(): void;
}

const EMPTY: PortalPayload = { clientName: '', upcoming: [], past: [] };

const PortalDataContext = createContext<PortalData | null>(null);

/**
 * POR-03: one data source for all portal pages. Mounted once in ClientShell,
 * so moving between pages never refetches or flashes empty. Payments stay
 * lazy — the Payments page fetches them itself, only when it mounts.
 */
export function PortalDataProvider({ children }: { children: ReactNode }) {
  const { profile, isAuthenticated } = useAuth();
  const [portal, setPortal] = useState<PortalPayload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReviewForm, setHasReviewForm] = useState(false);
  const [formsList, setFormsList] = useState<Array<{ id: string; title?: string }>>([]);
  const [assessments, setAssessments] = useState<MyAssessment[]>([]);
  const [paymentsStale, setPaymentsStale] = useState(0);
  const markPaymentsStale = useCallback(() => setPaymentsStale((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function loadReviewAvailability() {
      try {
        const forms = await api.get<Array<{ id: string }>>('/v1/intake/public/forms?targetType=REVIEW');
        if (!cancelled) setHasReviewForm(forms.length > 0);
      } catch {
        if (!cancelled) setHasReviewForm(false);
      }
    }

    void loadReviewAvailability();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && profile?.email) {
      void loadPortal();
      return;
    }
    // Signed out (or the session ended): nothing private stays on screen.
    setPortal(EMPTY);
    setFormsList([]);
    setAssessments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, profile?.email]);

  // The server identifies the client from the session. It used to accept any
  // email in the query string, which meant anyone could read anyone's sessions.
  async function loadPortal() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get<PortalPayload>('/v1/consult/portal');
      setPortal(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load portal');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get<Array<{ id: string; title?: string }>>('/v1/intake/mine/forms')
      .then((f) => setFormsList(f))
      .catch(() => setFormsList([]));
  }, [isAuthenticated]);

  // Assessments the practitioner sent: waiting ones are shown up top.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .get<MyAssessment[]>('/v1/assessments/mine')
      .then((rows) => {
        if (!cancelled) setAssessments(rows);
      })
      .catch(() => {
        // Not fatal: the rest of the portal still works.
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const waitingAssessments = useMemo(() => assessments.filter((a) => a.status === 'SENT'), [assessments]);

  const value: PortalData = {
    portal,
    loading,
    error,
    reload: loadPortal,
    formsList,
    formsTodo: isAuthenticated ? formsList.length : null,
    assessments,
    waitingAssessments,
    hasReviewForm,
    paymentsStale,
    markPaymentsStale,
  };

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData(): PortalData {
  const value = useContext(PortalDataContext);
  if (!value) throw new Error('usePortalData must be used inside PortalDataProvider');
  return value;
}
