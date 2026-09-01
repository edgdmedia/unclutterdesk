import { useEffect, useState } from 'react';
import { CheckCircle2, EyeOff, MessageSquare, ShieldAlert, Sparkles, Star } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';

type SubmissionAnswer = {
  id: string;
  label: string;
  type: string;
  value: unknown;
};

type SubmissionRecord = {
  id: string;
  formId: string;
  formTitle: string;
  formDescription: string | null;
  targetType: string;
  status: string;
  reviewPublicationMode: string;
  reviewerDisplayMode: string;
  submittedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    displayName: string;
  };
  booking: {
    id: string;
    status: string;
    serviceTitle: string;
  } | null;
  answers: SubmissionAnswer[];
  review: {
    rating: number | null;
    ratingLabel: string;
    testimonial: string;
    testimonialLabel: string;
  };
};

type QueueFilter = 'ALL' | 'ASSESSMENTS' | 'REVIEWS';

const FILTER_LABELS: Record<QueueFilter, string> = {
  ALL: 'ALL',
  ASSESSMENTS: 'ASSESSMENTS',
  REVIEWS: 'REVIEWS',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatAnswerValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return 'No response';
  return String(value);
}

function isReview(submission: SubmissionRecord) {
  return submission.targetType === 'REVIEW';
}

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubmissions() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<SubmissionRecord[]>('/v1/intake/submissions');
        if (!cancelled) {
          setSubmissions(data);
          setSelectedId((current) => current ?? data[0]?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load submissions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSubmissions();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = submissions.filter((submission) => {
    if (filter === 'REVIEWS') return isReview(submission);
    if (filter === 'ASSESSMENTS') return !isReview(submission);
    return true;
  });
  const selected = filtered.find((submission) => submission.id === selectedId) ?? filtered[0] ?? null;

  async function updateStatus(submission: SubmissionRecord, nextStatus: string) {
    setSavingId(submission.id);
    setError(null);
    try {
      const updated = await api.patch<{ id: string; status: string; reviewedAt: string | null; publishedAt: string | null }>(
        `/v1/intake/submissions/${submission.id}/status`,
        { status: nextStatus },
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, status: updated.status, reviewedAt: updated.reviewedAt, publishedAt: updated.publishedAt }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update submission');
    } finally {
      setSavingId(null);
    }
  }

  const countFor = (queueFilter: QueueFilter) =>
    submissions.filter((submission) => {
      if (queueFilter === 'REVIEWS') return isReview(submission);
      if (queueFilter === 'ASSESSMENTS') return !isReview(submission);
      return true;
    }).length;

  return (
    <div className="flex-1 min-w-[1192px] flex min-h-0 bg-white">
      <aside className="w-[400px] shrink-0 border-r border-[#E2E8F0] flex flex-col min-h-0 bg-white">
        <div className="px-[22px] pt-[22px] pb-4 border-b border-[#F1F5F9]">
          <Eyebrow>QUEUE</Eyebrow>
          <div className="flex items-center gap-3 mt-1.5">
            <h2 className="text-[19px] font-bold tracking-[-0.01em] text-[#0F172A]">
              {filtered.length} submission{filtered.length === 1 ? '' : 's'}
            </h2>
          </div>
          <div className="flex gap-1.5 mt-3">
            {(['ALL', 'ASSESSMENTS', 'REVIEWS'] as QueueFilter[]).map((queueFilter) => (
              <button
                key={queueFilter}
                onClick={() => setFilter(queueFilter)}
                className={`h-[28px] px-3 rounded-[10px] text-[10px] font-black tracking-[0.08em] transition-all cursor-pointer ${
                  filter === queueFilter
                    ? 'bg-[#0F3A53] text-white'
                    : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
                }`}
              >
                {FILTER_LABELS[queueFilter]} · {countFor(queueFilter)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-[16px_14px_20px] flex flex-col gap-[10px]">
          {loading ? (
            <div className="py-10 text-center text-[13px] font-medium text-[#94A3B8]">Loading submissions...</div>
          ) : error ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-medium text-[#94A3B8]">No submissions yet in this filter.</div>
          ) : (
            filtered.map((submission) => {
              const selectedTile = submission.id === selected?.id;
              const reviewSubmission = isReview(submission);
              return (
                <button
                  key={submission.id}
                  onClick={() => setSelectedId(submission.id)}
                  className={`w-full text-left px-[14px] py-[14px] rounded-[18px] transition-all cursor-pointer ${
                    selectedTile
                      ? 'bg-[#EFF6FB] shadow-[inset_0_0_0_1.5px_#0F3A53]'
                      : 'bg-white shadow-[inset_0_0_0_1px_#E2E8F0] hover:shadow-[inset_0_0_0_1px_#CBD5E1]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-wider ${reviewSubmission ? 'bg-rose-100 text-rose-700' : 'bg-[#EFF6FB] text-[#0F3A53]'}`}>
                          {submission.targetType}
                        </span>
                        <span className="text-[11px] font-semibold text-[#94A3B8]">{submission.status}</span>
                      </div>
                      <h3 className="mt-2 text-[14px] font-bold text-[#0F172A]">{submission.client.displayName}</h3>
                      <p className="text-[12px] font-medium text-[#475569] mt-1">{submission.formTitle}</p>
                    </div>
                    {reviewSubmission && submission.review.rating ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {submission.review.rating.toFixed(1)}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[#64748B]">
                    <span>{submission.booking?.serviceTitle || submission.client.email}</span>
                    <span>{formatDate(submission.submittedAt)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex-1 min-w-0 bg-[#F8FAFC]">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-[#94A3B8] text-sm font-medium">
            Select a submission to review.
          </div>
        ) : (
          <div className="h-full overflow-auto p-[24px]">
            <div className="max-w-[860px] mx-auto space-y-5">
              <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Eyebrow>{isReview(selected) ? 'PUBLIC REVIEW SUBMISSION' : 'CLINICAL SUBMISSION'}</Eyebrow>
                    <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">{selected.formTitle}</h1>
                    <p className="mt-2 text-sm font-medium text-[#64748B]">{selected.formDescription || 'No description added for this form.'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Submitted</div>
                    <div className="mt-1 text-sm font-bold text-[#0F172A]">{formatDate(selected.submittedAt)}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Client</div>
                    <div className="mt-1 text-sm font-bold text-[#0F172A]">{selected.client.displayName}</div>
                    <div className="text-[12px] font-medium text-[#64748B]">{selected.client.email}</div>
                  </div>
                  <div className="rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Type</div>
                    <div className="mt-1 text-sm font-bold text-[#0F172A]">{selected.targetType}</div>
                    <div className="text-[12px] font-medium text-[#64748B]">Status: {selected.status}</div>
                  </div>
                  <div className="rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Linked booking</div>
                    <div className="mt-1 text-sm font-bold text-[#0F172A]">{selected.booking?.serviceTitle || 'Standalone form'}</div>
                    <div className="text-[12px] font-medium text-[#64748B]">{selected.booking?.status || 'No booking attached'}</div>
                  </div>
                </div>
              </div>

              {isReview(selected) ? (
                <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Eyebrow>LANDING PAGE REVIEW</Eyebrow>
                      <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-[#0F172A]">Ready to publish to your practice page</h2>
                    </div>
                    {selected.review.rating !== null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-700">
                        <Star className="h-4 w-4 fill-current" />
                        {selected.review.rating.toFixed(1)} / 5
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[20px] border border-[#FDE68A] bg-[#FFFBEA] px-5 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#B45309]">Publication policy</div>
                    <div className="mt-1 text-sm font-bold text-[#92400E]">
                      {selected.reviewPublicationMode === 'AUTO' ? 'This form auto-publishes new reviews.' : 'This form requires manual approval before a review goes live.'}
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-5">
                    <div className="rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{selected.review.ratingLabel}</div>
                      <div className="mt-3 flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} className={`h-5 w-5 ${selected.review.rating !== null && index < Math.round(selected.review.rating) ? 'fill-current' : ''}`} />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{selected.review.testimonialLabel}</div>
                      <p className="mt-3 text-[14px] leading-7 font-medium text-[#334155]">
                        {selected.review.testimonial || 'This review submission does not include a written testimonial.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => void updateStatus(selected, selected.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED')}
                      className="h-[44px] px-5 rounded-[14px] bg-[#0F3A53] text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      {selected.status === 'PUBLISHED' ? <EyeOff className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      <span>{selected.status === 'PUBLISHED' ? 'Hide from landing page' : 'Publish to landing page'}</span>
                    </button>
                    <div className="text-xs font-medium text-[#64748B]">
                      {selected.publishedAt ? `Live since ${formatDate(selected.publishedAt)}` : 'Hidden until you publish it.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Eyebrow>RESPONSE DETAILS</Eyebrow>
                      <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-[#0F172A]">Client answers</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700">
                      <ShieldAlert className="h-4 w-4" />
                      Clinician review queue
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selected.answers.map((answer) => (
                      <div key={answer.id} className="rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{answer.label}</div>
                        <div className="mt-2 text-[14px] leading-7 font-medium text-[#334155]">{formatAnswerValue(answer.value)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={savingId === selected.id || selected.status === 'REVIEWED'}
                      onClick={() => void updateStatus(selected, 'REVIEWED')}
                      className="h-[44px] px-5 rounded-[14px] bg-[#0F3A53] text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{selected.status === 'REVIEWED' ? 'Marked reviewed' : 'Mark reviewed'}</span>
                    </button>
                    <div className="text-xs font-medium text-[#64748B]">
                      {selected.reviewedAt ? `Reviewed ${formatDate(selected.reviewedAt)}` : 'Review and file this submission when you are done.'}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#0F3A53]" />
                  <h3 className="text-[15px] font-bold text-[#0F172A]">Raw answers</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selected.answers.map((answer) => (
                    <div key={`raw_${answer.id}`} className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{answer.type}</div>
                      <div className="mt-1 text-sm font-bold text-[#0F172A]">{answer.label}</div>
                      <div className="mt-2 text-[13px] text-[#475569] font-medium">{formatAnswerValue(answer.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
