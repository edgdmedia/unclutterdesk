import React, { useCallback, useEffect, useState } from 'react';
import { Page, PageHeader } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { usePracticeBrand } from '../../../context/PracticeBrandContext';
import { BookingLinkCard } from '../../../components/settings/BookingLinkCard';
import { CustomDomainPanel } from './CustomDomainPanel';

/**
 * GEN-04: the practice's booking address in one place — the unclutterdesk.com
 * link clients use today, and the practice's own domain on top of it.
 */
export function SettingsDomainPage() {
  const { refresh } = usePracticeBrand();
  const [slug, setSlug] = useState('');

  const load = useCallback(() => {
    api.get<{ slug?: string }>('/v1/tenant/brand')
      .then((brand) => setSlug(brand.slug || ''))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page header={<PageHeader eyebrow="Domain & email" title="Booking address" />}>
      {slug ? <BookingLinkCard slug={slug} onSaved={(next) => { setSlug(next); void refresh(); }} /> : null}
      <CustomDomainPanel />
    </Page>
  );
}
