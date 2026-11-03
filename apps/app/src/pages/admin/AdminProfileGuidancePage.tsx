import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button, Card, Eyebrow, Textarea, useToast } from '@unclutterdesk/ui';
import { adminProfileContentApi } from './adminProfileContentApi';
import { ProfileContentTabs } from './ProfileContentTabs';
import { PROFILE_CONTENT_BASE, SECTION_ORDER, type AdminGuidance } from './profileContentTypes';
import { SECTION_TITLES } from '../practice/profile/profileApi';

/**
 * The shared guidance shown beside every profile section (spec §6.6). One set
 * of words for all templates; edits are copied onto every template row by the
 * API so the editor sees them immediately.
 */
export function AdminProfileGuidancePage() {
  const toast = useToast();
  const { data, isLoading, mutate } = useSWR<{ guidance: AdminGuidance }>(`${PROFILE_CONTENT_BASE}/guidance`);
  const [guidance, setGuidance] = useState<AdminGuidance>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (data?.guidance) setGuidance(data.guidance);
  }, [data]);

  const dirty = useMemo(() => JSON.stringify(guidance) !== JSON.stringify(data?.guidance ?? {}), [guidance, data]);
  const blank = SECTION_ORDER.filter((section) => !(guidance[section] ?? '').trim());

  async function save() {
    setError(null);
    if (blank.length) {
      const message = `Add guidance for every section before saving. Still blank: ${blank
        .map((section) => SECTION_TITLES[section])
        .join(', ')}.`;
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    try {
      await adminProfileContentApi.updateGuidance({
        guidance: Object.fromEntries(SECTION_ORDER.map((section) => [section, (guidance[section] ?? '').trim()])),
        reason: reason.trim() || null,
      });
      await mutate();
      toast.success('Guidance saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the guidance';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1000px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Profile guidance</h1>
      <p className="mt-1 max-w-[760px] text-[13.5px] text-[#64748B]">
        The short advice shown beside each section of every profile. It is shared by all templates, so keep it useful for any practitioner.
        Every save is recorded in the admin audit log.
      </p>
      <ProfileContentTabs />

      {isLoading ? (
        <Card className="mt-5 p-[22px]"><p className="text-sm text-[#64748B]">Loading guidance…</p></Card>
      ) : (
        <div className="mt-5 space-y-5">
          <Card className="p-[22px] space-y-5">
            {SECTION_ORDER.map((section) => (
              <div key={section}>
                <Textarea
                  label={SECTION_TITLES[section]}
                  value={guidance[section] ?? ''}
                  rows={3}
                  maxLength={600}
                  onChange={(e: any) => setGuidance((current) => ({ ...current, [section]: e.target.value }))}
                />
                <p className="mt-1 text-right text-[11px] text-[#94A3B8]">{(guidance[section] ?? '').length}/600</p>
              </div>
            ))}
          </Card>

          <Card className="p-[22px] space-y-2">
            <label className="text-[11.5px] font-bold text-[#475569]">Reason for change</label>
            <p className="text-[12px] text-[#64748B]">Optional.</p>
            <Textarea
              value={reason}
              rows={2}
              maxLength={500}
              placeholder="Why update guidance?"
              onChange={(e: any) => setReason(e.target.value)}
            />
          </Card>

          {error ? <p role="alert" className="text-[13px] font-semibold text-[#B91C1C]">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {blank.length ? <p className="text-[12.5px] text-[#B45309]">{blank.length} section{blank.length === 1 ? '' : 's'} still blank</p> : null}
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : dirty ? 'Save guidance' : 'Saved'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}