import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { api } from '../../utils/apiClient';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { formatDate } from './adminTypes';

interface StoredInstrument {
  key: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  builtIn: boolean;
  definition: {
    key: string;
    shortName: string;
    name: string;
    tier: string;
    items: Array<{ id: string; text: string }>;
    scale: Array<{ value: number; label: string }>;
  };
  updatedAt: string;
}

interface Preview {
  errors: string[];
  answersError?: string;
  result?: unknown;
}

const STATUS_STYLE: Record<StoredInstrument['status'], string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  DRAFT: 'bg-[#FEF3C7] text-[#92400E]',
  RETIRED: 'bg-[#F1F5F9] text-[#64748B]',
};

const TEMPLATE = {
  key: 'NEW_INSTRUMENT',
  name: 'Full name of the instrument',
  shortName: 'SHORT',
  measures: 'What it measures',
  instructions: 'Shown to the client above the questions.',
  estimatedMinutes: 3,
  tier: 'PRO',
  clientResults: 'summary',
  scale: [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Sometimes' },
    { value: 2, label: 'Often' },
  ],
  items: [
    { id: 'new_1', text: 'First question' },
    { id: 'new_2', text: 'Second question' },
  ],
  scoring: {
    total: { from: 'items' },
    headline: 'total',
    bands: [
      { min: 0, label: 'Low', level: 0, clinicianText: 'For the clinician.', clientText: 'For the client.' },
      { min: 3, label: 'High', level: 3, clinicianText: 'For the clinician.', clientText: 'For the client.' },
    ],
  },
  rules: [],
  source: 'Citation and licence',
};

/**
 * The assessment library. Each instrument is a definition: questions, answer
 * scale, score bands, subscales and rules, with separate clinician and client
 * wording. Saving a change creates a new version; past results keep the
 * version they were scored with.
 */
export function AdminAssessmentsPage() {
  const toast = useToast();
  const { data: instruments, mutate } = useSWR<StoredInstrument[]>('/v1/admin/assessment-instruments');
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);

  const current = instruments?.find((i) => i.key === selected) ?? null;

  useEffect(() => {
    if (selected === 'new') setText(JSON.stringify(TEMPLATE, null, 2));
    else if (current) setText(JSON.stringify(current.definition, null, 2));
    setPreview(null);
    setAnswers({});
  }, [selected, current]);

  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(text) as StoredInstrument['definition'], error: null };
    } catch (err) {
      return { value: null, error: (err as Error).message };
    }
  }, [text]);

  async function check() {
    if (!parsed.value) return;
    const result = await api.post<Preview>('/v1/admin/assessment-instruments/preview', { definition: parsed.value, answers });
    setPreview(result);
  }

  async function save() {
    if (!parsed.value) return;
    setSaving(true);
    try {
      if (selected === 'new') {
        await api.post('/v1/admin/assessment-instruments', { definition: parsed.value });
        toast.success('Saved as a draft. Publish it when it is ready.');
        setSelected(parsed.value.key);
      } else {
        await api.patch(`/v1/admin/assessment-instruments/${selected}`, { definition: parsed.value });
        toast.success('Saved as a new version');
      }
      await mutate();
    } catch (err) {
      // The check lists each problem; the error message only says there are some.
      await check().catch(() => undefined);
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: StoredInstrument['status']) {
    try {
      await api.patch(`/v1/admin/assessment-instruments/${selected}`, { status });
      await mutate();
      toast.success(status === 'PUBLISHED' ? 'Published: practices can now use it' : status === 'RETIRED' ? 'Retired' : 'Moved back to draft');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the status');
    }
  }

  const def = parsed.value;
  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1400px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#0F172A]">Assessment library</h1>
          <p className="mt-1 text-[13.5px] text-[#64748B]">
            Every instrument is a definition: questions, scale, bands, subscales and rules, with separate clinician and client wording.
          </p>
        </div>
        <button type="button" onClick={() => setSelected('new')} className="h-10 px-4 rounded-[12px] bg-[#0F172A] text-white text-xs font-bold cursor-pointer">
          New instrument
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-3 space-y-2">
          {(instruments ?? []).map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => setSelected(i.key)}
              className={`w-full text-left rounded-[14px] border px-3 py-2.5 cursor-pointer ${selected === i.key ? 'border-[#0F172A] bg-white' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-bold text-[#0F172A]">{i.definition.shortName}</span>
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${STATUS_STYLE[i.status]}`}>{i.status.toLowerCase()}</span>
              </div>
              <p className="text-[11.5px] text-[#64748B]">v{i.version} · {i.definition.tier} · updated {formatDate(i.updatedAt)}</p>
            </button>
          ))}
        </div>

        {selected ? (
          <>
            <Card padding="p-[16px]" className="lg:col-span-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[13px] font-bold text-[#0F172A]">{selected === 'new' ? 'New instrument' : `${selected} · v${current?.version ?? ''}`}</span>
                {parsed.error ? <span className="text-[11px] font-semibold text-rose-600">JSON: {parsed.error}</span> : null}
              </div>
              <textarea
                aria-label="Definition"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                className="w-full h-[560px] font-mono text-[12px] leading-[1.5] p-3 rounded-[12px] bg-[#0F172A] text-[#E2E8F0] outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void check()} disabled={!def} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold cursor-pointer disabled:opacity-50">
                  Check and test
                </button>
                <button type="button" onClick={() => void save()} disabled={!def || saving} className="h-9 px-3 rounded-[10px] bg-[#0F172A] text-white text-xs font-bold cursor-pointer disabled:opacity-50">
                  {saving ? 'Saving…' : selected === 'new' ? 'Save draft' : 'Save new version'}
                </button>
                {current && current.status !== 'PUBLISHED' ? (
                  <button type="button" onClick={() => void setStatus('PUBLISHED')} className="h-9 px-3 rounded-[10px] bg-emerald-600 text-white text-xs font-bold cursor-pointer">Publish</button>
                ) : null}
                {current && current.status === 'PUBLISHED' ? (
                  <button type="button" onClick={() => void setStatus('RETIRED')} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-rose-700 cursor-pointer">Retire</button>
                ) : null}
              </div>
              {current?.status === 'PUBLISHED' ? (
                <p className="mt-2 text-[11.5px] text-[#64748B]">Changes apply to new results immediately. Past results keep the version they were scored with.</p>
              ) : null}
            </Card>

            <Card padding="p-[16px]" className="lg:col-span-4">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Test answers</h2>
              {def?.items && def?.scale ? (
                <div className="mt-2 max-h-[300px] overflow-auto space-y-2 pr-1">
                  {def.items.map((item) => (
                    <label key={item.id} className="block text-[12px] text-[#334155]">
                      <span className="block truncate">{item.id}: {item.text}</span>
                      <select
                        value={answers[item.id] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: Number(e.target.value) }))}
                        className="mt-0.5 w-full h-8 px-2 rounded-[8px] border border-[#E2E8F0] text-[12px]"
                      >
                        <option value="" disabled>Choose…</option>
                        {def.scale.map((s) => <option key={s.value} value={s.value}>{s.value}: {s.label}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#64748B]">Fix the JSON to test it.</p>
              )}
              {preview ? (
                <div className="mt-3 border-t border-[#E2E8F0] pt-3">
                  {preview.errors.length ? (
                    <ul className="space-y-1 text-[12px] font-semibold text-rose-700">
                      {preview.errors.map((e) => <li key={e}>• {e}</li>)}
                    </ul>
                  ) : preview.answersError ? (
                    <p className="text-[12px] text-[#475569]">The definition is valid. {preview.answersError} to see a result.</p>
                  ) : (
                    <>
                      <p className="text-[12px] font-bold text-emerald-700">The definition is valid.</p>
                      <pre className="mt-2 max-h-[260px] overflow-auto text-[11px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-2">{JSON.stringify(preview.result, null, 2)}</pre>
                    </>
                  )}
                </div>
              ) : null}
            </Card>
          </>
        ) : (
          <Card padding="p-[22px]" className="lg:col-span-9">
            <p className="text-sm text-[#64748B]">Choose an instrument to view or edit, or add a new one.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
