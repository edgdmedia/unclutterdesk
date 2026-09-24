import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../utils/apiClient';
import type { ClientResult, OpenedAssessment } from '../../utils/assessments';
import { AssessmentQuestionnaire } from '../../components/assessments/AssessmentQuestionnaire';
import { ClientResultView } from '../../components/assessments/ClientResultView';
import { AssessmentMessage, AssessmentShell } from '../../components/assessments/AssessmentShell';

/**
 * What a client sees when they open the link in their email. Branded as the
 * practice. The result the client may see is shown straight after they
 * submit; reopening the link later only says it is done, because emailed
 * links get forwarded. Their results stay in the portal.
 */
export function AssessmentPage() {
  const { token = '' } = useParams();
  const [opened, setOpened] = useState<OpenedAssessment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<ClientResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<OpenedAssessment>(`/v1/assessments/public/${encodeURIComponent(token)}`)
      .then((data) => {
        if (!cancelled) setOpened(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'This link could not be opened.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const practice = opened?.practice ?? null;
  const color = practice?.primaryColor || '#0F3A53';

  if (loadError) {
    return <AssessmentShell><AssessmentMessage title="This link is not working" body={`${loadError} Ask your practitioner to send a new one.`} /></AssessmentShell>;
  }
  if (!opened) return <AssessmentShell><p className="text-sm text-[#64748B]">Loading…</p></AssessmentShell>;

  if (result) {
    return (
      <AssessmentShell practice={practice}>
        <ClientResultView result={result} color={color} practiceName={opened.practice.name} thankYou />
      </AssessmentShell>
    );
  }
  if (opened.status === 'COMPLETED') {
    return (
      <AssessmentShell practice={practice}>
        <AssessmentMessage
          title="You have already completed this"
          body={<>Thank you. Your practitioner has your answers. <Link to="/login" className="font-bold underline" style={{ color }}>Sign in</Link> to see your assessments.</>}
        />
      </AssessmentShell>
    );
  }
  if (opened.status !== 'OPEN') {
    return <AssessmentShell practice={practice}><AssessmentMessage title="This assessment was withdrawn" body={`Ask ${opened.practice.name} if you think this is a mistake.`} /></AssessmentShell>;
  }

  return (
    <AssessmentShell practice={practice}>
      <AssessmentQuestionnaire
        assessment={opened.assessment}
        color={color}
        firstName={opened.firstName}
        message={opened.message}
        onSubmit={async (answers) => {
          const done = await api.post<{ result: ClientResult }>(`/v1/assessments/public/${encodeURIComponent(token)}`, { answers });
          setResult(done.result);
          window.scrollTo({ top: 0 });
        }}
      />
    </AssessmentShell>
  );
}
