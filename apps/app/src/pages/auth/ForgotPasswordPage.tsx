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
        <Link to="/auth/login" className="text-[13.5px] font-semibold text-[#64748B] hover:text-[#0F3A53]">
          ← Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="mt-[26px] p-[26px] rounded-[20px] bg-[#F0FDF4] border border-[#BBF7D0] text-center">
          <div className="w-14 h-14 mx-auto rounded-[18px] bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
            <Check className="h-[26px] w-[26px]" strokeWidth={2.6} />
          </div>
          <div className="mt-4 text-[19px] font-bold tracking-[-0.02em] text-[#0F172A]">
            Reset email sent
          </div>
          <p className="mt-2 text-sm text-[#166534] leading-[1.6]">
            {info || 'Check your inbox for instructions. The link is good for one hour.'}
          </p>
          <button
            onClick={() => { setSent(false); setError(''); setInfo(''); }}
            className="mt-[18px] h-11 px-[18px] border border-[#BBF7D0] rounded-[13px] bg-white text-[#15803D] text-[13.5px] font-bold cursor-pointer transition-colors hover:bg-[#F0FDF4]"
          >
            Send it again
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mt-[26px] text-[25px] font-bold tracking-[-0.03em] text-[#0F172A]">
            Reset your password
          </div>
          <p className="mt-2 text-sm text-[#64748B] leading-[1.6]">
            Enter your email and we'll send you a password reset link.
          </p>

          <div className="mt-6">
            <AuthField
              label="Email address"
              icon={<Mail className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
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
            <div className="mt-[18px] p-4 rounded-[14px] bg-[#FEF2F2] border border-[#FECACA] text-[13.5px] font-semibold text-[#B91C1C] leading-[1.5]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-[22px] w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
