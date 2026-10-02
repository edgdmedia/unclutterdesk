import React, { useEffect, useState } from 'react';
import { MapPin, Pencil, Plus } from 'lucide-react';
import { Button, Card, Eyebrow, Page, PageHeader, useToast } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

type Location = {
  id: string;
  name: string;
  address: string;
  city: string;
  directions: string | null;
  isActive: boolean;
  mapsUrl: string;
  upcomingInPerson: number;
};

const EMPTY = { name: '', address: '', city: '', directions: '' };

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-[11.5px] font-bold text-[#475569] space-y-1">
      <span>{label}</span>
      <input
        className="w-full h-11 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-white text-[13.5px] font-medium text-[#0F172A] outline-none focus:border-[#0F3A53]"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** SET-06: the places a practice sees clients in person. */
export function LocationsSettingsPage() {
  const toast = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY);

  async function load() {
    setLoading(true);
    try {
      setLocations(await api.get<Location[]>('/v1/tenant/locations'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The locations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.post<Location>('/v1/tenant/locations', draft);
      setLocations((l) => [...l, created]);
      setDraft(EMPTY);
      toast.success(`${created.name} added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The location could not be added.');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(l: Location) {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<Location>(`/v1/tenant/locations/${l.id}`, editDraft);
      setLocations((list) => list.map((x) => (x.id === l.id ? updated : x)));
      setEditingId(null);
      toast.success('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The location could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(l: Location) {
    if (!window.confirm(`Deactivate ${l.name}? Times that meet there will stop offering in person.`)) return;
    setError(null);
    try {
      const r = await api.delete<{ changedTimes: number }>(`/v1/tenant/locations/${l.id}`);
      setLocations((list) => list.map((x) => (x.id === l.id ? { ...x, isActive: false } : x)));
      toast.success(`Deactivated. ${r.changedTimes} ${r.changedTimes === 1 ? 'time was' : 'times were'} changed to online only or removed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The location could not be deactivated.');
    }
  }

  return (
    <Page header={<PageHeader eyebrow="PRACTICE" title="Locations" />}>
      {error ? <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <p className="text-[13px] text-[#64748B] -mt-2">Clients get the address, directions and a map link after they book.</p>

      <Card padding="p-5" className="space-y-4">
        <Eyebrow>ADD A LOCATION</Eyebrow>
        <form onSubmit={(e) => void add(e)} className="grid grid-cols-1 min-[760px]:grid-cols-2 gap-3">
          <Field label="Name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Lekki clinic" />
          <Field label="Street address" value={draft.address} onChange={(v) => setDraft((d) => ({ ...d, address: v }))} placeholder="12 Admiralty Way" />
          <Field label="City" value={draft.city} onChange={(v) => setDraft((d) => ({ ...d, city: v }))} placeholder="Lagos" />
          <Field label="Directions for clients (optional)" value={draft.directions} onChange={(v) => setDraft((d) => ({ ...d, directions: v }))} placeholder="Gate 2, second floor" />
          <div className="min-[760px]:col-span-2">
            <Button type="submit" disabled={saving || !draft.name || !draft.address || !draft.city}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add location
            </Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading…</p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-[#64748B]">Add the places you see clients in person. Clients get the address and directions after they book.</p>
      ) : (
        <div className="space-y-3">
          {locations.map((l) =>
            editingId === l.id ? (
              <Card key={l.id} padding="p-5" className="space-y-3">
                <Eyebrow>EDIT {l.name.toUpperCase()}</Eyebrow>
                <div className="grid grid-cols-1 min-[760px]:grid-cols-2 gap-3">
                  <Field label="Name" value={editDraft.name} onChange={(v) => setEditDraft((d) => ({ ...d, name: v }))} />
                  <Field label="Street address" value={editDraft.address} onChange={(v) => setEditDraft((d) => ({ ...d, address: v }))} />
                  <Field label="City" value={editDraft.city} onChange={(v) => setEditDraft((d) => ({ ...d, city: v }))} />
                  <Field label="Directions for clients (optional)" value={editDraft.directions} onChange={(v) => setEditDraft((d) => ({ ...d, directions: v }))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void saveEdit(l)} disabled={saving}>Save</Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </Card>
            ) : (
              <Card key={l.id} padding="p-5">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-[#0F3A53] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-[#0F172A]">
                      {l.name}
                      {!l.isActive ? <span className="ml-2 text-[11px] font-bold uppercase text-[#94A3B8]">Inactive</span> : null}
                    </p>
                    <p className="text-[13px] text-[#64748B]">{l.address}, {l.city}</p>
                    {l.directions ? <p className="text-[12.5px] text-[#64748B] italic mt-0.5">{l.directions}</p> : null}
                    {l.upcomingInPerson > 0 ? <p className="text-[12px] font-semibold text-[#475569] mt-1">{l.upcomingInPerson} upcoming in-person {l.upcomingInPerson === 1 ? 'session' : 'sessions'}</p> : null}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingId(l.id); setEditDraft({ name: l.name, address: l.address, city: l.city, directions: l.directions ?? '' }); }}
                      aria-label={`Edit ${l.name}`}
                      className="text-slate-400 hover:text-[#0F3A53] transition-colors cursor-pointer inline-flex p-1.5"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {l.isActive ? (
                      <button
                        onClick={() => void deactivate(l)}
                        aria-label={`Deactivate ${l.name}`}
                        className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer text-[12px] font-bold px-2"
                      >
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </Page>
  );
}
