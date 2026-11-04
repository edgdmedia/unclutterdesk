import { useEffect, useState } from 'react';
import { CheckCircle2, EyeOff, MessageSquare, ShieldAlert, Sparkles, Star } from 'lucide-react';
import { Eyebrow, Page, PageHeader, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { formatWhen } from '../../utils/displayFormat';

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
  return formatWhen(value, 'short');
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
  const toast = useToast();
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
      toast.success('Submission updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the submission');
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
    <Page header={<PageHeader eyebrow="CLINICAL" title="Submissions" />}>
      <div className="flex min-h-[600px] rounded-[20px] border border-[var(--desk-border)] overflow-hidden bg-white">
      <aside className="w-[400px] shrink-0 border-r border-[var(--desk-border)] flex flex-col min-h-0 bg-white">
        <div className="px-[22px] pt-[22px] pb-4 border-b border-[var(--desk-border-soft)]">
          <Eyebrow>QUEUE</Eyebrow>
          <div className="flex items-center gap-3 mt-1.5">
            <h2 className="text-[19px] font-bold tracking-[-0.01em] text-[var(--desk-text)]">
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
                    ? 'bg-[var(--desk-pine-600)] text-white'
                    : 'bg-white text-[var(--desk-text-muted)] border border-[var(--desk-border)] hover:bg-[var(--desk-surface-muted)]'
                }`}
              >
                {FILTER_LABELS[queueFilter]} · {countFor(queueFilter)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-[16px_14px_20px] flex flex-col gap-[10px]">
          {loading ? (
            <div className="py-10 text-center text-[13px] font-medium text-[var(--desk-text-subtle)]">Loading submissions...</div>
          ) : error ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-medium text-[var(--desk-text-subtle)]">No submissions yet in this filter.</div>
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
                      ? 'bg-[var(--desk-pine-100)] shadow-[inset_0_0_0_1.5px_#0F3A53]'
                      : 'bg-white shadow-[inset_0_0_0_1px_#E2E8F0] hover:shadow-[inset_0_0_0_1px_#CBD5E1]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-wider ${reviewSubmission ? 'bg-rose-100 text-rose-700' : 'bg-[var(--desk-pine-100)] text-[var(--desk-pine-600)]'}`}>
                          {submission.targetType}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--desk-text-subtle)]">{submission.status}</span>
                      </div>
                      <h3 className="mt-2 text-[14px] font-bold text-[var(--desk-text)]">{submission.client.displayName}</h3>
                      <p className="text-[12px] font-medium text-[var(--desk-text-body)] mt-1">{submission.formTitle}</p>
                    </div>
                    {reviewSubmission && submission.review.rating ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {submission.review.rating.toFixed(1)}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[var(--desk-text-muted)]">
                    <span>{submission.booking?.serviceTitle || submission.client.email}</span>
                    <span>{formatDate(submission.submittedAt)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex-1 min-w-0 bg-[var(--desk-surface)]">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-[var(--desk-text-subtle)] text-sm font-medium">
            Select a submission to review.
          </div>
        ) : (
          <div className="h-full overflow-auto p-[24px]">
            <div className="max-w-[860px] mx-auto space-y-5">
              <div className="rounded-[28px] border border-[var(--desk-border)] bg-white p-6 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Eyebrow>{isReview(selected) ? 'PUBLIC REVIEW SUBMISSION' : 'CLINICAL SUBMISSION'}</Eyebrow>
                    <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">{selected.formTitle}</h1>
                    <p className="mt-2 text-sm font-medium text-[var(--desk-text-muted)]">{selected.formDescription || 'No description added for this form.'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">Submitted</div>
                    <div className="mt-1 text-sm font-bold text-[var(--desk-text)]">{formatDate(selected.submittedAt)}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">Client</div>
                    <div className="mt-1 text-sm font-bold text-[var(--desk-text)]">{selected.client.displayName}</div>
                    <div className="text-[12px] font-medium text-[var(--desk-text-muted)]">{selected.client.email}</div>
                  </div>
                  <div className="rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">Type</div>
                    <div className="mt-1 text-sm font-bold text-[var(--desk-text)]">{selected.targetType}</div>
                    <div className="text-[12px] font-medium text-[var(--desk-text-muted)]">Status: {selected.status}</div>
                  </div>
                  <div className="rounded-[18px] bg-[var(--desk-surface)] border border-[var(--desk-border)] px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">Linked booking</div>
                    <div className="mt-1 text-sm font-bold text-[var(--desk-text)]">{selected.booking?.serviceTitle || 'Standalone form'}</div>
                    <div className="text-[12px] font-medium text-[var(--desk-text-muted)]">{selected.booking?.status || 'No booking attached'}</div>
                  </div>
                </div>
              </div>

              {isReview(selected) ? (
                <div className="rounded-[28px] border border-[var(--desk-border)] bg-white p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Eyebrow>LANDING PAGE REVIEW</Eyebrow>
                      <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-[var(--desk-text)]">Ready to publish to your practice page</h2>
                    </div>
                    {selected.review.rating !== null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-700">
                        <Star className="h-4 w-4 fill-current" />
                        {selected.review.rating.toFixed(1)} / 5
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[20px] border border-[var(--desk-pending-border)] bg-[var(--desk-pending-bg)] px-5 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-pending)]">Publication policy</div>
                    <div className="mt-1 text-sm font-bold text-[var(--desk-pending)]">
                      {selected.reviewPublicationMode === 'AUTO' ? 'This form auto-publishes new reviews.' : 'This form requires manual approval before a review goes live.'}
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-5">
                    <div className="rounded-[20px] border border-[var(--desk-border)] bg-[var(--desk-surface)] p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">{selected.review.ratingLabel}</div>
                      <div className="mt-3 flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} className={`h-5 w-5 ${selected.review.rating !== null && index < Math.round(selected.review.rating) ? 'fill-current' : ''}`} />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[var(--desk-border)] bg-white p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">{selected.review.testimonialLabel}</div>
                      <p className="mt-3 text-[14px] leading-7 font-medium text-[var(--desk-text-body)]">
                        {selected.review.testimonial || 'This review submission does not include a written testimonial.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => void updateStatus(selected, selected.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED')}
                      className="h-[44px] px-5 rounded-[14px] bg-[var(--desk-pine-600)] text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      {selected.status === 'PUBLISHED' ? <EyeOff className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      <span>{selected.status === 'PUBLISHED' ? 'Hide from landing page' : 'Publish to landing page'}</span>
                    </button>
                    <div className="text-xs font-medium text-[var(--desk-text-muted)]">
                      {selected.publishedAt ? `Live since ${formatDate(selected.publishedAt)}` : 'Hidden until you publish it.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-[var(--desk-border)] bg-white p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Eyebrow>RESPONSE DETAILS</Eyebrow>
                      <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-[var(--desk-text)]">Client answers</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700">
                      <ShieldAlert className="h-4 w-4" />
                      Clinician review queue
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selected.answers.map((answer) => (
                      <div key={answer.id} className="rounded-[18px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-5 py-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">{answer.label}</div>
                        <div className="mt-2 text-[14px] leading-7 font-medium text-[var(--desk-text-body)]">{formatAnswerValue(answer.value)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={savingId === selected.id || selected.status === 'REVIEWED'}
                      onClick={() => void updateStatus(selected, 'REVIEWED')}
                      className="h-[44px] px-5 rounded-[14px] bg-[var(--desk-pine-600)] text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{selected.status === 'REVIEWED' ? 'Marked reviewed' : 'Mark reviewed'}</span>
                    </button>
                    <div className="text-xs font-medium text-[var(--desk-text-muted)]">
                      {selected.reviewedAt ? `Reviewed ${formatDate(selected.reviewedAt)}` : 'Review and file this submission when you are done.'}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-[var(--desk-border)] bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[var(--desk-pine-600)]" />
                  <h3 className="text-[15px] font-bold text-[var(--desk-text)]">Raw answers</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selected.answers.map((answer) => (
                    <div key={`raw_${answer.id}`} className="rounded-[16px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--desk-text-subtle)]">{answer.type}</div>
                      <div className="mt-1 text-sm font-bold text-[var(--desk-text)]">{answer.label}</div>
                      <div className="mt-2 text-[13px] text-[var(--desk-text-body)] font-medium">{formatAnswerValue(answer.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      </div>
    </Page>
  );
}
