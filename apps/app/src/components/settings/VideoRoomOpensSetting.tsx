import { useState } from 'react';
import { useToast } from '@unclutterdesk/ui';
import { JOIN_OPENS_CHOICES, DEFAULT_JOIN_OPENS_MINUTES } from '@unclutterdesk/shared';
import { useOptionalAuth } from '../../context/AuthContext';
import { api } from '../../utils/apiClient';

/**
 * VID-02: how early this practice's video rooms open. A practice-wide
 * setting, so only people who manage the practice see it; it saves straight
 * away. The server enforces the same minutes when anyone joins.
 */
export function VideoRoomOpensSetting() {
  const auth = useOptionalAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const canManage = (auth?.profile?.permissions ?? []).includes('practice.admin');
  if (!canManage) return null;
  const value = auth?.profile?.joinOpensMinutesBefore ?? DEFAULT_JOIN_OPENS_MINUTES;

  async function change(minutes: number) {
    setSaving(true);
    try {
      await api.patch('/v1/tenant/brand', { joinOpensMinutesBefore: minutes });
      await auth?.refreshProfile();
      toast.success(minutes === 0 ? 'Video rooms now open at the start time' : `Video rooms now open ${minutes} minutes early`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="block text-[11.5px] font-bold text-[#475569]">Video room opens
      <select
        className="mt-1 h-[42px] w-full rounded-[13px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13.5px] font-semibold"
        value={value}
        disabled={saving}
        onChange={(e) => void change(Number(e.target.value))}
      >
        {JOIN_OPENS_CHOICES.map((m) => (
          <option key={m} value={m}>{m === 0 ? 'At the start time' : `${m} min before`}</option>
        ))}
      </select>
      <span className="block mt-1 font-medium text-[#64748B]">For you and your clients. Rooms close an hour after the session ends.</span>
    </label>
  );
}
