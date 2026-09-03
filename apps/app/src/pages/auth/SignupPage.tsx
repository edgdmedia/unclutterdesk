import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Building, Check, Lock, Mail, Sparkles, User, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthSplitShell } from '../../components/AuthSplitShell';
import { AuthField, authInputCls } from '../../components/AuthField';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number (0–9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character (!@#$%…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading } = useAuth();
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan) {
      sessionStorage.setItem('onboarding_plan', plan);
    }
  }, [location]);

  const [persona, setPersona] = useState<'therapist' | 'practice'>('therapist');
  const [alsoTherapist, setAlsoTherapist] = useState(false);
  const [practiceName, setPracticeName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const passwordChecks = useMemo(() => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) })), [password]);
  const passwordValid = passwordChecks.every((c) => c.ok);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordValid) {
      setError('Your password does not meet all the requirements below.');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service to create a practice.');
      return;
    }
    setSubmitting(true);
    try {
      const nameParts = fullName.trim().split(/\s+/);
      const result = await register({
        firstName: nameParts[0] || fullName.trim(),
        lastName: nameParts.slice(1).join(' '),
        email,
        password,
        practiceName: practiceName.trim(),
        persona,
        alsoTherapist: persona === 'practice' ? alsoTherapist : undefined,
      });
      navigate('/verify-email', { state: { email, emailSent: result.email_sent } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your practice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const personaOptions: Array<{ value: 'therapist' | 'practice'; label: string; icon: React.ReactNode; desc: string }> = [
    {
      value: 'therapist',
      label: 'Solo therapist',
      icon: <Sparkles className="h-[17px] w-[17px]" strokeWidth={2} />,
      desc: 'Own white-label booking, calendar & notes',
    },
    {
      value: 'practice',
      label: 'Practice / clinic',
      icon: <Users className="h-[17px] w-[17px]" strokeWidth={2} />,
      desc: 'Team roster, shared billing & policies',
    },
  ];

  return (
    <AuthSplitShell
      variant="signup"
      headline="Start your free 14-day trial"
      tagline="Build your white-label booking portal, manage clients, write clinical SOAP notes, and hold telehealth sessions."
      footer="No credit card required. Cancel anytime."
      bullets={[
        'Your booking page live in minutes',
        'Paystack payouts straight to your bank',
        'Telehealth room with live SOAP notes',
      ]}
    >
      <div className="text-[29px] font-bold tracking-[-0.03em] text-[#0F172A]">
        Create your workspace
      </div>
      <p className="mt-[7px] text-[14.5px] text-[#64748B] leading-[1.6]">
        Setup your portal in under 2 minutes.
      </p>

      <div className="mt-[22px] grid grid-cols-2 gap-3">
        {personaOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPersona(opt.value)}
            aria-pressed={persona === opt.value}
            className={`rounded-[16px] border p-3.5 text-left transition-colors cursor-pointer ${
              persona === opt.value
                ? 'border-[#0F3A53] bg-[#EFF6FB]'
                : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]'
            }`}
          >
            <div className={`flex items-center gap-2 ${persona === opt.value ? 'text-[#0F3A53]' : 'text-[#64748B]'}`}>
              {opt.icon}
              <span className="text-[13px] font-bold">{opt.label}</span>
            </div>
            <p className="mt-1 text-[11px] text-[#94A3B8] leading-snug">{opt.desc}</p>
          </button>
        ))}
      </div>

      {persona === 'practice' && (
        <button
          type="button"
          onClick={() => setAlsoTherapist((v) => !v)}
          className="mt-3 flex items-center gap-2.5 cursor-pointer group"
        >
          <span
            className={`h-5 w-5 rounded-[7px] border flex items-center justify-center transition-colors ${
              alsoTherapist ? 'bg-[#0F3A53] border-[#0F3A53]' : 'bg-white border-[#CBD5E1]'
            }`}
          >
            {alsoTherapist && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
          </span>
          <span className="text-[12.5px] text-[#475569] font-medium group-hover:text-[#0F172A]">
            I'll also provide services myself
          </span>
        </button>
      )}

      <form onSubmit={handleSignup} className="mt-[26px] flex flex-col gap-4">
        <AuthField
          label="Practice / clinic name"
          icon={<Building className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
        >
          <input
            type="text"
            required
            value={practiceName}
            onChange={(e) => setPracticeName(e.target.value)}
            placeholder="e.g. Okonkwo Wellness"
            className={authInputCls}
          />
        </AuthField>

        <AuthField
          label="Your full name"
          icon={<User className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
        >
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Dr. Adaeze Okonkwo"
            className={authInputCls}
          />
        </AuthField>

        <AuthField
          label="Work email address"
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

        <AuthField
          label="Password"
          icon={<Lock className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex-none text-[#94A3B8] hover:text-[#475569] cursor-pointer"
              aria-label="Toggle password visibility"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          }
        >
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            className={authInputCls}
          />
        </AuthField>

        {password.length > 0 && (
          <div className="rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3 grid grid-cols-1 gap-1.5">
            {passwordChecks.map((rule) => (
              <div key={rule.label} className="flex items-center gap-2 text-xs">
                {rule.ok ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 flex-none" strokeWidth={3} />
                ) : (
                  <X className="h-3.5 w-3.5 text-[#94A3B8] flex-none" strokeWidth={3} />
                )}
                <span className={`font-medium ${rule.ok ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                  {rule.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-red-600 bg-red-50 rounded-[12px] px-3.5 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || submitting}
          className="w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold inline-flex items-center justify-center gap-[10px] cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading || submitting ? (
            <>
              <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Creating your practice…
            </>
          ) : (
            <>
              Create practice workspace
              <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
            </>
          )}
        </button>
      </form>

        <div className="mt-2 flex items-start gap-3 px-1">
          <input
            type="checkbox"
            id="terms"
            required
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] rounded-[5px] border-[#CBD5E1] text-[#0F3A53] focus:ring-[#0F3A53] cursor-pointer shrink-0"
          />
          <label htmlFor="terms" className="text-[11.5px] text-[#64748B] leading-[1.5]">
            I agree to the <Link to="/terms-of-service" target="_blank" className="font-bold text-[#0F3A53] hover:underline">Terms of Service</Link> and <Link to="/privacy-policy" target="_blank" className="font-bold text-[#0F3A53] hover:underline">Privacy Policy</Link>, and I acknowledge that I am solely responsible and liable for all clinical advice, diagnosis, and services provided to clients via this platform.
          </label>
        </div>

      <div className="mt-[18px] text-[13.5px] text-[#64748B] text-center">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-[#0F3A53] hover:underline">
          Log in
        </Link>
      </div>
    </AuthSplitShell>
  );
}
