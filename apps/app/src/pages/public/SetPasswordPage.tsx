import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../utils/apiClient';

const field = 'w-full h-[44px] px-3 rounded-[12px] bg-white border border-[#CBD5E1] text-[14px] outline-none';

export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/v1/auth/client-set-password', { token, password, firstName: firstName || undefined, lastName: lastName || undefined });
      window.location.href = '/portal';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That link did not work');
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <p className="text-[13px] font-medium text-rose-700">That link is not valid. Ask your practice to send it again.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-[420px] rounded-[20px] bg-white p-6 shadow-sm border border-[#E2E8F0] space-y-4">
        <h1 className="text-[18px] font-bold text-[#0F172A]">Set your password</h1>
        <p className="text-[13px] text-[#334155]">Your practice added you as a client. A password gives you your portal: sessions, forms and the join link.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">First name
            <input className={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">Last name
            <input className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
        </div>
        <label className="block text-[11.5px] font-bold text-slate-500 uppercase">Password
          <input className={field} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <p className="text-[12.5px] font-medium text-rose-700">{error}</p> : null}
        <button type="submit" disabled={busy} className="w-full h-[44px] rounded-[12px] bg-[#0F3A53] text-white text-[14px] font-bold cursor-pointer disabled:opacity-50">
          {busy ? 'Setting…' : 'Set password'}
        </button>
      </form>
    </main>
  );
}
