import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GripVertical, Trash2, Plus } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';

type Question = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

type FormRecord = {
  id: string;
  title: string;
  slug?: string | null;
  systemKey?: string | null;
  description: string | null;
  targetType: string;
  schemaJson: Question[];
  isDefault: boolean;
  isActive: boolean;
  reviewPublicationMode: string;
  reviewerDisplayMode: string;
};

const COMPONENT_TYPES = [
  { label: 'Short text', type: 'text' },
  { label: 'Long text area', type: 'textarea' },
  { label: 'Single choice', type: 'single_choice' },
  { label: 'Multiple choice', type: 'multiple_choice' },
  { label: 'Likert scale 1-5', type: 'scale' },
  { label: 'Digital signature', type: 'signature' },
  { label: 'File upload', type: 'file_upload' },
];

function createQuestion(type: string, label: string): Question {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    type,
    required: false,
    options: type === 'single_choice' || type === 'multiple_choice' || type === 'scale' ? ['Option 1', 'Option 2'] : undefined,
  };
}

export function FormEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('Untitled form');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('INTAKE');
  const [reviewPublicationMode, setReviewPublicationMode] = useState('MANUAL');
  const [reviewerDisplayMode, setReviewerDisplayMode] = useState('FIRST_NAME');
  const [systemKey, setSystemKey] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([
    createQuestion('textarea', 'What would you like us to know before your session?'),
  ]);

  useEffect(() => {
    if (isNew || !id) return;
    let cancelled = false;

    async function loadForm() {
      setLoading(true);
      setError(null);
      try {
        const form = await api.get<FormRecord>(`/v1/intake/forms/${id}`);
        if (cancelled) return;
        setFormTitle(form.title);
        setDescription(form.description || '');
        setCategory(form.targetType);
        setSystemKey(form.systemKey || null);
        setReviewPublicationMode(form.reviewPublicationMode || 'MANUAL');
        setReviewerDisplayMode(form.reviewerDisplayMode || 'FIRST_NAME');
        setQuestions(
          Array.isArray(form.schemaJson) && form.schemaJson.length > 0
            ? form.schemaJson.map((question) => ({
                id: question.id,
                label: question.label,
                type: question.type,
                required: Boolean(question.required),
                options: question.options,
              }))
            : [createQuestion('textarea', 'What would you like us to know before your session?')],
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForm();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const isSystemTemplate = Boolean(systemKey);

  function addQuestion(type: string, label: string) {
    if (isSystemTemplate) return;
    setQuestions((current) => [...current, createQuestion(type, label)]);
  }

  function updateQuestion(questionId: string, patch: Partial<Question>) {
    if (isSystemTemplate) return;
    setQuestions((current) => current.map((question) => (question.id === questionId ? { ...question, ...patch } : question)));
  }

  function deleteQuestion(questionId: string) {
    if (isSystemTemplate) return;
    setQuestions((current) => current.filter((question) => question.id !== questionId));
  }

  function addOption(questionId: string) {
    if (isSystemTemplate) return;
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? { ...question, options: [...(question.options || []), `Option ${(question.options || []).length + 1}`] }
          : question,
      ),
    );
  }

  function updateOption(questionId: string, optionIndex: number, value: string) {
    if (isSystemTemplate) return;
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId || !question.options) return question;
        return {
          ...question,
          options: question.options.map((option, index) => (index === optionIndex ? value : option)),
        };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = {
      title: isSystemTemplate ? formTitle : formTitle.trim(),
      description: isSystemTemplate ? description : description.trim() || undefined,
      targetType: category,
      schemaJson: questions,
      reviewPublicationMode,
      reviewerDisplayMode,
    };

    try {
      if (isNew) {
        await api.post('/v1/intake/forms', payload);
      } else {
        await api.patch(`/v1/intake/forms/${id}`, payload);
      }
      navigate('/dashboard/settings/forms');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save form');
    } finally {
      setSaving(false);
    }
  }

  const primaryColor = '#0F3A53';

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A] font-outfit flex flex-col justify-between">
      <header className="h-[78px] bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/settings/forms" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#0F172A]">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to forms</span>
          </Link>
          <div className="h-5 w-[1px] bg-[#E2E8F0]" />
          <input
            type="text"
            value={formTitle}
            onChange={(event) => setFormTitle(event.target.value)}
            disabled={isSystemTemplate}
            className="w-[300px] text-[16px] font-bold text-[#0F172A] bg-transparent outline-none border-b border-transparent focus:border-[#0F3A53]"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={isSystemTemplate}
            className="h-7 px-3 rounded-full bg-[#F1F5F9] text-[10px] font-black tracking-wider uppercase border border-[#E2E8F0]"
          >
            <option value="INTAKE">INTAKE</option>
            <option value="ASSESSMENT">ASSESSMENT</option>
            <option value="FEEDBACK">FEEDBACK</option>
            <option value="CONSENT">CONSENT</option>
            <option value="REVIEW">REVIEW</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-[#B45309] font-bold">
            <span className="h-2 w-2 rounded-full bg-[#E3B341]" />
            <span>{saving ? 'Saving...' : `${isSystemTemplate ? 'System template' : isNew ? 'New' : 'Live'} · ${questions.length} questions`}</span>
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !formTitle.trim()}
            className="os-brand-btn h-[40px] px-5 rounded-[14px] font-bold text-xs cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? 'Saving form...' : isSystemTemplate ? 'Save activation state' : 'Save form template'}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[250px_1fr_392px] items-stretch min-h-[680px]">
        <div className="bg-white border-r border-[#E2E8F0] p-5 space-y-4">
          <div>
            <Eyebrow className="mb-1">COMPONENTS</Eyebrow>
            <p className="text-[11.5px] text-[#64748B] font-medium">{isSystemTemplate ? 'System assessment templates are locked to preserve scoring accuracy.' : 'Click a block to add to canvas.'}</p>
          </div>

          <div className={`space-y-2 ${isSystemTemplate ? 'opacity-50 pointer-events-none' : ''}`}>
            {COMPONENT_TYPES.map((component) => (
              <button
                type="button"
                key={component.label}
                onClick={() => addQuestion(component.type, `New ${component.label}`)}
                className="w-full p-3 rounded-[15px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] flex items-center gap-2.5 cursor-pointer hover:bg-[#F1F5F9] hover:border-[#0F3A53]"
              >
                <GripVertical className="h-4 w-4 text-[#CBD5E1]" />
                <span>{component.label}</span>
              </button>
            ))}
          </div>

          {category === 'REVIEW' ? (
            <div className="rounded-[18px] border border-[#E2E8F0] bg-[#FCF7EF] p-4 space-y-3">
              <div>
                <Eyebrow>REVIEW SETTINGS</Eyebrow>
                <p className="mt-1 text-[11.5px] font-medium text-[#64748B]">Per-form publishing controls for practice testimonials.</p>
              </div>

              <label className="block space-y-1.5 text-xs font-bold text-[#0F172A]">
                <span>Publication mode</span>
                <select
                  value={reviewPublicationMode}
                  onChange={(event) => setReviewPublicationMode(event.target.value)}
                  className="w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="MANUAL">Require approval</option>
                  <option value="AUTO">Auto-publish</option>
                </select>
              </label>

              <label className="block space-y-1.5 text-xs font-bold text-[#0F172A]">
                <span>Reviewer identity</span>
                <select
                  value={reviewerDisplayMode}
                  onChange={(event) => setReviewerDisplayMode(event.target.value)}
                  className="w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="FIRST_NAME">Show first name + last initial</option>
                  <option value="ANONYMOUS">Show anonymous</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {error ? (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white px-4 py-8 text-sm font-medium text-[#64748B]">
              Loading form editor...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-[17px] font-bold text-[#0F172A]">Questions</h2>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isSystemTemplate}
                  rows={2}
                  placeholder="Describe what this form is for..."
                  className="w-full rounded-[16px] border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-medium text-[#0F172A] outline-none"
                />
              </div>

              <div className="space-y-3">
                {questions.map((question, questionIndex) => (
                  <div
                    key={question.id}
                    className="p-5 rounded-[20px] bg-white border border-[#E2E8F0] shadow-xs space-y-4 relative"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-[#CBD5E1]" />
                        <span className="h-5 px-2 rounded-full bg-[#0F3A53]/10 text-[#0F3A53] text-[9px] font-black uppercase">
                          Q{questionIndex + 1} · {question.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-[#475569]">
                          <span>Required</span>
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
                            disabled={isSystemTemplate}
                            className="rounded text-[#0F3A53]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(question.id)}
                          disabled={isSystemTemplate}
                          className="h-7 w-7 rounded-full hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={question.label}
                      onChange={(event) => updateQuestion(question.id, { label: event.target.value })}
                      disabled={isSystemTemplate}
                      className="w-full text-sm font-bold text-[#0F172A] p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] outline-none"
                    />

                    {question.options ? (
                      <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
                        {question.options.map((option, optionIndex) => (
                          <div key={`${question.id}_${optionIndex}`} className="flex items-center gap-2 text-xs">
                            <span className="h-6 w-6 rounded-[6px] bg-[#EEF2F7] font-bold text-[#0F172A] flex items-center justify-center shrink-0">
                              {optionIndex + 1}
                            </span>
                            <input
                              type="text"
                              value={option}
                              onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                              disabled={isSystemTemplate}
                              className="flex-1 p-2 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] font-medium text-[#0F172A]"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(question.id)}
                          disabled={isSystemTemplate}
                          className="text-xs font-bold text-[#0F3A53] hover:underline inline-flex items-center gap-1 pt-1 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Option</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white border-l border-[#E2E8F0] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <Eyebrow>LIVE PREVIEW</Eyebrow>
              <h3 className="text-sm font-bold text-[#0F172A]">What the client sees</h3>
            </div>
            <span className="h-5 px-2 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-200">
              {category}
            </span>
          </div>

          <div className="p-5 rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
            <div className="p-4 rounded-[16px] text-white space-y-1" style={{ backgroundColor: primaryColor }}>
              <span className="text-[9px] font-black tracking-widest text-[#E3B341] uppercase block">PREVIEW FORM</span>
              <h4 className="text-sm font-extrabold">{formTitle}</h4>
              {description ? <p className="text-[11px] text-white/80">{description}</p> : null}
            </div>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={question.id} className="p-3.5 bg-white rounded-[14px] border border-[#E2E8F0] space-y-2">
                  <p className="text-xs font-bold text-[#0F172A]">{index + 1}. {question.label}</p>
                  {question.options && question.options.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 text-[10.5px] font-bold text-center">
                      {question.options.map((option) => (
                        <button key={option} type="button" disabled title="Preview only" className="h-8 rounded-[8px] bg-[#F1F5F9] text-[#0F172A]">
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : question.type === 'textarea' ? (
                    <div className="h-20 rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC]" />
                  ) : (
                    <div className="h-10 rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
