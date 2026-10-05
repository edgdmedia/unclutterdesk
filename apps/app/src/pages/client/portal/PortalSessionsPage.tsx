import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Page, PageHeader, SegmentedControl, useBrand } from '@unclutterdesk/ui';
import { RescheduleDialog } from '../../../components/RescheduleDialog';
import { usePortalData } from './PortalDataContext';
import { PortalSessionCard } from './PortalSessionCard';
import { BookSessionButton } from './BookSessionButton';
import { DateTile } from './DateTile';
import { formatTimeRange } from './portalFormat';

/** POR-03: every session, upcoming and past. The view lives in the URL so Back works. */
export function PortalSessionsPage() {
  const brand = useBrand();
  const { portal, reload, markPaymentsStale } = usePortalData();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'past' ? 'past' : 'upcoming';
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  return (
    <>
      <Page
        header={
          <PageHeader
            eyebrow={brand.name}
            title="Sessions"
            actions={<BookSessionButton />}
            secondaryActions={
              <SegmentedControl
                options={['Upcoming', 'Past']}
                value={view === 'past' ? 'Past' : 'Upcoming'}
                onChange={(label: string) => setParams(label === 'Past' ? { view: 'past' } : {}, { replace: true })}
              />
            }
          />
        }
      >
        <div className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden divide-y divide-[#F1F5F9]">
          {(view === 'upcoming' ? portal.upcoming : portal.past).length === 0 ? (
            <div className="px-5 py-10 text-sm font-medium text-[#64748B]">
              {view === 'upcoming' ? 'No upcoming sessions. Book one when it suits you.' : 'No completed or past sessions yet.'}
            </div>
          ) : view === 'upcoming' ? (
            portal.upcoming.map((session) => <PortalSessionCard key={session.id} session={session} onReschedule={setReschedulingId} />)
          ) : (
            portal.past.map((session) => (
              <div key={session.id} className="flex items-center gap-4 px-5 py-[16px]">
                <DateTile startsAt={session.startsAt} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-[#0F172A]">{session.serviceTitle}</div>
                  <div className="text-[12px] text-[#64748B] font-medium">{formatTimeRange(session.startsAt, session.endsAt)} · with {session.therapistName}</div>
                </div>
                <span className="h-[22px] px-2.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[9.5px] font-black tracking-[0.06em] uppercase flex items-center gap-1">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  {session.status}
                </span>
              </div>
            ))
          )}
        </div>
      </Page>
      {reschedulingId ? (
        <RescheduleDialog
          bookingId={reschedulingId}
          primaryColor={brand.primaryColor || '#0F3A53'}
          onClose={() => setReschedulingId(null)}
          onRescheduled={() => {
            setReschedulingId(null);
            markPaymentsStale();
            void reload();
          }}
        />
      ) : null}
    </>
  );
}
