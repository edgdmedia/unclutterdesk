import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, useBrand } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { RichTextView } from '../../../components/richText/RichTextView';
import { PortalJournalCard } from './PortalJournalCard';

interface RecapAssessment {
  id: string;
  key: string;
  shortName: string;
  name: string;
  estimatedMinutes: number;
  status: 'SENT' | 'COMPLETED';
}

interface Recap {
  id: string;
  serviceTitle: string;
  startsAt: string;
  therapistName: string;
  sentAt: string;
  recap: string;
  ticks: boolean[];
  assessments: RecapAssessment[];
}

const whenFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * A session's recap, as the practitioner wrote it: what was covered and what
 * to practise. Tick-box items can be ticked off as the client goes (saved for
 * them), and any questionnaires sent with it start from here.
 */
export function PortalRecapPage() {
  const { id = '' } = useParams<{ id: string }>();
  const brand = useBrand();
  const [search] = useSearchParams();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Ticks save one after another, so a quick run of ticks lands in order.
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    api
      .get<Recap>(`/v1/consult/portal/sessions/${encodeURIComponent(id)}/recap`)
      .then((r) => live && setRecap(r))
      .catch((err) => live && setError(err instanceof Error ? err.message : 'This recap could not be opened.'));
    return () => {
      live = false;
    };
  }, [id]);

  function tick(index: number, checked: boolean) {
    if (!recap) return;
    const ticks = recap.ticks.map((t, i) => (i === index ? checked : t));
    setRecap({ ...recap, ticks });
    setSaveError(null);
    saving.current = saving.current
      .then(() => api.put(`/v1/consult/portal/sessions/${encodeURIComponent(id)}/recap/ticks`, { ticks }))
      .catch(() => setSaveError('Your tick was not saved. Check your connection and try again.'));
  }

  const back = (
    <Link to="/portal/sessions?view=past" className="text-xs font-bold text-[var(--desk-text-body)] inline-flex items-center gap-1">
      <ArrowLeft className="h-3.5 w-3.5" /> Sessions
    </Link>
  );

  if (error) {
    return (
      <Page header={<PageHeader eyebrow={brand.name} title="Session recap" />}>
        {back}
        <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      </Page>
    );
  }
  if (!recap) {
    return (
      <Page header={<PageHeader eyebrow={brand.name} title="Session recap" />}>
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[var(--desk-text-muted)]" /></div>
      </Page>
    );
  }

  const done = recap.ticks.filter(Boolean).length;
  // Wide screens: the recap reads in the main column; what she does next
  // (her Journal plan, any questionnaires) sits beside it. Narrow: one column.
  return (
    <Page
      layout="main-aside"
      header={<PageHeader eyebrow={brand.name} title="Session recap" />}
      aside={
        <>
          <PortalJournalCard bookingId={recap.id} notice={search.get('journal')} />
          {recap.assessments.length ? (
            <Card padding="p-[22px_24px]" className="space-y-3">
              <Eyebrow>QUESTIONNAIRES FROM YOUR PRACTITIONER</Eyebrow>
              <ul className="space-y-2">
                {recap.assessments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 flex-wrap rounded-[14px] border border-[var(--desk-border)] px-4 py-3">
                    <ClipboardList className="h-4 w-4 text-[var(--desk-text-muted)] shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold text-[var(--desk-text)]">{a.name}</div>
                      <div className="text-[12px] text-[var(--desk-text-muted)] font-medium">About {a.estimatedMinutes} minutes · your answers go only to your practitioner</div>
                    </div>
                    {a.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--desk-active)]">
                        <CheckCircle2 className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <Link
                        to={`/portal/assessments/${a.id}`}
                        className="h-[34px] px-3.5 rounded-[10px] text-white text-[12.5px] font-bold inline-flex items-center"
                        style={{ backgroundColor: brand.primaryColor || '#0F3A53' }}
                      >
                        Start {a.shortName}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      }
    >
      {back}
      <Card padding="p-[22px_24px]" className="space-y-4">
        <div className="border-b border-[var(--desk-border)] pb-3">
          <h2 className="text-[17px] font-bold text-[var(--desk-text)]">{recap.serviceTitle}</h2>
          <p className="text-[12.5px] text-[var(--desk-text-muted)] font-medium">
            {whenFormat.format(new Date(recap.startsAt))} · with {recap.therapistName}
          </p>
        </div>
        <RichTextView value={recap.recap} ticks={recap.ticks} onTick={tick} className="text-[14px]" />
        {recap.ticks.length ? (
          <p className="text-[12px] font-semibold text-[var(--desk-text-muted)]" aria-live="polite">
            {done} of {recap.ticks.length} ticked off. Your ticks are saved for you.
          </p>
        ) : null}
        {saveError ? <p role="alert" className="text-[12px] font-semibold text-rose-700">{saveError}</p> : null}
      </Card>
    </Page>
  );
}
