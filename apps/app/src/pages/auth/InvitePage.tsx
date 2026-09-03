import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, Loader2, Lock } from 'lucide-react';
import { UnclutterMark } from '../../components/UnclutterMark';
import { api, getBookingUrl } from '../../utils/apiClient';
import { initialsOf } from '../../utils/initials';
import { useAuth } from '../../context/AuthContext';

const inviteInputCls =
  'w-full h-12 px-[15px] border border-[#E2E8F0] rounded-[14px] bg-[#F8FAFC] text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]';

const bullets = [
  'Your own booking link under the clinic brand',
  'Telehealth room with live SOAP notes',
  'Only the clients assigned to you',
];

interface Invite {
  email: string;
  role: string;
  practiceName: string;
  practiceSlug: string;
  expiresAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Practice admin',
  THERAPIST: 'Therapist',
  RECEPTIONIST: 'Receptionist',
};

function expiresIn(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'expires today';
  return `invite expires in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The meter used to be a hardcoded 72% bar reading "Strong" regardless of what
 * was typed, which told people their password was fine before they had entered
 * one. It now reflects the field.
 */
function strengthOf(password: string): { pct: number; label: string; colour: string } {
  if (!password) return { pct: 0, label: '', colour: '#E2E8F0' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length < 8) return { pct: 20, label: 'Too short', colour: '#DC2626' };
  if (score <= 2) return { pct: 40, label: 'Weak', colour: '#DC2626' };
  if (score === 3) return { pct: 65, label: 'Fair', colour: '#CA8A04' };
  if (score === 4) return { pct: 85, label: 'Good', colour: '#15803D' };
  return { pct: 100, label: 'Strong', colour: '#15803D' };
}

/** Full name in one box, but the API stores the two halves separately. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export function InvitePage() {
  const navigate = useNavigate();
  const { claimInvite } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('This link is missing its invitation code. Ask your practice to resend it.');
      return;
    }
    let cancelled = false;
    api
      .get<Invite>(`/v1/tenant/public/invite/${encodeURIComponent(token)}`)
      .then((data) => {
        if (!cancelled) setInvite(data);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('This invitation has expired or has already been used.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const strength = useMemo(() => strengthOf(password), [password]);

  const handleClaimInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || submitting) return;

    if (password.length < 8) {
      setSubmitError('Choose a password of at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('The two passwords do not match.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      await claimInvite({ token, password, ...splitName(fullName) });
      // The session cookie is set on the API domain, but the app reads the
      // practice from its own subdomain — so land on the practice's host
      // rather than wherever the invite link was opened.
      const target = `${getBookingUrl(invite.practiceSlug)}/dashboard`;
      if (window.location.origin === new URL(target).origin) {
        navigate('/dashboard');
      } else {
        window.location.assign(target);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'We could not complete your sign-up. Try again.',
      );
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#EFF3F7] flex items-center justify-center p-8 font-outfit">
        <div className="w-full max-w-[440px] bg-white rounded-[26px] p-[34px_36px] shadow-[0_20px_60px_rgba(15,23,42,0.1)] text-center">
          <div className="mx-auto h-12 w-12 rounded-[16px] bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
            <AlertCircle className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="mt-4 text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">
            This invitation is no longer valid
          </div>
          <p className="mt-2 text-[13.5px] text-[#64748B] leading-[1.65]">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-6 w-full h-12 rounded-[16px] bg-[#0F3A53] text-white text-sm font-bold cursor-pointer"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-[#EFF3F7] flex items-center justify-center font-outfit">
        <Loader2 className="h-7 w-7 text-[#0F3A53] animate-spin" aria-label="Loading invitation" />
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[invite.role] ?? 'team member';

  return (
    <div className="min-h-screen bg-[#EFF3F7] flex font-outfit">
      {/* Left slate panel */}
      <div className="hidden lg:flex w-[520px] flex-none bg-[#0F172A] px-11 py-12 flex-col relative overflow-hidden">
        <div
          className="absolute right-[-90px] bottom-[-70px] w-[340px] h-[340px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(227,179,65,.16), transparent 68%)' }}
        />

        <div className="flex items-center gap-3 relative z-[2]">
          <div className="w-10 h-10 rounded-[13px] bg-[#E3B341] text-[#0F172A] text-base font-extrabold flex items-center justify-center">
            {initialsOf(invite.practiceName, 'UD')}
          </div>
          <div className="leading-[1.3]">
            <div className="text-white text-base font-bold tracking-[-0.01em]">
              {invite.practiceName}
            </div>
            <div className="text-[#64748B] text-[11.5px]">unclutterOS practice</div>
          </div>
        </div>

        <div className="my-auto py-10 relative z-[2]">
          <div className="text-[9px] font-black tracking-[0.24em] text-[#E3B341]">
            YOU'VE BEEN INVITED
          </div>
          <div className="mt-4 text-[38px] font-bold tracking-[-0.035em] text-white leading-[1.15]">
            You've been invited to join the practice
          </div>
          <p className="mt-[18px] text-[15px] text-[#94A3B8] leading-[1.65] max-w-[380px]">
            Your practice manager added you as a{' '}
            <span className="text-[#E3B341] font-semibold">{roleLabel}</span>. Set a password and
            you'll be in — your calendar and client list are waiting.
          </p>

          <div className="mt-[34px] flex flex-col gap-[14px]">
            {bullets.map((b) => (
              <div key={b} className="flex items-center gap-3">
                <span className="h-[30px] w-[30px] flex-none rounded-[10px] bg-[#E3B341]/14 text-[#E3B341] flex items-center justify-center">
                  <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />
                </span>
                <span className="text-[13.5px] text-[#CBD5E1]">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-[9px] text-[#475569] text-[11.5px] relative z-[2]">
          <UnclutterMark size={20} className="rounded-[6px] opacity-70" />
          <span>Powered by unclutterOS · {expiresIn(invite.expiresAt)}</span>
        </div>
      </div>

      {/* Right card */}
      <div className="flex-1 min-w-0 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-[520px] bg-white rounded-[26px] p-[34px_36px] shadow-[0_20px_60px_rgba(15,23,42,0.1)]">
          <div className="text-[22px] font-bold tracking-[-0.02em] text-[#0F172A]">
            Set up your account
          </div>
          <p className="mt-[5px] text-[13.5px] text-[#64748B]">
            Takes about a minute. Your photo, title and booking details come next, in Settings.
          </p>

          <form onSubmit={handleClaimInvite} className="mt-[20px]">
            <div>
              <label
                htmlFor="invite-name"
                className="block text-[11.5px] font-bold text-[#475569] mb-[7px]"
              >
                Full name
              </label>
              <input
                id="invite-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Segun Oyelaran"
                className={inviteInputCls}
              />
            </div>

            <div className="mt-[14px]">
              <div className="text-[11.5px] font-bold text-[#475569] mb-[7px]">Email</div>
              <div className="flex items-center gap-[10px] h-12 px-[15px] border border-[#E2E8F0] rounded-[14px] bg-[#F1F5F9]">
                <span className="text-sm text-[#64748B] truncate">{invite.email}</span>
                <span className="ml-auto h-5 px-[9px] rounded-full bg-white text-[#64748B] text-[9px] font-black tracking-[0.1em] inline-flex items-center flex-none">
                  LOCKED
                </span>
              </div>
            </div>

            <div className="mt-[14px] grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
              <div>
                <label
                  htmlFor="invite-password"
                  className="block text-[11.5px] font-bold text-[#475569] mb-[7px]"
                >
                  Create password
                </label>
                <div className="relative">
                  <Lock
                    className="h-[17px] w-[17px] text-[#94A3B8] absolute left-[15px] top-1/2 -translate-y-1/2"
                    strokeWidth={2}
                  />
                  <input
                    id="invite-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`${inviteInputCls} pl-[38px]`}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="invite-confirm"
                  className="block text-[11.5px] font-bold text-[#475569] mb-[7px]"
                >
                  Confirm password
                </label>
                <input
                  id="invite-confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={inviteInputCls}
                />
              </div>
            </div>

            <div className="mt-[11px] flex items-center gap-2">
              <div className="flex-1 h-[5px] rounded-[99px] bg-[#E2E8F0] overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${strength.pct}%`, background: strength.colour }}
                />
              </div>
              <span
                className="text-[11.5px] font-bold whitespace-nowrap"
                style={{ color: strength.colour }}
              >
                {strength.label}
              </span>
            </div>

            {submitError && (
              <div
                role="alert"
                className="mt-[14px] flex items-start gap-2 p-3 rounded-[12px] bg-[#FEF2F2] text-[#B91C1C] text-[12.5px] leading-[1.5]"
              >
                <AlertCircle className="h-4 w-4 flex-none mt-[1px]" strokeWidth={2} />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-[22px] w-full h-[52px] rounded-[16px] bg-[#0F3A53] text-white text-[15px] font-bold cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Setting up your account…' : `Join ${invite.practiceName}`}
            </button>
            <p className="mt-[14px] text-[11.5px] text-[#94A3B8] text-center leading-[1.6]">
              By joining you agree to the unclutterOS terms and the clinic's data-handling policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
