import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';

const field =
  'w-full h-12 px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14.5px] text-[#0F172A] outline-none transition-[background,border-color,box-shadow] duration-150 focus:bg-white focus:border-[#94A3B8] focus:shadow-[0_0_0_3px_var(--brand-ring)]';
const label = 'flex flex-col gap-1.5 text-[12.5px] font-semibold text-[#475569]';

/**
 * The gate at checkout: a client signs in or creates an account at this
 * practice before the booking goes through, so the portal, the reminders and
 * the recap all have someone to reach.
 */
export function ClientAuthPanel({ onDone, initialMode = 'create' }: { onDone: () => void; initialMode?: 'create' | 'signin' }) {
  const { login } = useAuth();
  const [mode, setMode] = useState<'create' | 'signin'>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        await api.post('/v1/auth/client-signup', { firstName, lastName, email, phone, password });
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="h-10 p-1 bg-[#F1F5F9] rounded-[14px] flex gap-0.5">
        {(['create', 'signin'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 rounded-[11px] text-[13px] font-bold cursor-pointer transition-colors duration-150 ${mode === m ? 'bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,.08)]' : 'text-[#64748B]'}`}
          >
            {m === 'create' ? 'Create account' : 'Sign in'}
          </button>
        ))}
      </div>
      <p className="flex gap-2 text-[13px] leading-[1.5] text-[#475569]">
        <ShieldCheck className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
        One Unclutter Desk account works with every practice. Each practice sees only its own records with you.
      </p>
      {mode === 'create' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>First name
            <input className={field} required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </label>
          <label className={label}>Last name
            <input className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </label>
        </div>
      ) : null}
      <label className={label}>Email
        <input className={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      {mode === 'create' ? (
        <label className={label}>Phone
          <input className={field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="e.g. 0803 123 4567" />
        </label>
      ) : null}
      <label className={label}>Password
        <input className={field} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} />
      </label>
      {error ? <p role="alert" className="text-[12.5px] font-medium text-[#E11D48]">{error}</p> : null}
      <Button type="submit" variant="primary" size="xl" fullWidth disabled={busy}>
        {busy ? 'One moment…' : mode === 'create' ? 'Create account and continue' : 'Sign in and continue'}
      </Button>
      {mode === 'signin' ? (
        <p className="text-[12.5px] text-[#64748B]">
          Forgotten it? <a href="/forgot-password" className="font-bold underline">Reset your password</a>
        </p>
      ) : null}
    </form>
  );
}
