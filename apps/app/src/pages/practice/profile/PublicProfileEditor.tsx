import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, ProgressRow, Textarea, useToast } from '@unclutterdesk/ui';
import { AppearancePicker } from './AppearancePicker';
import { profilePath } from '../../../config/domains';
import {
  KIND_LABELS,
  SECTION_TITLES,
  profileApi,
  type Checklist,
  type OwnProfile,
  type PractitionerKind,
  type ProfileTemplate,
  type SectionKey,
  type TaxonomyKind,
  type TaxonomyTerm,
  type TimelineEntry,
} from './profileApi';

/**
 * The public-profile editor (spec §6.4–§6.7). Sections follow §6.4's order;
 * each shows the chosen template's prompt and the shared guidance beside it.
 * The score, next step, publish blockers and writing tips come from the
 * server (GET me/checklist), so they always match what publishing enforces.
 */

const COUNTRIES: [string, string][] = [
  ['NG', 'Nigeria'],
  ['GH', 'Ghana'],
  ['KE', 'Kenya'],
  ['ZA', 'South Africa'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
  ['CA', 'Canada'],
];

const TIMELINE_TYPES: [TimelineEntry['type'], string][] = [
  ['EDUCATION', 'Education'],
  ['TRAINING', 'Training'],
  ['PRACTICE', 'Practice'],
  ['SUPERVISION', 'Supervision'],
  ['MEMBERSHIP', 'Membership'],
  ['MILESTONE', 'Milestone'],
];

const MAX_PRIMARY = 3;

type Draft = Pick<
  OwnProfile,
  | 'displayName'
  | 'kind'
  | 'pronouns'
  | 'headline'
  | 'city'
  | 'countryCode'
  | 'about'
  | 'credentialsText'
  | 'approach'
  | 'faithIntegration'
  | 'supervisedBy'
  | 'selfReportedYears'
  | 'showPlatformExperience'
  | 'feeRangeText'
  | 'contactEmailPublic'
> & { social: { website: string; instagram: string; linkedin: string } };

function draftOf(p: OwnProfile): Draft {
  return {
    displayName: p.displayName,
    kind: p.kind,
    pronouns: p.pronouns,
    headline: p.headline,
    city: p.city,
    countryCode: p.countryCode,
    about: p.about,
    credentialsText: p.credentialsText,
    approach: p.approach,
    faithIntegration: p.faithIntegration,
    supervisedBy: p.supervisedBy,
    selfReportedYears: p.selfReportedYears,
    showPlatformExperience: p.showPlatformExperience,
    feeRangeText: p.feeRangeText,
    contactEmailPublic: p.contactEmailPublic,
    social: {
      website: p.socialLinks?.website ?? '',
      instagram: p.socialLinks?.instagram ?? '',
      linkedin: p.socialLinks?.linkedin ?? '',
    },
  };
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

/** Section card: title, guidance from the template, then the fields. */
function Section({
  id,
  guidance,
  prompt,
  children,
}: {
  id: SectionKey;
  guidance?: string;
  prompt?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="lg" id={`section-${id}`} aria-labelledby={`section-${id}-title`}>
      <h2 id={`section-${id}-title`} className="text-[15px] font-bold text-[#0F172A]">
        {SECTION_TITLES[id]}
      </h2>
      {prompt && <p className="mt-1 text-[13px] font-semibold text-[#334155]">{prompt}</p>}
      {guidance && <p className="mt-1 text-[12.5px] text-[#64748B]">{guidance}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function Counter({ value, max }: { value: string | null | undefined; max: number }) {
  const n = value?.length ?? 0;
  return <span className={`text-[11.5px] font-semibold ${n > max ? 'text-[#B42318]' : 'text-[#94A3B8]'}`}>{`${n} / ${max}`}</span>;
}

/** Selectable chips for one taxonomy kind. Specialties can be starred as primary (up to three). */
function TermPicker({
  kind,
  terms,
  selected,
  primary,
  onToggle,
  onTogglePrimary,
}: {
  kind: TaxonomyKind;
  terms: TaxonomyTerm[];
  selected: Set<string>;
  primary: Set<string>;
  onToggle: (id: string) => void;
  onTogglePrimary?: (id: string) => void;
}) {
  const list = terms.filter((t) => t.kind === kind);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={`${kind.toLowerCase()} choices`}>
      {list.map((t) => {
        const on = selected.has(t.id);
        const star = primary.has(t.id);
        return (
          <span key={t.id} className="inline-flex items-center">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(t.id)}
              className={`h-[34px] px-3 rounded-full border text-[13px] font-semibold cursor-pointer ${
                on ? 'bg-[#0F3A53] border-[#0F3A53] text-white' : 'bg-white border-[#E2E8F0] text-[#334155]'
              }`}
            >
              {t.label}
            </button>
            {on && onTogglePrimary && (
              <button
                type="button"
                aria-pressed={star}
                aria-label={`${star ? 'Unmark' : 'Mark'} ${t.label} as a primary specialty`}
                onClick={() => onTogglePrimary(t.id)}
                className={`ml-1 h-[34px] w-[34px] rounded-full border text-[15px] cursor-pointer ${
                  star ? 'bg-[#FFF7E6] border-[#E3B341] text-[#8A5A00]' : 'bg-white border-[#E2E8F0] text-[#94A3B8]'
                }`}
              >
                ★
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Before a profile exists: choose a handle, kind and (optionally) a template, then start a draft. */
function StartProfile({ templates, onCreated }: { templates: ProfileTemplate[]; onCreated: (p: OwnProfile) => void }) {
  const toast = useToast();
  const [handle, setHandle] = useState('');
  const [kind, setKind] = useState<PractitionerKind>('COUNSELLOR');
  const [templateKey, setTemplateKey] = useState('');
  const [check, setCheck] = useState<{ available: boolean; message?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!handle.trim()) {
      setCheck(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      profileApi
        .checkHandle(handle.trim())
        .then((r) => live && setCheck(r))
        .catch(() => live && setCheck(null));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [handle]);

  async function start() {
    setBusy(true);
    try {
      const created = await profileApi.create({ handle: handle.trim() || undefined, kind });
      const withTemplate = templateKey ? await profileApi.update({ templateKey }) : created;
      toast.success('Your profile draft is ready');
      onCreated(withTemplate);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="lg">
      <h2 className="text-[17px] font-bold text-[#0F172A]">Create your therapist profile</h2>
      <p className="mt-1 text-[13px] text-[#64748B]">
        A public page clients can find and share. We start it from the details your practice already holds. Nothing is
        public until you publish.
      </p>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Input
            label="Your profile address"
            optionalLabel="(leave blank to suggest one from your name)"
            value={handle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandle(e.target.value)}
            placeholder="adaeze-okonkwo"
          />
          <span className="text-[12px] text-[#64748B]">{profilePath(handle.trim() || 'your-name')}</span>
          {check && (
            <span role="status" className={`text-[12px] font-semibold ${check.available ? 'text-[#067647]' : 'text-[#B42318]'}`}>
              {check.available ? 'Available' : check.message}
            </span>
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold text-[#475569]">I am a</span>
          <select
            className="h-[46px] px-3 rounded-[14px] border border-[#E2E8F0] bg-white text-sm font-medium"
            value={kind}
            onChange={(e) => setKind(e.target.value as PractitionerKind)}
          >
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-[11.5px] font-bold text-[#475569]">Start from a template (optional)</span>
          <select
            className="h-[46px] px-3 rounded-[14px] border border-[#E2E8F0] bg-white text-sm font-medium"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-5">
        <Button onClick={() => void start()} disabled={busy || (check !== null && !check.available)}>
          {busy ? 'Creating…' : 'Create my profile'}
        </Button>
      </div>
    </Card>
  );
}

export function PublicProfileEditor({ onProfileChange }: { onProfileChange?: (p: OwnProfile | null) => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [templates, setTemplates] = useState<ProfileTemplate[]>([]);
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primary, setPrimary] = useState<Set<string>>(new Set());
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({ fields: false, terms: false, timeline: false });

  const adopt = useCallback(
    (p: OwnProfile | null) => {
      setProfile(p);
      onProfileChange?.(p);
      if (!p) return;
      setDraft(draftOf(p));
      setSelected(new Set(p.taxonomy.map((t) => String(t.termId))));
      setPrimary(new Set(p.taxonomy.filter((t) => t.isPrimary).map((t) => String(t.termId))));
      setTimeline(p.timeline.map(({ id: _id, ...e }) => e));
      setDirty({ fields: false, terms: false, timeline: false });
    },
    [onProfileChange],
  );

  const refreshChecklist = useCallback(async () => {
    try {
      setChecklist(await profileApi.checklist());
    } catch {
      setChecklist(null);
    }
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([profileApi.getOwn(), profileApi.templates(), profileApi.taxonomy()])
      .then(async ([p, t, tax]) => {
        if (!live) return;
        setTemplates(t);
        setTerms(tax);
        adopt(p);
        if (p) await refreshChecklist();
      })
      .catch((err) => live && toast.error(errorText(err)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // Load once; adopt and refreshChecklist are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const template = useMemo(() => templates.find((t) => t.key === profile?.templateKey) ?? null, [templates, profile?.templateKey]);
  const general = useMemo(() => templates.find((t) => t.key === 'general') ?? null, [templates]);
  const guidance = (s: SectionKey) => template?.sections.guidance?.[s] ?? general?.sections.guidance?.[s];
  const prompt = (s: SectionKey) => template?.sections.sections?.[s]?.prompt;
  const example = (s: SectionKey) => template?.sections.sections?.[s]?.example;

  if (loading) return <p className="text-sm text-[#64748B]">Loading your profile…</p>;
  if (!profile || !draft) {
    return (
      <StartProfile
        templates={templates.filter((t) => t.key !== 'general')}
        onCreated={(p) => {
          adopt(p);
          void refreshChecklist();
        }}
      />
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty((x) => ({ ...x, fields: true }));
  };
  const text = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never);
  const insertExample = (key: 'headline' | 'about' | 'approach' | 'credentialsText' | 'faithIntegration', section: SectionKey) => {
    const ex = example(section);
    if (ex) set(key, ex);
  };

  const toggleTerm = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
        setPrimary((p) => {
          const q = new Set(p);
          q.delete(id);
          return q;
        });
      } else next.add(id);
      return next;
    });
    setDirty((x) => ({ ...x, terms: true }));
  };
  const togglePrimary = (id: string) => {
    if (!primary.has(id) && primary.size >= MAX_PRIMARY) {
      toast.error(`Choose at most ${MAX_PRIMARY} primary specialties`);
      return;
    }
    setPrimary((p) => {
      const q = new Set(p);
      if (q.has(id)) q.delete(id);
      else q.add(id);
      return q;
    });
    setDirty((x) => ({ ...x, terms: true }));
  };

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      let latest: OwnProfile | null = null;
      if (dirty.fields) {
        const { social, ...fields } = draft;
        const socialLinks = Object.fromEntries(Object.entries(social).filter(([, v]) => v.trim()));
        latest = await profileApi.update({ ...fields, socialLinks: Object.keys(socialLinks).length ? socialLinks : null });
      }
      if (dirty.terms) {
        latest = await profileApi.setTaxonomy([...selected].map((termId) => ({ termId, isPrimary: primary.has(termId) })));
      }
      if (dirty.timeline) latest = await profileApi.setTimeline(timeline.filter((e) => e.title.trim()));
      if (latest) adopt(latest);
      await refreshChecklist();
      toast.success('Profile saved');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    try {
      adopt(await profileApi.setPhoto(await readAsDataUrl(file)));
      await refreshChecklist();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function chooseAppearance(change: { layoutKey?: string; themeKey?: string }) {
    try {
      const next = await profileApi.update(change);
      setProfile(next);
      onProfileChange?.(next);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function publish() {
    try {
      const { profile: next, warnings } = await profileApi.publish();
      adopt(next);
      await refreshChecklist();
      if (warnings.unchangedTemplateText.length) {
        toast.success(
          `Published. ${warnings.unchangedTemplateText.map((s) => SECTION_TITLES[s]).join(', ')} still has template text — make it yours?`,
        );
      } else toast.success('Your profile is live');
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function unpublish() {
    try {
      adopt(await profileApi.unpublish());
      await refreshChecklist();
      toast.success('Your profile is no longer public');
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  const anyDirty = dirty.fields || dirty.terms || dirty.timeline;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <div className="flex flex-col gap-5">
        <Section id="identity" guidance={guidance('identity')} prompt={prompt('identity')}>
          <div className="flex items-center gap-4">
            <div
              className="h-[72px] w-[72px] rounded-full bg-[#EEF2F7] flex items-center justify-center text-[12px] font-semibold text-[#64748B]"
              aria-label={profile.photoKey ? 'Photo set' : 'No photo yet'}
            >
              {profile.photoKey ? 'Photo set' : 'No photo'}
            </div>
            <label className="text-[13px] font-semibold text-[#0F3A53] cursor-pointer">
              {profile.photoKey ? 'Change photo' : 'Add a photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Profile photo"
                onChange={(e) => void choosePhoto(e.target.files?.[0])}
              />
            </label>
            {profile.photoKey && (
              <Button variant="ghost" size="sm" onClick={() => void profileApi.removePhoto().then(adopt).then(refreshChecklist)}>
                Remove
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" value={draft.displayName ?? ''} onChange={text('displayName')} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-bold text-[#475569]">I am a</span>
              <select
                aria-label="Practitioner type"
                className="h-[46px] px-3 rounded-[14px] border border-[#E2E8F0] bg-white text-sm font-medium"
                value={draft.kind}
                onChange={(e) => set('kind', e.target.value as PractitionerKind)}
              >
                {Object.entries(KIND_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Input label="City" optionalLabel="(optional)" value={draft.city ?? ''} onChange={text('city')} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-bold text-[#475569]">Country</span>
              <select
                aria-label="Country"
                className="h-[46px] px-3 rounded-[14px] border border-[#E2E8F0] bg-white text-sm font-medium"
                value={draft.countryCode}
                onChange={(e) => set('countryCode', e.target.value)}
              >
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Pronouns" optionalLabel="(optional)" value={draft.pronouns ?? ''} onChange={text('pronouns')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Input label="Headline" value={draft.headline ?? ''} onChange={text('headline')} maxLength={120} />
            <div className="flex items-center justify-between">
              <Counter value={draft.headline} max={120} />
              {example('identity') && (
                <Button variant="ghost" size="sm" onClick={() => insertExample('headline', 'identity')}>
                  Use this example as a starting point
                </Button>
              )}
            </div>
          </div>
          {draft.kind === 'TRAINEE' && (
            <Input
              label="Supervised by"
              optionalLabel="(shown as “Practising under supervision”)"
              value={draft.supervisedBy ?? ''}
              onChange={text('supervisedBy')}
            />
          )}
        </Section>

        <Section id="about" guidance={guidance('about')} prompt={prompt('about')}>
          <Textarea label="About you" rows={7} value={draft.about ?? ''} onChange={text('about')} maxLength={2000} />
          <div className="flex items-center justify-between">
            <Counter value={draft.about} max={2000} />
            {example('about') && (
              <Button variant="ghost" size="sm" onClick={() => insertExample('about', 'about')}>
                Use this example as a starting point
              </Button>
            )}
          </div>
        </Section>

        <Section id="qualifications" guidance={guidance('qualifications')} prompt={prompt('qualifications')}>
          <Textarea
            label="Qualifications & memberships"
            rows={3}
            value={draft.credentialsText ?? ''}
            onChange={text('credentialsText')}
            maxLength={1000}
          />
          {example('qualifications') && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => insertExample('credentialsText', 'qualifications')}>
                Use this example as a starting point
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-3" aria-label="Training & journey">
            <span className="text-[11.5px] font-bold text-[#475569]">Training & journey</span>
            {timeline.map((e, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_90px_90px_auto] gap-2 items-end">
                <select
                  aria-label={`Entry ${i + 1} type`}
                  className="h-[44px] px-2 rounded-[14px] border border-[#E2E8F0] bg-white text-sm"
                  value={e.type}
                  onChange={(ev) => {
                    const next = [...timeline];
                    next[i] = { ...e, type: ev.target.value as TimelineEntry['type'] };
                    setTimeline(next);
                    setDirty((x) => ({ ...x, timeline: true }));
                  }}
                >
                  {TIMELINE_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                {(['title', 'organisation'] as const).map((field) => (
                  <Input
                    key={field}
                    height={44}
                    aria-label={`Entry ${i + 1} ${field}`}
                    placeholder={field === 'title' ? 'MSc Counselling' : 'University of Lagos'}
                    value={e[field] ?? ''}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                      const next = [...timeline];
                      next[i] = { ...e, [field]: ev.target.value };
                      setTimeline(next);
                      setDirty((x) => ({ ...x, timeline: true }));
                    }}
                  />
                ))}
                {(['startYear', 'endYear'] as const).map((field) => (
                  <Input
                    key={field}
                    height={44}
                    type="number"
                    aria-label={`Entry ${i + 1} ${field === 'startYear' ? 'start year' : 'end year'}`}
                    placeholder={field === 'startYear' ? 'From' : 'To'}
                    value={e[field] ?? ''}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                      const next = [...timeline];
                      next[i] = { ...e, [field]: ev.target.value ? Number(ev.target.value) : null };
                      setTimeline(next);
                      setDirty((x) => ({ ...x, timeline: true }));
                    }}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove entry ${i + 1}`}
                  onClick={() => {
                    setTimeline(timeline.filter((_, j) => j !== i));
                    setDirty((x) => ({ ...x, timeline: true }));
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTimeline([...timeline, { type: 'EDUCATION', title: '' }]);
                  setDirty((x) => ({ ...x, timeline: true }));
                }}
              >
                Add an entry
              </Button>
            </div>
          </div>
        </Section>

        <Section id="specialties" guidance={guidance('specialties')} prompt={prompt('specialties')}>
          <p className="text-[12.5px] text-[#64748B]">{`Star up to ${MAX_PRIMARY} as your primary specialties.`}</p>
          <TermPicker
            kind="SPECIALTY"
            terms={terms}
            selected={selected}
            primary={primary}
            onToggle={toggleTerm}
            onTogglePrimary={togglePrimary}
          />
        </Section>

        <Section id="approach" guidance={guidance('approach')} prompt={prompt('approach')}>
          <Textarea label="How you work" rows={4} value={draft.approach ?? ''} onChange={text('approach')} maxLength={1500} />
          {example('approach') && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => insertExample('approach', 'approach')}>
                Use this example as a starting point
              </Button>
            </div>
          )}
          <TermPicker kind="MODALITY" terms={terms} selected={selected} primary={primary} onToggle={toggleTerm} />
        </Section>

        <Section id="population" guidance={guidance('population')} prompt={prompt('population')}>
          <TermPicker kind="POPULATION" terms={terms} selected={selected} primary={primary} onToggle={toggleTerm} />
          <Input
            label="Faith integration"
            optionalLabel="(optional)"
            value={draft.faithIntegration ?? ''}
            onChange={text('faithIntegration')}
          />
        </Section>

        <Section id="languages" guidance={guidance('languages')} prompt={prompt('languages')}>
          <TermPicker kind="LANGUAGE" terms={terms} selected={selected} primary={primary} onToggle={toggleTerm} />
        </Section>

        <Section id="experience" guidance={guidance('experience')} prompt={prompt('experience')}>
          <Input
            label="Years in practice"
            type="number"
            min={0}
            max={70}
            value={draft.selfReportedYears ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('selfReportedYears', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Section>

        <Section id="fees" guidance={guidance('fees')} prompt={prompt('fees')}>
          <Input
            label="Fee range"
            optionalLabel="(e.g. ₦15,000–₦25,000 per session)"
            value={draft.feeRangeText ?? ''}
            onChange={text('feeRangeText')}
          />
        </Section>

        <Section id="contact" guidance={guidance('contact')} prompt={prompt('contact')}>
          <Input
            label="Public email"
            optionalLabel="(shown only if you add it)"
            type="email"
            value={draft.contactEmailPublic ?? ''}
            onChange={text('contactEmailPublic')}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['website', 'instagram', 'linkedin'] as const).map((k) => (
              <Input
                key={k}
                label={k === 'linkedin' ? 'LinkedIn' : k === 'instagram' ? 'Instagram' : 'Website'}
                optionalLabel="(https:// link)"
                value={draft.social[k]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('social', { ...draft.social, [k]: e.target.value })}
              />
            ))}
          </div>
        </Section>

        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => void save()} disabled={saving || !anyDirty}>
            {saving ? 'Saving…' : anyDirty ? 'Save changes' : 'All changes saved'}
          </Button>
        </div>
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-4" aria-label="Profile checklist">
        <Card padding="lg">
          <ProgressRow label="Profile strength" percent={checklist?.score ?? profile.completenessScore} />
          {checklist?.next && (
            <p className="mt-3 text-[13px] text-[#334155]">
              Next: <a href={`#section-${checklist.next}`} className="font-semibold text-[#0F3A53] underline">{SECTION_TITLES[checklist.next]}</a>
            </p>
          )}
          {checklist && checklist.blockers.length > 0 && (
            <div className="mt-4">
              <span className="text-[12px] font-bold text-[#475569]">Before you can publish</span>
              <ul className="mt-1.5 list-disc pl-5 text-[13px] text-[#334155]" aria-label="Before you can publish">
                {checklist.blockers.map((b) => (
                  <li key={b.key}>{b.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[12px] font-bold text-[#475569]">
              {profile.status === 'PUBLISHED' ? 'Live' : profile.status === 'SUSPENDED' ? 'Suspended' : profile.status === 'HIDDEN' ? 'Hidden' : 'Draft'}
            </span>
            {profile.status === 'PUBLISHED' ? (
              <Button variant="secondary" size="sm" onClick={() => void unpublish()}>
                Unpublish
              </Button>
            ) : (
              <Button size="sm" onClick={() => void publish()} disabled={!checklist?.canPublish || anyDirty || profile.status === 'SUSPENDED'}>
                Publish
              </Button>
            )}
          </div>
          {anyDirty && <p className="mt-2 text-[12px] text-[#64748B]">Save your changes before publishing.</p>}
          <p className="mt-3 text-[12px] text-[#64748B] break-all">{profilePath(profile.handle)}</p>
        </Card>

        {checklist && checklist.tips.length > 0 && (
          <Card padding="lg">
            <span className="text-[15px] font-bold text-[#0F172A]">Writing tips</span>
            <ul className="mt-2 flex flex-col gap-2" aria-label="Writing tips">
              {checklist.tips.map((t, i) => (
                <li key={i} className={`text-[13px] ${t.severity === 'strong' ? 'text-[#B42318] font-semibold' : 'text-[#334155]'}`}>
                  <span className="font-semibold">“{t.match}”</span> — {t.message}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <AppearancePicker
          layoutKey={profile.layoutKey}
          themeKey={profile.themeKey}
          name={profile.displayName}
          kindLabel={KIND_LABELS[profile.kind as keyof typeof KIND_LABELS] ?? 'Therapist'}
          headline={profile.headline}
          onChange={(change) => void chooseAppearance(change)}
        />
      </aside>
    </div>
  );
}
