import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Activity, ShieldCheck, MessageSquare, Edit2 } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';

type FormTemplate = {
  id: string;
  title: string;
  slug?: string | null;
  systemKey?: string | null;
  description: string | null;
  targetType: string;
  schemaJson: Array<{ id?: string; label?: string; type?: string }>;
  isDefault: boolean;
  isActive: boolean;
  reviewPublicationMode: string;
  reviewerDisplayMode: string;
};

type Category = 'all' | 'intake' | 'assessment' | 'feedback' | 'consent' | 'review';

const TYPE_META: Record<string, { icon: typeof FileText; sub: string; iconBg: string }> = {
  INTAKE: { icon: FileText, sub: 'DEFAULT', iconBg: 'bg-[#0F3A53]/10 text-[#0F3A53]' },
  ASSESSMENT: { icon: Activity, sub: 'SCORED', iconBg: 'bg-amber-100 text-amber-800' },
  FEEDBACK: { icon: MessageSquare, sub: '1-5 SCALE', iconBg: 'bg-emerald-100 text-emerald-800' },
  CONSENT: { icon: ShieldCheck, sub: 'SIGNATURE', iconBg: 'bg-purple-100 text-purple-800' },
  REVIEW: { icon: MessageSquare, sub: 'PUBLIC', iconBg: 'bg-rose-100 text-rose-700' },
};

export function FormsManagerPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const primaryColor = '#0F3A53';

  useEffect(() => {
    let cancelled = false;

    async function loadForms() {
      setLoading(true);
      setError(null);
      try {
        const forms = await api.get<FormTemplate[]>('/v1/intake/forms');
        if (!cancelled) setTemplates(forms);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load forms');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForms();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleFormActive(template: FormTemplate) {
    setTogglingId(template.id);
    try {
      const updated = await api.patch<FormTemplate>(`/v1/intake/forms/${template.id}`, {
        isActive: !template.isActive,
      });
      setTemplates((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update form');
    } finally {
      setTogglingId(null);
    }
  }

  const filteredTemplates = templates.filter((template) =>
    activeCategory === 'all' ? true : template.targetType.toLowerCase() === activeCategory,
  );

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Form & assessment templates</h1>
          <p className="text-xs text-[#64748B] font-medium">Real forms from your practice library. Review forms publish to your landing page.</p>
        </div>

        <Link
              to="/dashboard/settings/forms/new"
          className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-xs flex items-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="h-4 w-4" />
          <span>Create custom form</span>
        </Link>
      </header>

      <main className="p-[24px_26px_30px] space-y-6 flex-1">
        <div className="h-[38px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex gap-1 border border-[#E2E8F0]">
          {[
            { id: 'all', label: 'ALL' },
            { id: 'intake', label: 'INTAKE' },
            { id: 'assessment', label: 'ASSESSMENT' },
            { id: 'feedback', label: 'FEEDBACK' },
            { id: 'consent', label: 'CONSENT' },
            { id: 'review', label: 'REVIEW' },
          ].map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id as Category)}
              className={`px-4 rounded-[10px] text-[11px] font-black tracking-wider uppercase transition-all cursor-pointer ${
                activeCategory === category.id
                  ? 'bg-[#0F3A53] text-white shadow-md'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">
            Loading practice forms...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">
            No forms in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredTemplates.map((template) => {
              const meta = TYPE_META[template.targetType] || TYPE_META.INTAKE;
              const Icon = meta.icon;
              const questionCount = Array.isArray(template.schemaJson) ? template.schemaJson.length : 0;
              const isSystemTemplate = Boolean(template.systemKey);

              return (
                <div
                  key={template.id}
                  className={`p-[22px] rounded-[24px] bg-white border flex flex-col justify-between space-y-4 shadow-xs ${
                    isSystemTemplate ? 'border-2 border-[#E3B341] shadow-md' : template.isDefault ? 'border-2 border-[#E3B341] shadow-md' : 'border-[#E2E8F0]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`h-10 w-10 rounded-[12px] flex items-center justify-center font-bold ${meta.iconBg}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-5 px-2 rounded-full bg-[#F1F5F9] text-[#475569] text-[9px] font-black uppercase tracking-wider">
                          {template.targetType}
                        </span>
                        {isSystemTemplate ? (
                          <span className="h-5 px-2 rounded-full bg-[#FEF3C7] text-[#92400E] text-[9px] font-black uppercase tracking-wider border border-[#E3B341]/40">
                            System template
                          </span>
                        ) : null}
                        <span className="h-5 px-2 rounded-full bg-[#0F3A53]/10 text-[#0F3A53] text-[9px] font-black uppercase tracking-wider">
                          {isSystemTemplate ? template.systemKey?.replace(/_/g, '-') : template.targetType === 'REVIEW' ? template.reviewPublicationMode : meta.sub}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[15.5px] font-bold text-[#0F172A]">{template.title}</h3>
                      <p className="text-[13px] text-[#475569] leading-relaxed mt-1 font-medium">
                        {template.description || 'No description added yet.'}
                      </p>
                      {isSystemTemplate ? (
                        <p className="text-[11.5px] text-[#92400E] font-semibold mt-2">
                          Built-in scored assessment. Schema is locked to preserve scoring accuracy.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-[#0F172A] pt-2 border-t border-[#F1F5F9]">
                      <span>{questionCount} question{questionCount === 1 ? '' : 's'}</span>
                      <span>·</span>
                      <span>{template.isActive ? 'Live' : 'Paused'}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between gap-3">
                    <Link
                      to={`/dashboard/settings/forms/${template.id}`}
                      className="h-9 px-3 rounded-[12px] bg-[#F1F5F9] text-[#0F172A] text-xs font-bold hover:bg-slate-200 inline-flex items-center gap-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>{isSystemTemplate ? 'View template' : 'Edit schema'}</span>
                    </Link>

                    <button
                      type="button"
                      disabled={togglingId === template.id}
                      onClick={() => void toggleFormActive(template)}
                      className={`w-[40px] h-[22px] rounded-full p-[2px] cursor-pointer transition-colors disabled:opacity-60 ${
                        template.isActive ? 'bg-[#15803D]' : 'bg-[#E2E8F0]'
                      }`}
                    >
                      <div
                        className={`w-[18px] h-[18px] rounded-full bg-white shadow-xs transition-transform ${
                          template.isActive ? 'translate-x-[18px]' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}

            <Link
          to="/dashboard/settings/forms/new"
              className="p-[22px] rounded-[24px] border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] flex flex-col items-center justify-center text-center space-y-2 cursor-pointer min-h-[260px] transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-white text-[#0F3A53] font-bold flex items-center justify-center shadow-xs">
                <Plus className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-bold text-[#0F172A]">Create a custom form</h3>
              <p className="text-xs text-[#64748B] font-medium max-w-[200px]">
                Build intake questionnaires, scored assessments, consent flows, or public review forms.
              </p>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
