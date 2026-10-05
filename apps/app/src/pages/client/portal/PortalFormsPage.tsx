import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, useBrand } from '@unclutterdesk/ui';
import { usePortalData } from './PortalDataContext';
import { formatDay } from './portalFormat';

/** POR-03: everything the client still has to fill in, and what was sent. */
export function PortalFormsPage() {
  const brand = useBrand();
  const { formsList, assessments } = usePortalData();

  return (
    <Page header={<PageHeader eyebrow={brand.name} title="Forms & assessments" />}>
      <Card padding="p-5" className="space-y-2">
        <Eyebrow>TO DO</Eyebrow>
        {formsList.length === 0 ? (
          <p className="text-[13.5px] text-[#64748B]">Nothing to fill in. Your practitioner will send forms here when they need them.</p>
        ) : (
          formsList.map((f) => (
            <Link key={f.id} to={`/forms/${f.id}`} className="flex items-center gap-3 py-2.5 border-t border-[#F1F5F9] first:border-t-0">
              <span className="flex-1 text-[13.5px] font-bold text-[#0F172A]">{f.title ?? 'Form'}</span>
              <span className="text-[12.5px] font-bold" style={{ color: brand.primaryColor || '#0F3A53' }}>Fill in</span>
              <ChevronRight className="h-4 w-4" style={{ color: brand.primaryColor || '#0F3A53' }} aria-hidden="true" />
            </Link>
          ))
        )}
      </Card>

      <Card padding="p-5" className="space-y-1">
        <Eyebrow>ASSESSMENTS</Eyebrow>
        {assessments.length === 0 ? (
          <p className="text-[13.5px] text-[#64748B]">Your practitioner has not sent you any assessments.</p>
        ) : (
          assessments.map((a) => (
            <Link key={a.id} to={`/portal/assessments/${a.id}`} className="w-full text-left flex items-start gap-4 py-3.5 border-t border-[#F1F5F9] first:border-t-0 hover:bg-[#F8FAFC]">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-[#0F172A]">{a.shortName} <span className="font-medium text-[#64748B]">· {a.measures}</span></div>
                {a.message ? <div className="mt-0.5 text-[12.5px] text-[#475569]">“{a.message}”</div> : null}
                {a.status === 'COMPLETED' && a.result?.summary ? (
                  <div className="mt-1 text-[12.5px] text-[#334155]">{a.result.summary}</div>
                ) : null}
                <div className="mt-1 text-[11.5px] text-[#94A3B8] font-medium">
                  {a.status === 'COMPLETED' && a.completedAt ? `Completed ${formatDay(a.completedAt)}` : `Sent ${formatDay(a.sentAt)}`}
                </div>
              </div>
              {a.status === 'SENT' ? (
                <span className="h-[24px] px-2.5 rounded-full bg-[#FFFBEB] text-[#B45309] text-[10px] font-black tracking-[0.06em] uppercase flex items-center shrink-0">To do</span>
              ) : (
                <span className="h-[24px] px-2.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10px] font-black tracking-[0.06em] uppercase flex items-center gap-1 shrink-0">
                  <Check className="h-3 w-3" strokeWidth={3} /> Done
                </span>
              )}
            </Link>
          ))
        )}
      </Card>
    </Page>
  );
}
