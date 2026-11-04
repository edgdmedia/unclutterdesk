import { useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Asks for the password before moving a practice session to the platform
 * admin console. Going from one practice to every practice is a big step up,
 * so a practice session left open on a shared computer is not enough.
 */
export function AdminSwitchDialog({ onClose }: { onClose: () => void }) {
  const { switchToAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await switchToAdmin(password);
      // A full load, so nothing cached from the practice workspace carries over.
      window.location.assign('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--desk-sidebar)]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="admin-switch-title">
      <form onSubmit={submit} className="w-full max-w-[380px] rounded-[20px] bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--desk-pine-600)]" />
            <h2 id="admin-switch-title" className="text-[16px] font-bold text-[var(--desk-text)]">Open platform admin</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[12.5px] text-[var(--desk-text-body)] leading-relaxed">
          Enter your password to switch. This signs you out of your practice on this device; you can come back from the admin console.
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-[44px] px-3.5 rounded-[12px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-[13px] text-[var(--desk-text)] outline-none"
        />
        {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button type="submit" disabled={busy || !password} className="w-full h-[42px] rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Switch to admin
        </button>
      </form>
    </div>
  );
}
