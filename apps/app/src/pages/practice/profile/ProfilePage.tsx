import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, PageHeader, SegmentedControl } from '@unclutterdesk/ui';
import { MyProfilePage } from '../MyProfilePage';
import { PublicProfileEditor } from './PublicProfileEditor';
import type { OwnProfile } from './profileApi';

const TABS = ['Public profile', 'This practice'] as const;
type Tab = (typeof TABS)[number];

/**
 * /dashboard/profile: one page for everything about the therapist, in two
 * tabs. "Public profile" is the editor for the page clients find and share
 * (spec §6.4–§6.7); "This practice" holds the settings that belong to this
 * practice only. The tab is kept in the URL (?tab=practice) so it can be linked.
 */
export function ProfilePage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'practice' ? 'This practice' : 'Public profile';
  const [publicProfile, setPublicProfile] = useState<OwnProfile | null>(null);

  return (
    <Page
      header={
        <PageHeader
          eyebrow="ACCOUNT"
          title="My profile"
          actions={
            <SegmentedControl
              options={[...TABS]}
              value={tab}
              onChange={(next: Tab) => setParams(next === 'This practice' ? { tab: 'practice' } : {}, { replace: true })}
            />
          }
        />
      }
    >
      <div hidden={tab !== 'Public profile'}>
        <PublicProfileEditor onProfileChange={setPublicProfile} />
      </div>
      {tab === 'This practice' && <MyProfilePage embedded sharedFieldsInPublicProfile={publicProfile !== null} />}
    </Page>
  );
}
