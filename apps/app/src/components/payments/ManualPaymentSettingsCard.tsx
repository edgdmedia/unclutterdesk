import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

interface Settings {
  enabled: boolean;
  details: { bankName: string; accountName: string; accountNumber: string; instructions?: string | null } | null;
  onPlan: boolean;
  holdHours: number;
}

const inputCls = 'w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] outline-none';

/** Let clients pay by bank transfer straight to the practice. Pro and Clinic only; off by default. */
export function ManualPaymentSettingsCard({ color }: { color: string }) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ bankName: '', accountName: '', accountNumber: '', instructions: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Settings>('/v1/consult/manual-payments/settings')
      .then((s) => {
        setSettings(s);
        setForm({
          bankName: s.details?.bankName ?? '',
          accountName: s.details?.accountName ?? '',
          accountNumber: s.details?.accountNumber ?? '',
          instructions: s.details?.instructions ?? '',
        });
      })
      .catch(() => setSettings(null));
  }, []);

  async function save(enabled: boolean, e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    try {
      const next = await api.patch<Settings>('/v1/consult/manual-payments/settings', { enabled, details: form });
      setSettings(next);
      toast.success(enabled ? 'Clients can now choose bank transfer' : next.enabled ? 'Bank details saved' : 'Bank transfer is off');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return null;
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Card padding="p-[24px_26px]" className="max-w-[560px] space-y-4 bg-white border border-slate-100">
      <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <div>
          <Eyebrow>OPTIONAL</Eyebrow>
          <h3 className="text-[16px] font-bold text-[#0F172A] flex items-center gap-2"><Landmark className="h-4 w-4" /> Bank transfer payments</h3>
          <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
            Let clients pay straight into your account. Their time is held for up to {settings.holdHours} hours; you, an admin or
            a receptionist mark it paid when the money arrives, and the client is emailed. Unpaid holds are released automatically.
          </p>
        </div>
        <span className={`h-6 px-3 rounded-full font-bold text-xs border flex items-center shrink-0 ${settings.enabled ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'}`}>
          {settings.enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {!settings.onPlan ? (
        <p className="text-sm text-[#475569]">
          Available on the Pro and Clinic plans. <Link to="/dashboard/settings/subscription" className="font-bold underline" style={{ color }}>See plans</Link>
        </p>
      ) : (
        <form onSubmit={(e) => void save(settings.enabled, e)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1"><span className="text-xs font-bold text-[#475569]">Bank</span><input className={inputCls} value={form.bankName} onChange={set('bankName')} placeholder="e.g. GTBank" /></label>
            <label className="space-y-1"><span className="text-xs font-bold text-[#475569]">Account number</span><input className={`${inputCls} font-mono`} value={form.accountNumber} onChange={set('accountNumber')} inputMode="numeric" maxLength={10} placeholder="10 digits" /></label>
          </div>
          <label className="block space-y-1"><span className="text-xs font-bold text-[#475569]">Account name</span><input className={inputCls} value={form.accountName} onChange={set('accountName')} /></label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-[#475569]">Note for clients (optional)</span>
            <textarea className={`${inputCls} h-auto min-h-[70px] py-2.5 font-medium`} value={form.instructions} onChange={set('instructions')} placeholder="e.g. Send your receipt to hello@yourpractice.ng" />
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {settings.enabled ? (
              <>
                <button type="submit" disabled={saving} className="h-10 px-4 rounded-[12px] text-white text-xs font-bold cursor-pointer disabled:opacity-60" style={{ backgroundColor: color }}>Save details</button>
                <button type="button" disabled={saving} onClick={() => void save(false)} className="h-10 px-4 rounded-[12px] bg-[#F1F5F9] text-[#475569] text-xs font-bold cursor-pointer">Turn off</button>
              </>
            ) : (
              <button type="button" disabled={saving} onClick={() => void save(true)} className="h-10 px-4 rounded-[12px] text-white text-xs font-bold cursor-pointer disabled:opacity-60" style={{ backgroundColor: color }}>
                Turn on bank transfers
              </button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
