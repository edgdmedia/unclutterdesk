import React from 'react';
import { Page, PageHeader } from '@unclutterdesk/ui';
import { SendingDomainCard } from '../../../components/email/SendingDomainCard';

/** GEN-04: everything about the address practice email goes out from. */
export function SettingsEmailPage() {
  return (
    <Page header={<PageHeader eyebrow="Domain & email" title="Sending domain" />}>
      <SendingDomainCard />
    </Page>
  );
}
