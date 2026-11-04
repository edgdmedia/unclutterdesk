import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button, Card, Eyebrow, Input, Textarea, Toggle, useToast } from '@unclutterdesk/ui';
import { adminProfileContentApi } from './adminProfileContentApi';
import { ProfileContentTabs } from './ProfileContentTabs';
import { formatDate } from './adminTypes';
import {
  KIND_OPTIONS,
  PROFILE_CONTENT_BASE,
  SECTION_ORDER,
  blankTemplateSections,
  draftSections,
  type AdminProfileTemplate,
  type PractitionerKind,
  type TemplateSectionDrafts,
} from './profileContentTypes';
import { SECTION_TITLES } from '../practice/profile/profileApi';

const fieldShell = 'h-10 w-full rounded-[12px] border border-[var(--desk-border)] bg-white px-3 text-[13.5px] text-[var(--desk-text)]';

function sectionError(section: keyof typeof SECTION_TITLES): string {
  return `${SECTION_TITLES[section]} needs a prompt before it can have an example.`;
}

/**
 * The selectable profile templates (spec §6.6). Each template is starting
 * content: a title, description, practitioner kind, and per-section prompts and
 * examples. Editing here changes what every practitioner sees in the editor.
 */
export function AdminProfileTemplatesPage() {
  const toast = useToast();
  const { data: templates, isLoading, error: loadError, mutate } = useSWR<AdminProfileTemplate[]>(`${PROFILE_CONTENT_BASE}/templates`);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = templates?.find((template) => template.key === selectedKey) ?? templates?.[0] ?? null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<PractitionerKind | ''>('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [sections, setSections] = useState<TemplateSectionDrafts>(blankTemplateSections());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setDescription(selected.description);
    setKind(selected.kind ?? '');
    setIsActive(selected.isActive);
    setSortOrder(selected.sortOrder);
    setSections(draftSections(selected));
    setReason('');
    setError(null);
  }, [selected?.key, selected?.updatedAt]);

  function updateSection(section: keyof TemplateSectionDrafts, field: 'prompt' | 'example', value: string) {
    setSections((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  }

  async function save() {
    if (!selected) return;
    setError(null);

    if (!title.trim()) {
      setError('Add a title.');
      return;
    }
    if (!description.trim()) {
      setError('Add a description.');
      return;
    }

    // Reason required when deactivating
    if (isActive === false && selected.isActive === true && !reason.trim()) {
      setError('Reason is required when deactivating a template.');
      toast.error('Reason is required when deactivating a template.');
      return;
    }

    const clean: Record<string, { prompt: string; example: string | null } | null> = {};
    for (const section of SECTION_ORDER) {
      const draft = sections[section];
      if (!draft.prompt.trim() && !draft.example.trim()) {
        clean[section] = null;
        continue;
      }
      if (!draft.prompt.trim()) {
        const message = sectionError(section);
        setError(message);
        toast.error(message);
        return;
      }
      clean[section] = { prompt: draft.prompt.trim(), example: draft.example.trim() || null };
    }

    setSaving(true);
    try {
      await adminProfileContentApi.updateTemplate(selected.key, {
        title: title.trim(),
        description: description.trim(),
        kind: kind || null,
        isActive,
        sortOrder,
        sections: clean,
        reason: reason.trim() || null,
      });
      await mutate();
      toast.success('Template saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the template';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1240px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">Profile templates</h1>
      <p className="mt-1 max-w-[760px] text-[13.5px] text-[var(--desk-text-muted)]">
        Starting content for different kinds of practitioner. Prompts sit beside each section in the editor; examples can be inserted and rewritten.
        Every save is recorded in the admin audit log.
      </p>
      <ProfileContentTabs />

      {isLoading ? (
        <Card className="mt-5 p-[22px]"><p className="text-sm text-[var(--desk-text-muted)]">Loading templates…</p></Card>
      ) : loadError ? (
        <Card className="mt-5 p-[22px]"><p className="text-sm text-[var(--desk-danger)]">Could not load templates. Please refresh.</p></Card>
      ) : !templates?.length ? (
        <Card className="mt-5 p-[22px]"><p className="text-sm text-[var(--desk-text-muted)]">No templates exist yet.</p></Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
          <Card className="p-[14px]">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--desk-text-muted)]">Templates</p>
            <div className="space-y-1">
              {templates.map((template) => {
                const active = template.key === selected?.key;
                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => setSelectedKey(template.key)}
                    className={`w-full rounded-[12px] px-3 py-2.5 text-left cursor-pointer border ${
                      active ? 'border-[var(--desk-pine-200)] bg-[var(--desk-surface)]' : 'border-transparent hover:bg-[var(--desk-surface)]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-bold text-[var(--desk-text)]">{template.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          template.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--desk-surface-muted)] text-[var(--desk-text-muted)]'
                        }`}
                      >
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                    <span className="mt-1 block text-[12px] text-[var(--desk-text-muted)]">
                      {template.kind ? KIND_OPTIONS.find((option) => option.value === template.kind)?.label : 'All practitioners'}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {selected ? (
            <div className="space-y-5 min-w-0">
              <Card className="p-[22px] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--desk-text-muted)]">Editing</p>
                    <p className="text-[16px] font-bold text-[var(--desk-text)]">{selected.title}</p>
                  </div>
                  <p className="text-[12px] text-[var(--desk-text-muted)]">Last saved {formatDate(selected.updatedAt)}</p>
                </div>

                <Input label="Title" value={title} maxLength={120} onChange={(e: any) => setTitle(e.target.value)} />
                <Textarea
                  label="Description"
                  value={description}
                  rows={2}
                  maxLength={500}
                  onChange={(e: any) => setDescription(e.target.value)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1.5 text-[11.5px] font-bold text-[var(--desk-text-body)]">
                    Practitioner kind
                    <select className={fieldShell} value={kind} onChange={(e) => setKind(e.target.value as PractitionerKind | '')}>
                      <option value="">All practitioners</option>
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <Input
                    label="Sort order"
                    type="number"
                    value={sortOrder}
                    onChange={(e: any) => setSortOrder(Number(e.target.value))}
                  />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-bold text-[var(--desk-text-body)]">Visible to practitioners</span>
                    <div className="h-10 flex items-center gap-2">
                      <Toggle width={48} checked={isActive} onChange={setIsActive} aria-label="Visible to practitioners" />
                      <span className="text-[12.5px] text-[var(--desk-text-muted)]">{isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-[22px] space-y-4">
                <div>
                  <p className="text-[16px] font-bold text-[var(--desk-text)]">Section prompts and examples</p>
                  <p className="mt-1 text-[12.5px] text-[var(--desk-text-muted)]">
                    Leave a section blank to remove it from this template. A section with an example needs a prompt.
                  </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {SECTION_ORDER.map((section) => {
                    const draft = sections[section];
                    return (
                      <div key={section} className="rounded-[16px] border border-[var(--desk-border)] p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12.5px] font-bold text-[var(--desk-text)]">{SECTION_TITLES[section]}</p>
                          {!draft.prompt.trim() && !draft.example.trim() ? (
                            <span className="text-[10.5px] font-semibold text-[var(--desk-text-subtle)]">Blank</span>
                          ) : null}
                        </div>
                        <Input
                          label="Prompt"
                          value={draft.prompt}
                          maxLength={300}
                          onChange={(e: any) => updateSection(section, 'prompt', e.target.value)}
                        />
                        <Textarea
                          label="Example"
                          optionalLabel="optional"
                          value={draft.example}
                          rows={3}
                          maxLength={2000}
                          onChange={(e: any) => updateSection(section, 'example', e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>

              {error ? <p role="alert" className="text-[13px] font-semibold text-[var(--desk-danger)]">{error}</p> : null}

              <Card className="p-[22px]">
                <p className="text-[12.5px] font-bold text-[var(--desk-text)]">Reason for change</p>
                <p className="mt-0.5 text-[12px] text-[var(--desk-text-muted)]">Optional, unless deactivating this template.</p>
                <Textarea
                  value={reason}
                  rows={2}
                  maxLength={500}
                  placeholder="Why this change?"
                  onChange={(e: any) => setReason(e.target.value)}
                />
              </Card>

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save template'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}