import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, PageHeader, SegmentedControl } from '@unclutterdesk/ui';
import { usePracticeBrand } from '../../../context/PracticeBrandContext';
import { MyProfilePage } from '../MyProfilePage';
import { PublicProfileEditor } from './PublicProfileEditor';
import { ShareKit } from './ShareKit';
import type { OwnProfile } from './profileApi';

const TABS = ['Public profile', 'Share', 'This practice'] as const;
type Tab = (typeof TABS)[number];

/**
 * /dashboard/profile: one page for everything about the therapist, in three
 * tabs. "Public profile" is the editor for the page clients find and share
 * (spec §6.4–§6.7); "Share" holds the link, QR, PDF and email signature
 * (§6.10); "This practice" holds the settings that belong to this practice
 * only. The tab is kept in the URL (?tab=share, ?tab=practice) so it can be
 * linked.
 */
export function ProfilePage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = requested === 'practice' ? 'This practice' : requested === 'share' ? 'Share' : 'Public profile';
  const [publicProfile, setPublicProfile] = useState<OwnProfile | null>(null);
  const { brand } = usePracticeBrand();

  const select = (next: Tab) => {
    if (next === 'This practice') setParams({ tab: 'practice' }, { replace: true });
    else if (next === 'Share') setParams({ tab: 'share' }, { replace: true });
    else setParams({}, { replace: true });
  };

  return (
    <Page
      header={
        <PageHeader
          eyebrow="ACCOUNT"
          title="My profile"
          actions={<SegmentedControl options={[...TABS]} value={tab} onChange={select} />}
        />
      }
    >
      <div hidden={tab !== 'Public profile'}>
        <PublicProfileEditor
          onProfileChange={setPublicProfile}
          practiceBrand={brand}
        />
      </div>
      {tab === 'Share' && <ShareKit />}
      {tab === 'This practice' && <MyProfilePage embedded />}
    </Page>
  );
}