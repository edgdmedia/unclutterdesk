import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { AuthCardShell } from '../../components/AuthCardShell';
import { AuthField, authInputCls } from '../../components/AuthField';

const RESEND_COOLDOWN_SEC = 30;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state as { email?: string; emailSent?: boolean } | null) || null;
  const emailFromState = state?.email;
  const emailFromQuery = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromState || emailFromQuery || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    state?.emailSent === false
      ? 'We could not deliver your verification code yet. Use the resend button below after confirming your email address.'
      : null,
  );
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SEC);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((sec) => {
        if (sec <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError('Enter the email address you registered with.');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setVerifying(true);
    try {
      await api.post('/v1/auth/verify-email', { email: normalized, code: code.trim() });
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify your email. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError('Enter the email address you registered with first.');
      return;
    }
    setResending(true);
    try {
      const result = await api.post<{ email_sent?: boolean }>('/v1/auth/resend-verification', { email: normalized });
      if (result.email_sent === false) {
        setInfo('We still could not deliver the verification code. Check the server mail configuration and try again.');
      } else {
        setInfo('A fresh verification code has been sent.');
      }
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <AuthCardShell
        variant="verify"
        accent="green"
        center
        footer={
          <>
            Not you?{' '}
            <Link to="/login" className="font-bold text-[#0F172A] hover:underline">
              Sign in
            </Link>{' '}
            instead
          </>
        }
      >
        <div className="w-16 h-16 mx-auto mt-[28px] rounded-[20px] bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
          <MailCheck className="h-[30px] w-[30px]" strokeWidth={2} />
        </div>
        <div className="mt-5 text-[25px] font-bold tracking-[-0.03em] text-[#0F172A]">
          Email verified
        </div>
        <p className="mt-[10px] text-[14.5px] text-[#64748B] leading-[1.65] text-center">
          Your email has been confirmed and your account is now active. You can sign in and get
          started.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login', { state: { email } })}
          className="mt-[22px] w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold inline-flex items-center justify-center gap-[10px] cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110"
        >
          <span>Continue to sign in</span>
          <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
        </button>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      variant="verify"
      accent="green"
      footer={
        <span className="text-[13px] text-[#64748B]">
          Already verified?{' '}
          <Link to="/login" state={{ email }} className="font-bold text-[#0F172A] hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <div className="w-14 h-14 mt-[24px] rounded-[18px] bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
        <ShieldCheck className="h-[26px] w-[26px]" strokeWidth={2} />
      </div>

      <div className="mt-4 text-[25px] font-bold tracking-[-0.03em] text-[#0F172A]">
        Verify your email
      </div>
      <p className="mt-[8px] text-[14.5px] text-[#64748B] leading-[1.65]">
        We sent a 6-digit code to your inbox. Enter it below to activate your account.
      </p>

        <form onSubmit={handleVerify} className="mt-[22px] flex flex-col gap-4">
        <AuthField
          label="Email"
          icon={<Mail className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputCls}
            placeholder="you@example.com"
          />
        </AuthField>

        <AuthField label="6-digit code">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${authInputCls} font-mono tracking-[0.35em] text-[17px]`}
            placeholder="000000"
          />
        </AuthField>

        {info ? <p className="text-xs font-medium text-amber-700 bg-amber-50 rounded-[12px] px-3.5 py-2.5">{info}</p> : null}
        {error ? <p className="text-xs font-medium text-red-500 bg-red-50 rounded-[12px] px-3.5 py-2.5">{error}</p> : null}

        <button
          type="submit"
          disabled={verifying}
          className="w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold inline-flex items-center justify-center gap-[10px] cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-70"
        >
          {verifying ? (
            <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={2.4} />
          ) : (
            <>
              <span>Verify email</span>
              <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className="text-[13px] font-semibold text-[#0F3A53] hover:underline disabled:text-[#94A3B8] disabled:hover:no-underline cursor-pointer disabled:cursor-default"
        >
          {resending
            ? 'Resending…'
            : resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : 'Didn’t receive it? Resend the code'}
        </button>
      </form>
    </AuthCardShell>
  );
}
