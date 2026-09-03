import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { Eyebrow, Card } from '@unclutterdesk/ui';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';

type PayoutAccount = { bankCode: string; bankName: string; accountNumber: string; accountName: string; isVerified: boolean } | null;
type BillingSummary = { bankSubaccount: PayoutAccount; history: Array<{ date: string; title: string; detail: string; type: string }> };

export function PayoutSettingsPage() {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const [account, setAccount] = useState<PayoutAccount>(null);
  const [history, setHistory] = useState<BillingSummary['history']>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [tempBankName, setTempBankName] = useState('Guaranty Trust Bank');
  const [tempBankCode, setTempBankCode] = useState('058');
  const [tempAccountNumber, setTempAccountNumber] = useState('');
  const [tempAccountName, setTempAccountName] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadAccount() {
      setLoading(true);
      try {
        const data = await api.get<BillingSummary>('/v1/billing/summary');
        if (cancelled) return;
        setAccount(data.bankSubaccount);
        setHistory(data.history.filter((item) => item.type === 'payout' || item.type === 'system'));
        if (data.bankSubaccount) {
          setTempBankName(data.bankSubaccount.bankName);
          setTempBankCode(data.bankSubaccount.bankCode);
          setTempAccountNumber(data.bankSubaccount.accountNumber);
          setTempAccountName(data.bankSubaccount.accountName);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load payout account');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAccount();
    return () => { cancelled = true; };
  }, []);

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post<Exclude<PayoutAccount, null>>('/v1/billing/bank-subaccount', {
        bankCode: tempBankCode,
        bankName: tempBankName,
        accountNumber: tempAccountNumber,
        accountName: tempAccountName,
      });
      const refreshed = await api.get<BillingSummary>('/v1/billing/summary');
      setAccount(refreshed.bankSubaccount);
      setHistory(refreshed.history.filter((item) => item.type === 'payout' || item.type === 'system'));
      setShowBankModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save payout account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Payouts</h1>
          <p className="text-xs text-[#64748B] font-medium">Manage the verified bank account where practice payouts land</p>
        </div>
        {account?.isVerified ? <span className="h-7 px-3 rounded-full bg-[#ECFDF5] text-[#059669] text-xs font-bold border border-[#A7F3D0] flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /><span>Payouts active</span></span> : null}
      </header>

      <main className="p-[24px_26px_30px] space-y-6 flex-1">
        {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
        {loading ? <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading payout account...</div> : (
          <Card padding="p-[24px_26px]" className="max-w-[560px] space-y-4 bg-white border border-slate-100">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div><Eyebrow>PAYOUT ACCOUNT</Eyebrow><h3 className="text-[16px] font-bold text-[#0F172A]">Paystack Bank Subaccount</h3></div>
              <span className={`h-6 px-3 rounded-full font-bold text-xs border flex items-center ${account?.isVerified ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'}`}>{account?.isVerified ? 'VERIFIED' : 'NOT SET'}</span>
            </div>

            <div className="p-5 rounded-[20px] bg-[#0F3A53] text-white space-y-3 shadow-md">
              <span className="text-[10px] font-black tracking-widest text-[#E3B341] uppercase">{account?.bankName || 'No bank connected yet'}</span>
              <div className="text-[22px] font-extrabold font-mono tracking-widest leading-none">{account ? `•••• •••• ${account.accountNumber.slice(-4)}` : '•••• •••• ----'}</div>
              <p className="text-xs text-slate-300 font-medium">{account?.accountName || 'Add a payout account to receive settlements.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setShowBankModal(true)} className="h-[40px] rounded-[14px] bg-[#F1F5F9] text-[#0F172A] font-bold text-xs hover:bg-[#E2E8F0] cursor-pointer">{account ? 'Change account' : 'Add account'}</button>
              <button className="os-brand-btn h-[40px] rounded-[14px] font-bold text-xs cursor-pointer text-white" style={{ backgroundColor: primaryColor }}>View settlements</button>
            </div>
          </Card>
        )}

        <Card padding="p-[24px_26px]" className="max-w-[560px] space-y-3 bg-white border border-slate-100">
          <div className="text-sm font-bold text-[#0F172A]">Payout history</div>
          {history.map((item) => (
            <div key={`${item.type}_${item.date}`} className="rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
              <div className="text-[12px] font-bold text-[#0F172A]">{item.title}</div>
              <div className="text-[11px] text-[#94A3B8] font-medium">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.date))}</div>
              <div className="mt-1 text-[12px] text-[#475569] font-medium">{item.detail}</div>
            </div>
          ))}
        </Card>
      </main>

      {showBankModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 z-50">
          <form onSubmit={handleSaveBankDetails} className="w-full max-w-[480px] bg-white rounded-[24px] p-6 shadow-2xl space-y-4 border border-slate-200 relative">
            <button type="button" onClick={() => setShowBankModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
            <h3 className="text-lg font-bold text-[#0F172A]">Update Payout Bank Account</h3>
            <div className="space-y-3">
              <div className="space-y-1"><label className="text-xs font-bold text-[#475569]">Bank Name</label><select value={tempBankName} onChange={(e) => { setTempBankName(e.target.value); setTempBankCode(e.target.value === 'Guaranty Trust Bank' ? '058' : e.target.value === 'Access Bank' ? '044' : e.target.value === 'Zenith Bank' ? '057' : '090267'); }} className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] outline-none"><option value="Guaranty Trust Bank">Guaranty Trust Bank (GTB)</option><option value="Access Bank">Access Bank</option><option value="Zenith Bank">Zenith Bank</option><option value="Kuda Bank">Kuda Bank</option></select></div>
              <div className="space-y-1"><label className="text-xs font-bold text-[#475569]">10-Digit NUBAN Account Number</label><input type="text" maxLength={10} required value={tempAccountNumber} onChange={(e) => setTempAccountNumber(e.target.value)} className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono font-bold text-[#0F172A] outline-none" /></div>
              <div className="space-y-1"><label className="text-xs font-bold text-[#475569]">Account Holder Name</label><input type="text" required value={tempAccountName} onChange={(e) => setTempAccountName(e.target.value)} className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] outline-none" /></div>
            </div>
            <div className="flex items-center gap-3 pt-2"><button type="button" onClick={() => setShowBankModal(false)} className="flex-1 h-11 rounded-[14px] bg-[#F1F5F9] text-[#475569] font-bold text-xs cursor-pointer">Cancel</button><button type="submit" disabled={saving} className="flex-1 h-11 rounded-[14px] font-bold text-xs cursor-pointer text-white disabled:opacity-60" style={{ backgroundColor: primaryColor }}>{saving ? 'Saving...' : 'Save Account'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
