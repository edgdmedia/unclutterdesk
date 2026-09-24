import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../utils/apiClient';
import type { ClientResult, OpenedAssessment } from '../../utils/assessments';
import { AssessmentQuestionnaire } from '../../components/assessments/AssessmentQuestionnaire';
import { ClientResultView } from '../../components/assessments/ClientResultView';
import { AssessmentMessage, AssessmentShell } from '../../components/assessments/AssessmentShell';

/** An assessment opened from the client portal: fill it in, or read the result. */
export function PortalAssessmentPage() {
  const { id = '' } = useParams();
  const [opened, setOpened] = useState<OpenedAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<ClientResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<OpenedAssessment>(`/v1/assessments/mine/${encodeURIComponent(id)}`)
      .then((data) => {
        if (!cancelled) setOpened(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'This assessment could not be opened.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const practice = opened?.practice ?? null;
  const color = practice?.primaryColor || '#0F3A53';
  const back = (
    <Link to="/portal" className="text-xs font-bold text-[#475569] inline-flex items-center gap-1">
      <ArrowLeft className="h-3.5 w-3.5" /> Portal
    </Link>
  );

  if (error) return <AssessmentShell back={back}><AssessmentMessage title="Not available" body={error} /></AssessmentShell>;
  if (!opened) return <AssessmentShell back={back}><p className="text-sm text-[#64748B]">Loading…</p></AssessmentShell>;

  if (justDone || opened.status === 'COMPLETED') {
    const result = justDone ?? (opened.status === 'COMPLETED' ? opened.result : null);
    return (
      <AssessmentShell practice={practice} back={back}>
        {opened.status === 'COMPLETED' && !justDone ? (
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em]" style={{ color }}>
            {opened.shortName}
            {opened.completedAt ? ` · ${new Date(opened.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </p>
        ) : null}
        <ClientResultView result={result} color={color} practiceName={opened.practice.name} thankYou={Boolean(justDone)} />
      </AssessmentShell>
    );
  }
  if (opened.status !== 'OPEN') {
    return <AssessmentShell practice={practice} back={back}><AssessmentMessage title="This assessment was withdrawn" body="Your practitioner cancelled it." /></AssessmentShell>;
  }
  return (
    <AssessmentShell practice={practice} back={back}>
      <AssessmentQuestionnaire
        assessment={opened.assessment}
        color={color}
        firstName={opened.firstName}
        message={opened.message}
        onSubmit={async (answers) => {
          const done = await api.post<{ result: ClientResult }>(`/v1/assessments/mine/${encodeURIComponent(id)}`, { answers });
          setJustDone(done.result);
          window.scrollTo({ top: 0 });
        }}
      />
    </AssessmentShell>
  );
}
