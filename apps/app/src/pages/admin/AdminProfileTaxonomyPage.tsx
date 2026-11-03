import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { Badge, Button, Card, Eyebrow, Input, Toggle, useToast } from '@unclutterdesk/ui';
import { adminProfileContentApi } from './adminProfileContentApi';
import { ProfileContentTabs } from './ProfileContentTabs';
import { PROFILE_CONTENT_BASE, TAXONOMY_KINDS, TAXONOMY_KIND_LABELS, TAXONOMY_KIND_SINGULAR, type AdminTaxonomyTerm, type TaxonomyKind } from './profileContentTypes';

const fieldShell = 'h-10 w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3 text-[13.5px] text-[#0F172A]';

interface TermForm {
  kind: TaxonomyKind;
  label: string;
  key: string;
  sortOrder: number;
  isActive: boolean;
}

const blankForm = (kind: TaxonomyKind = 'SPECIALTY'): TermForm => ({ kind, label: '', key: '', sortOrder: 0, isActive: true });

function orderOf(a: AdminTaxonomyTerm, b: AdminTaxonomyTerm) {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

/**
 * Specialties, modalities, populations and languages (spec §6.4). Admins add
 * terms, rename them, re-key them, deactivate them and change their order.
 * Renames and deactivations purge every published profile that shows the term.
 */
export function AdminProfileTaxonomyPage() {
  const toast = useToast();
  const { data: terms, isLoading, error: loadError, mutate } = useSWR<AdminTaxonomyTerm[]>(`${PROFILE_CONTENT_BASE}/taxonomy`);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = terms?.find((term) => term.id === selectedId) ?? null;

  const [form, setForm] = useState<TermForm>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');
  // "Deactivate" from the list: open the term switched off and ask why, so
  // the audit always records a real reason (the API requires one).
  const deactivating = useRef<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const groups = useMemo(
    () =>
      TAXONOMY_KINDS.map((kind) => ({
        kind,
        label: TAXONOMY_KIND_LABELS[kind],
        terms: (terms ?? []).filter((term) => term.kind === kind).sort(orderOf),
      })),
    [terms],
  );

  useEffect(() => {
    if (!selected) return;
    setForm({
      kind: selected.kind,
      label: selected.label,
      key: selected.key,
      sortOrder: selected.sortOrder,
      isActive: selected.isActive,
    });
    setReason('');
    setError(null);
  }, [selected?.id, selected?.label, selected?.key, selected?.sortOrder, selected?.isActive]);

  // Runs after the form above has loaded the term, so it is never overwritten.
  useEffect(() => {
    if (!selected || deactivating.current !== selected.id) return;
    deactivating.current = null;
    setForm((current) => ({ ...current, isActive: false }));
    setError('Say why this term is being deactivated, then save.');
    reasonRef.current?.focus();
  });

  function nextSortOrder(kind: TaxonomyKind): number {
    const group = (terms ?? []).filter((term) => term.kind === kind);
    return group.reduce((max, term) => Math.max(max, term.sortOrder), 0) + 10;
  }

  function startNew(kind: TaxonomyKind = 'SPECIALTY') {
    setSelectedId(null);
    setForm({ ...blankForm(kind), sortOrder: nextSortOrder(kind) });
    setError(null);
  }

  function setKind(kind: TaxonomyKind) {
    setForm((current) => ({ ...current, kind, sortOrder: current.label ? current.sortOrder : nextSortOrder(kind) }));
  }

  async function save() {
    setError(null);
    if (!form.label.trim()) {
      setError('Add a label.');
      return;
    }

    // Check if deactivating or re-keying
    const isDeactivating = selected && selected.isActive && !form.isActive;
    const isRekeying = selected && selected.key !== form.key.trim();

    if ((isDeactivating || isRekeying) && !reason.trim()) {
      setError('Reason is required when deactivating or changing the key of a term.');
      toast.error('Reason is required when deactivating or changing the key of a term.');
      return;
    }

    setSaving(true);
    try {
      if (selected) {
        await adminProfileContentApi.updateTaxonomy(selected.id, {
          label: form.label.trim(),
          ...(form.key.trim() ? { key: form.key.trim() } : {}),
          isActive: form.isActive,
          sortOrder: form.sortOrder,
          reason: reason.trim() || null,
        });
        toast.success('Term saved');
        await mutate();
      } else {
        const created = await adminProfileContentApi.createTaxonomy({
          kind: form.kind,
          label: form.label.trim(),
          ...(form.key.trim() ? { key: form.key.trim() } : {}),
          sortOrder: form.sortOrder,
          reason: reason.trim() || null,
        });
        toast.success('Term added');
        await mutate();
        setSelectedId(created.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the term';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(term: AdminTaxonomyTerm) {
    if (term.isActive) {
      deactivating.current = term.id;
      setSelectedId(term.id);
      // Same term already open: no reload will happen, so apply it here.
      if (selectedId === term.id) {
        deactivating.current = null;
        setForm((current) => ({ ...current, isActive: false }));
        setReason('');
        setError('Say why this term is being deactivated, then save.');
        reasonRef.current?.focus();
      }
      return;
    }
    try {
      await adminProfileContentApi.updateTaxonomy(term.id, { isActive: true, reason: null });
      await mutate();
      toast.success('Term reactivated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the term');
    }
  }

  async function move(term: AdminTaxonomyTerm, direction: -1 | 1) {
    const group = (terms ?? []).filter((candidate) => candidate.kind === term.kind).sort(orderOf);
    const index = group.findIndex((candidate) => candidate.id === term.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= group.length) return;

    const next = [...group];
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await adminProfileContentApi.reorderTaxonomy({ kind: term.kind, ids: next.map((candidate) => candidate.id) });
      await mutate();
      toast.success('Order saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reorder the terms');
    }
  }

  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1100px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Profile taxonomy</h1>
      <p className="mt-1 max-w-[780px] text-[13.5px] text-[#64748B]">
        The terms practitioners choose from. Deactivated terms stay on existing profiles in the database but disappear from public pages and the editor.
        Renames, deactivations and reorders purge the pages that use them. Every change is recorded in the admin audit log.
      </p>
      <ProfileContentTabs />

      <Card className="mt-5 p-[22px] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-bold text-[#0F172A]">{selected ? 'Edit term' : 'Add a term'}</p>
            <p className="mt-1 text-[12.5px] text-[#64748B]">
              {selected
                ? 'Changing the key rewrites it in every template that suggests it. Profiles keep the term they chose, so they are unaffected.'
                : 'The key is the stable slug; leave it blank to make one from the label.'}
            </p>
          </div>
          {selected ? (
            <Button variant="ghost" onClick={() => startNew(selected.kind)}>Add a new term instead</Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5 text-[11.5px] font-bold text-[#475569]">
            Kind
            <select
              className={fieldShell}
              value={form.kind}
              disabled={Boolean(selected)}
              onChange={(e) => setKind(e.target.value as TaxonomyKind)}
            >
              {TAXONOMY_KINDS.map((kind) => (
                <option key={kind} value={kind}>{TAXONOMY_KIND_LABELS[kind]}</option>
              ))}
            </select>
          </label>
          <Input label="Label" value={form.label} maxLength={80} onChange={(e: any) => setForm((current) => ({ ...current, label: e.target.value }))} />
          <Input
            label="Key"
            optionalLabel={selected ? '(leave blank to keep)' : '(optional)'}
            value={form.key}
            maxLength={60}
            onChange={(e: any) => setForm((current) => ({ ...current, key: e.target.value }))}
          />
          <Input
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(e: any) => setForm((current) => ({ ...current, sortOrder: Number(e.target.value) }))}
          />
        </div>

        {selected ? (
          <div className="flex flex-wrap items-center gap-3">
            <Toggle width={48} checked={form.isActive} onChange={(next: boolean) => setForm((current) => ({ ...current, isActive: next }))} aria-label="Term active" />
            <span className="text-[12.5px] text-[#64748B]">
              {form.isActive ? 'Active: shown in the editor and on public profiles' : 'Inactive: hidden from the editor and public profiles'}
            </span>
          </div>
        ) : null}

        <div className="space-y-1">
          <label htmlFor="taxonomy-reason" className="text-[11.5px] font-bold text-[#475569]">Reason for change</label>
          <textarea
            id="taxonomy-reason"
            ref={reasonRef}
            className="w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3 py-2 text-[13.5px] text-[#0F172A] min-h-[80px]"
            placeholder="Optional, unless deactivating or changing the key."
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error ? <p role="alert" className="text-[13px] font-semibold text-[#B91C1C]">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : selected ? 'Save term' : 'Add term'}</Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="mt-5 p-[22px]"><p className="text-sm text-[#64748B]">Loading terms…</p></Card>
      ) : loadError ? (
        <Card className="mt-5 p-[22px]"><p className="text-sm text-[#B91C1C]">Could not load taxonomy. Please refresh.</p></Card>
      ) : (
        <div className="mt-5 space-y-4">
          {groups.map((group) => (
            <Card key={group.kind} className="p-[22px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[16px] font-bold text-[#0F172A]">{group.label}</p>
                  <p className="text-[12px] text-[#64748B]">{group.terms.length} term{group.terms.length === 1 ? '' : 's'}</p>
                </div>
                <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => startNew(group.kind)}>
                  Add {TAXONOMY_KIND_SINGULAR[group.kind]}
                </Button>
              </div>

              {!group.terms.length ? (
                <p className="mt-4 text-[13px] text-[#64748B]">No terms yet.</p>
              ) : (
                <div className="mt-4 divide-y divide-[#F1F5F9]">
                  {group.terms.map((term, index) => (
                    <div key={term.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[13.5px] font-bold text-[#0F172A]">{term.label}</span>
                          <span className="font-mono text-[11.5px] text-[#94A3B8]">{term.key}</span>
                          {!term.isActive ? <Badge>Inactive</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-[#64748B]">
                          {term.usageCount} profile{term.usageCount === 1 ? '' : 's'} using this term
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move ${term.label} up`}
                        disabled={index === 0}
                        onClick={() => move(term, -1)}
                        icon={<ArrowUp className="h-3.5 w-3.5" />}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move ${term.label} down`}
                        disabled={index === group.terms.length - 1}
                        onClick={() => move(term, 1)}
                        icon={<ArrowDown className="h-3.5 w-3.5" />}
                      />
                      <Button variant="secondary" size="sm" onClick={() => setSelectedId(term.id)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(term)}>
                        {term.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}