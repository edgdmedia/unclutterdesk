import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Loader2, Lock } from 'lucide-react';
import { AuthCardShell } from '../../components/AuthCardShell';
import { AuthField, authInputCls } from '../../components/AuthField';
import { api } from '../../utils/apiClient';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase & lowercase letters', test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'A special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemo(() => {
    const len = password.length;
    if (len === 0) return { pct: 0, label: '', color: '' };
    if (len < 8) return { pct: 35, label: 'Weak', color: '#F59E0B' };
    if (len < 12) return { pct: 58, label: 'Medium', color: '#E3B341' };
    return { pct: 78, label: 'Strong', color: '#15803D' };
  }, [password]);

  const missingRules = useMemo(
    () => PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label),
    [password],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Please request a new link.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (missingRules.length > 0) {
      setError(`Password must include: ${missingRules.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/v1/auth/reset-password', { token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/auth/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCardShell
      variant="reset"
      accent="gold"
      footer={
        <Link to="/auth/login" className="text-[13.5px] font-semibold text-[#64748B] hover:text-[#0F3A53]">
          ← Back to log in
        </Link>
      }
    >
      {done ? (
        <div className="mt-[26px] p-[30px_26px] rounded-[20px] bg-[#F0FDF4] border border-[#BBF7D0] text-center">
          <div className="w-[60px] h-[60px] mx-auto rounded-[19px] bg-[#15803D] text-white flex items-center justify-center shadow-[0_10px_26px_rgba(21,128,61,0.3)]">
            <Check className="h-7 w-7" strokeWidth={2.8} />
          </div>
          <div className="mt-[18px] text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">
            Password updated
          </div>
          <p className="mt-2 text-sm text-[#166534] leading-[1.6]">Redirecting you to log in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mt-[26px] text-[25px] font-bold tracking-[-0.03em] text-[#0F172A]">
            Set new password
          </div>
          <p className="mt-2 text-sm text-[#64748B] leading-[1.6]">
            Create a strong password for your practice account.
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <AuthField
              label="New password"
              icon={<Lock className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
            >
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={authInputCls}
              />
            </AuthField>

            <AuthField
              label="Confirm new password"
              icon={<Lock className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
            >
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className={authInputCls}
              />
            </AuthField>
          </div>

          <div className="mt-[14px] flex items-center gap-2">
            <div className="flex-1 h-[5px] rounded-[99px] bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-[99px] transition-all"
                style={{ width: `${strength.pct}%`, background: strength.color }}
              />
            </div>
            {strength.label && (
              <span className="text-[11.5px] font-bold whitespace-nowrap" style={{ color: strength.color }}>
                {strength.label}
              </span>
            )}
          </div>

          {error && (
            <div className="mt-[18px] p-4 rounded-[14px] bg-[#FEF2F2] border border-[#FECACA] text-[13.5px] font-semibold text-[#B91C1C] leading-[1.5]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-[22px] w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.4} />
                Updating…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      )}
    </AuthCardShell>
  );
}
