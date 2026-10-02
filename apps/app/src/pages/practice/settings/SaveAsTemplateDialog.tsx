import React, { useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useFocusTrap, useToast } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

/** FRM-01: keep a copy of this form to reuse, and optionally share it. */
export function SaveAsTemplateDialog({ formId, onClose }: { formId: string; onClose: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  useFocusTrap(ref, true);
  const toast = useToast();
  const [share, setShare] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/v1/intake/forms/${formId}/template`, { share, anonymous: share && anonymous });
      toast.success(share ? "Saved. We'll review it before other practices can use it." : 'Saved to your templates.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the template');
      setBusy(false);
    }
  }

  const box = 'mt-0.5 h-4 w-4 accent-[#0F3A53] cursor-pointer';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="save-template-title">
      <form ref={ref} onSubmit={submit} className="w-full max-w-[420px] rounded-[20px] bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="save-template-title" className="text-[16px] font-bold text-[#0F172A]">Save as template</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[12.5px] text-[#475569] leading-relaxed">
          A template is a copy of this form's questions as they are now. Editing the form later doesn't change it.
        </p>
        <label className="flex items-start gap-2.5 text-[13px] text-[#0F172A] cursor-pointer">
          <input type="checkbox" className={box} checked={share} onChange={(e) => setShare(e.target.checked)} />
          <span>Share with other practices on Unclutter Desk (reviewed by our team first)</span>
        </label>
        {share ? (
          <label className="flex items-start gap-2.5 pl-6 text-[13px] text-[#0F172A] cursor-pointer">
            <input type="checkbox" className={box} checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <span>Share anonymously (other practices won't see your practice's name)</span>
          </label>
        ) : null}
        {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button type="submit" disabled={busy} className="w-full h-[42px] rounded-[12px] bg-[#0F3A53] text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save template
        </button>
      </form>
    </div>
  );
}
