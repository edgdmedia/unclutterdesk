import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../../utils/apiClient';
import type { EmergencyContact } from '../../App';

const input = 'w-full h-[36px] px-3 rounded-[10px] bg-white border border-[var(--desk-pending-border)]/50 text-[12.5px] text-[var(--desk-text)] outline-none';

export function EmergencyContactCard({
  clientId,
  contact,
  onSaved,
}: {
  clientId: string;
  contact: EmergencyContact | null;
  onSaved: (c: EmergencyContact | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact?.name ?? '');
  const [relationship, setRelationship] = useState(contact?.relationship ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.patch<{ emergencyContact: EmergencyContact | null }>(`/v1/tenant/clients/${clientId}`, {
        emergencyContact: { name, relationship, phone },
      });
      onSaved(res.emergencyContact);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setName(contact?.name ?? '');
    setRelationship(contact?.relationship ?? '');
    setPhone(contact?.phone ?? '');
    setError(null);
    setEditing(true);
  }

  return (
    <div className="p-3.5 rounded-[16px] bg-[var(--desk-pending-bg)] border border-[var(--desk-pending-border)]/40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold tracking-wider text-[var(--desk-pending)]">EMERGENCY CONTACT</span>
        {!editing && (
          <button type="button" aria-label="Edit emergency contact" onClick={startEdit} className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] text-[var(--desk-pending)] hover:bg-[var(--desk-pending-border)] cursor-pointer">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <label className="block text-[11px] font-semibold text-[var(--desk-pending)]">Name<input className={input} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block text-[11px] font-semibold text-[var(--desk-pending)]">Relationship<input className={input} value={relationship} onChange={(e) => setRelationship(e.target.value)} /></label>
          <label className="block text-[11px] font-semibold text-[var(--desk-pending)]">Phone<input className={input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          {error ? <p className="text-[11.5px] font-medium text-rose-700">{error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="h-[32px] px-3 rounded-[10px] bg-[var(--desk-pending)] text-white text-[12px] font-bold cursor-pointer disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="h-[32px] px-3 rounded-[10px] text-[var(--desk-pending)] text-[12px] font-semibold cursor-pointer">Cancel</button>
          </div>
        </form>
      ) : contact ? (
        <div className="text-[12px] text-[var(--desk-pending)] leading-tight space-y-0.5">
          <span className="font-bold block">{contact.name}</span>
          {contact.relationship ? <span className="block">{contact.relationship}</span> : null}
          {contact.phone ? <a className="block font-semibold underline" href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a> : null}
        </div>
      ) : (
        <span className="text-[12px] font-semibold text-[var(--desk-pending)]/70">Not recorded</span>
      )}
    </div>
  );
}
