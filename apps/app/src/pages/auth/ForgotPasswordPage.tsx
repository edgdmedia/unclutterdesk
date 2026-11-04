import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Mail } from 'lucide-react';
import { AuthCardShell } from '../../components/AuthCardShell';
import { AuthField, authInputCls } from '../../components/AuthField';
import { api } from '../../utils/apiClient';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSending(true);
    try {
      const result = await api.post<{ email_sent?: boolean | null; message?: string }>('/v1/auth/forgot-password', { email });
      if (result.email_sent === false) {
        setError(result.message || 'We could not send a reset email right now. Please try again.');
        return;
      }
      setInfo(result.message || 'Check your inbox for instructions. The link is good for one hour.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthCardShell
      variant="forgot"
      accent="gold"
      footer={
        <Link to="/auth/login" className="text-[13.5px] font-semibold text-[var(--desk-text-muted)] hover:text-[var(--desk-pine-600)]">
          ← Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="mt-[26px] p-[26px] rounded-[20px] bg-[var(--desk-active-bg)] border border-[var(--desk-active-border)] text-center">
          <div className="w-14 h-14 mx-auto rounded-[18px] bg-[var(--desk-active-bg)] text-[var(--desk-active)] flex items-center justify-center">
            <Check className="h-[26px] w-[26px]" strokeWidth={2.6} />
          </div>
          <div className="mt-4 text-[19px] font-bold tracking-[-0.02em] text-[var(--desk-text)]">
            Reset email sent
          </div>
          <p className="mt-2 text-sm text-[var(--desk-active)] leading-[1.6]">
            {info || 'Check your inbox for instructions. The link is good for one hour.'}
          </p>
          <button
            onClick={() => { setSent(false); setError(''); setInfo(''); }}
            className="mt-[18px] h-11 px-[18px] border border-[var(--desk-active-border)] rounded-[13px] bg-white text-[var(--desk-active)] text-[13.5px] font-bold cursor-pointer transition-colors hover:bg-[var(--desk-active-bg)]"
          >
            Send it again
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mt-[26px] text-[25px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">
            Reset your password
          </div>
          <p className="mt-2 text-sm text-[var(--desk-text-muted)] leading-[1.6]">
            Enter your email and we'll send you a password reset link.
          </p>

          <div className="mt-6">
            <AuthField
              label="Email address"
              icon={<Mail className="h-[17px] w-[17px] text-[var(--desk-text-subtle)] flex-none" strokeWidth={2} />}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourpractice.ng"
                className={authInputCls}
              />
            </AuthField>
          </div>

          {error && (
            <div className="mt-[18px] p-4 rounded-[14px] bg-[var(--desk-danger-bg)] border border-[var(--desk-danger-border)] text-[13.5px] font-semibold text-[var(--desk-danger)] leading-[1.5]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-[22px] w-full h-[54px] rounded-[14px] bg-[var(--desk-pine-600)] text-white text-[15px] font-bold cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.4} />
                Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      )}
    </AuthCardShell>
  );
}
