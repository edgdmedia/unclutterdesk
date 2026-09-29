import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/apiClient';

type Permission =
  | 'practice.admin' | 'practice.staff' | 'clinical.record' | 'payments.desk'
  | 'sessions.view-all' | 'sessions.edit' | 'sessions.summary' | 'staff.manage';

const CATALOG: { key: Permission; label: string; hint: string; group: string }[] = [
  { group: 'Sessions', key: 'sessions.view-all', label: 'Every practitioner’s diary', hint: 'See all sessions, not only your own.' },
  { group: 'Sessions', key: 'sessions.edit', label: 'Move or cancel any session', hint: 'Reschedule, confirm or cancel on the practice’s behalf.' },
  { group: 'Clinical', key: 'clinical.record', label: 'Clinical records', hint: 'SOAP notes, assessments, session prep.' },
  { group: 'Clinical', key: 'sessions.summary', label: 'Session summaries', hint: 'Internal summary and the client recap.' },
  { group: 'Money', key: 'payments.desk', label: 'Front-desk money', hint: 'Mark transfers paid; see payout views.' },
  { group: 'Practice', key: 'practice.staff', label: 'Workspace access', hint: 'Sign in to the staff area at all.' },
  { group: 'Practice', key: 'practice.admin', label: 'Practice settings', hint: 'Staff, billing, branding, services.' },
  { group: 'Practice', key: 'staff.manage', label: 'Change roles and permissions', hint: 'Use this very editor on other people.' },
];

const ROLE_BASE: Record<string, Permission[]> = {
  OWNER: CATALOG.map((c) => c.key),
  ADMIN: ['practice.admin', 'practice.staff', 'clinical.record', 'payments.desk', 'sessions.view-all', 'sessions.edit', 'sessions.summary', 'staff.manage'],
  THERAPIST: ['practice.staff', 'clinical.record', 'sessions.summary'],
  RECEPTIONIST: ['practice.staff', 'payments.desk', 'sessions.view-all', 'sessions.edit'],
  CLIENT: [],
};

export function PermissionsDialog({
  member,
  onClose,
  onSaved,
}: {
  member: { id: string; name: string; email: string; role: string; permissions?: string[] };
  onClose: () => void;
  onSaved: (permissions: string[]) => void;
}) {
  const base = new Set<string>(ROLE_BASE[member.role] ?? []);
  const [grants, setGrants] = useState<Set<string>>(new Set(member.permissions ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(CATALOG.map((c) => c.group))];

  function toggle(key: string) {
    setGrants((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const list = [...grants].sort();
      await api.patch(`/v1/tenant/staff/${member.id}/permissions`, { permissions: list });
      onSaved(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the permissions');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-label={`Permissions for ${member.name}`}>
      <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">Permissions — {member.name}</h2>
            <p className="text-[12px] text-[#64748B]">
              Ticks here add to what the <span className="font-bold">{member.role.toLowerCase()}</span> role already gives. Nothing removes it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {groups.map((g) => (
          <fieldset key={g} className="space-y-1.5">
            <legend className="text-[10.5px] font-black tracking-[0.14em] uppercase text-[#64748B] mb-1">{g}</legend>
            {CATALOG.filter((c) => c.group === g).map((c) => {
              const fromRole = base.has(c.key);
              return (
                <label key={c.key} className={`flex items-start gap-2.5 p-2.5 rounded-[12px] border ${fromRole ? 'border-[#E2E8F0] bg-[#F8FAFC] opacity-70' : 'border-[#E2E8F0] cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    aria-label={c.label}
                    checked={fromRole || grants.has(c.key)}
                    disabled={fromRole}
                    aria-disabled={fromRole}
                    onChange={() => toggle(c.key)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-[#0F172A]">
                      {c.label}
                      {fromRole ? <span className="ml-1.5 text-[10px] font-black uppercase text-[#64748B]">from role</span> : null}
                    </span>
                    <span className="block text-[11.5px] text-[#64748B]">{c.hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}

        {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="w-full h-[42px] rounded-[12px] bg-[#0F3A53] text-white text-[13px] font-bold cursor-pointer disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save permissions'}
        </button>
      </div>
    </div>
  );
}
