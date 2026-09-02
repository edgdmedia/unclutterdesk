import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthSplitShell } from '../../components/AuthSplitShell';
import { AuthField, authInputCls } from '../../components/AuthField';
import { api } from '../../utils/apiClient';

function looksLikeVerificationPending(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('verify your email') ||
    normalized.includes('verification code') ||
    normalized.includes('request a new one from the verify email screen')
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuth();
  const locationState = (location.state as { email?: string; returnTo?: string } | null) || null;
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const profile = await login(email, password);

      if (profile.type === 'platform_admin') {
        navigate('/admin');
        return;
      }

      if (locationState?.returnTo) {
        navigate(locationState.returnTo);
        return;
      }

      if (profile.type !== 'user') {
        const hasSavedOnboarding = !!localStorage.getItem('unclutter_onboarding_v1');

        if (hasSavedOnboarding) {
          try {
            const summary = await api.get<{ onboardingCompleted?: boolean }>('/v1/consult/dashboard/summary');
            if (summary.onboardingCompleted === false) {
              navigate('/register/onboarding', { state: { resumeOnboarding: true } });
              return;
            }
          } catch {
            // If the summary fetch fails, fall through to the normal post-login route.
          }
        }

        navigate('/dashboard');
        return;
      }

      navigate('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    }
  };

  return (
    <AuthSplitShell
      variant="login"
      headline="Practice management for modern therapists"
      tagline="Log in to manage your bookings, clinical SOAP notes, telehealth rooms, and practice branding."
      footer="© 2026 unclutterOS Inc."
      stats={[
        { value: '1,240+', label: 'practices in Nigeria' },
        { value: '0%', label: 'platform fee on payouts' },
      ]}
    >
      <div className="text-[29px] font-bold tracking-[-0.03em] text-[#0F172A]">Welcome back</div>
      <p className="mt-[7px] text-[14.5px] text-[#64748B] leading-[1.6]">
        Enter your credentials to access your practice workspace.
      </p>

      <form onSubmit={handleLogin} className="mt-[30px]">
        <AuthField label="Email address" icon={<Mail className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourpractice.com"
            className={authInputCls}
          />
        </AuthField>

        <div className="mt-[18px]">
          <AuthField
            label="Password"
            icon={<Lock className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
            labelRow={
              <Link
                to="/forgot-password"
                className="ml-auto text-xs font-semibold text-[#64748B] hover:text-[#0F3A53]"
              >
                Forgot password?
              </Link>
            }
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex-none text-[#94A3B8] hover:text-[#475569] cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff className="h-[17px] w-[17px]" strokeWidth={2} />
                ) : (
                  <Eye className="h-[17px] w-[17px]" strokeWidth={2} />
                )}
              </button>
            }
          >
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className={authInputCls}
            />
          </AuthField>
        </div>

        <label className="mt-[18px] flex items-center gap-[9px] cursor-pointer select-none">
          <span
            className={`h-[19px] w-[19px] rounded-[6px] flex items-center justify-center transition-colors ${
              remember ? 'bg-[#0F3A53] text-white' : 'bg-white text-transparent border border-[#CBD5E1]'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="sr-only"
            />
          </span>
          <span className="text-[13px] text-[#475569]">Keep me signed in on this device</span>
        </label>

        {error && (
          <div className="mt-4 rounded-[12px] bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-500">
            <p>{error}</p>
            {looksLikeVerificationPending(error) ? (
              <div className="mt-2 flex gap-3 text-[#0F3A53]">
                <Link
                  to="/verify-email"
                  state={{ email }}
                  className="inline-flex hover:underline"
                >
                  Verify email
                </Link>
                <Link
                  to="/verify-email"
                  state={{ email }}
                  className="inline-flex hover:underline"
                >
                  Resend verification code
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-[26px] w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold inline-flex items-center justify-center gap-[10px] cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-[17px] w-[17px] animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in to practice</span>
              <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-[13.5px] text-[#64748B] text-center">
        Don't have a practice account yet?{' '}
        <Link to="/register" className="font-bold text-[#0F3A53] hover:underline">
          Create a practice
        </Link>
      </div>
    </AuthSplitShell>
  );
}
