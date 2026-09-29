import { useState } from 'react';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';

const field = 'w-full h-[42px] px-3 rounded-[12px] bg-white border border-[#CBD5E1] text-[13px] outline-none';

/**
 * The gate at checkout: a client signs in or creates an account at this
 * practice before the booking goes through, so the portal, the reminders and
 * the recap all have someone to reach.
 */
export function ClientAuthPanel({ onDone }: { onDone: () => void }) {
  const { login } = useAuth();
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        await api.post('/v1/auth/client-signup', { firstName, lastName, email, password });
      }
      // Sign in through the shared context either way, so the app knows who is
      // booking without a reload.
      await login(email, password);
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That did not work';
      setError(message);
      if (/already have an account/i.test(message)) setMode('signin');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="h-[40px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex gap-1 border border-[#E2E8F0]">
        {(['create', 'signin'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => { setMode(m); setError(null); }}
            className={`px-4 rounded-[10px] text-xs font-bold cursor-pointer ${mode === m ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}
          >
            {m === 'create' ? 'Create account' : 'Sign in'}
          </button>
        ))}
      </div>
      {mode === 'create' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">First name
            <input className={field} required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">Last name
            <input className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
        </div>
      ) : null}
      <label className="block text-[11.5px] font-bold text-slate-500 uppercase">Email
        <input className={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-[11.5px] font-bold text-slate-500 uppercase">Password
        <input className={field} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full h-[44px] rounded-[12px] bg-[#0F3A53] text-white text-[13.5px] font-bold cursor-pointer disabled:opacity-50"
      >
        {busy ? 'One moment…' : mode === 'create' ? 'Create account and continue' : 'Sign in and continue'}
      </button>
      {mode === 'signin' ? (
        <p className="text-[11.5px] text-[#64748B]">
          Forgotten it? <a href="/forgot-password" className="font-bold underline">Reset your password</a>
        </p>
      ) : null}
    </form>
  );
}
