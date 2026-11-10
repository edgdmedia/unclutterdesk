import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card, Page, PageHeader, useBrand } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

interface LinkResult {
  bookingId: string;
  linked: boolean;
  added: boolean;
  message: string | null;
}

/**
 * Back from Unclutter Journal (docs/design/journal-integration.md §4): the
 * one-time code and the state Desk sent. Finished once on the server, then
 * back to the recap she came from.
 */
export function PortalJournalLinkedPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const brand = useBrand();
  const [error, setError] = useState<string | null>(null);
  // The state is single-use: never send it twice, even when React runs effects twice.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const state = params.get('state');
    if (!state) {
      setError('This link is incomplete. Go back to your recap and try again.');
      return;
    }
    const body = params.get('error') ? { state, error: params.get('error') } : { state, code: params.get('code') };
    api
      .post<LinkResult>('/v1/consult/portal/journal/link', body)
      .then((r) => {
        const notice = !r.linked ? 'declined' : r.added ? 'added' : 'linked';
        navigate(`/portal/sessions/${encodeURIComponent(r.bookingId)}/recap?journal=${notice}`, { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Your Journal could not be connected. Go back to your recap and try again.'));
  }, [params, navigate]);

  return (
    <Page header={<PageHeader eyebrow={brand.name} title="Unclutter Journal" />}>
      <Card padding="p-[22px_24px]" className="space-y-3">
        {error ? (
          <>
            <p role="alert" className="text-[13.5px] font-semibold text-rose-700">{error}</p>
            <Link to="/portal/sessions?view=past" className="text-[12.5px] font-bold text-[var(--desk-text)] underline">
              Back to my sessions
            </Link>
          </>
        ) : (
          <p className="inline-flex items-center gap-2 text-[13.5px] text-[var(--desk-text)] font-medium">
            <Loader2 className="h-4 w-4 animate-spin" /> Connecting your Journal…
          </p>
        )}
      </Card>
    </Page>
  );
}
