import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Check, Lock, Mail, User, X } from 'lucide-react';
import { AuthSplitShell } from '../../components/AuthSplitShell';
import { AuthField, authInputCls } from '../../components/AuthField';
import { LEGAL_URLS } from '../../utils/legal';
import { api } from '../../utils/apiClient';
import { PROFILE_PUBLIC_ORIGIN } from '../../config/domains';
import { KIND_LABELS } from '../practice/profile/profileApi';

/**
 * Profile-first signup (spec §6.8): the free therapist profile is the way in.
 * Name, email, password, the profile address (handle), kind and an optional
 * template. Then Desk's usual 6-digit code, then sign-in, then the editor.
 */

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Upper and lower case letters', test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'A symbol (!@#$%…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** A handle suggestion from a name: "Dr. Folake Adeyemi" → "folake-adeyemi" (§6.2 rules are checked by the API). */
export function suggestHandle(first: string, last: string): string {
  return `${first} ${last}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms|prof)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
}

type HandleState = { status: 'idle' | 'checking' | 'free' | 'taken'; message?: string };
type Template = { key: string; title: string; description: string };

const host = PROFILE_PUBLIC_ORIGIN.replace(/^https?:\/\//, '');

export function ProfileSignupPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [kind, setKind] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [check, setCheck] = useState<HandleState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Suggest a handle from the name until the person types their own.
  useEffect(() => {
    if (!handleEdited) setHandle(suggestHandle(firstName, lastName));
  }, [firstName, lastName, handleEdited]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Template[]>('/v1/auth/profile-templates')
      .then((list) => !cancelled && Array.isArray(list) && setTemplates(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Live handle check, debounced.
  useEffect(() => {
    if (handle.length < 3) {
      setCheck({ status: 'idle' });
      return;
    }
    setCheck({ status: 'checking' });
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .get<{ available: boolean; message?: string }>(`/v1/auth/handle-check?handle=${encodeURIComponent(handle)}`)
        .then((r) => !cancelled && setCheck(r.available ? { status: 'free' } : { status: 'taken', message: r.message }))
        .catch(() => !cancelled && setCheck({ status: 'idle' }));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle]);

  const passwordOk = useMemo(() => PASSWORD_RULES.every((r) => r.test(password)), [password]);
  const ready = firstName.trim() && lastName.trim() && email.trim() && passwordOk && check.status === 'free' && kind && agreed;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<{ email_sent?: boolean }>('/v1/auth/register-profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        handle,
        kind,
        ...(templateKey ? { templateKey } : {}),
      });
      navigate('/verify-email', { state: { email: email.trim().toLowerCase(), emailSent: result?.email_sent, returnTo: '/dashboard/profile' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const select = 'flex-1 min-w-0 bg-transparent border-none outline-none text-[14.5px] text-[var(--desk-text)] h-full cursor-pointer';
  return (
    <AuthSplitShell
      variant="signup"
      headline="A professional profile in ten minutes. Free."
      tagline="One link that tells clients who you are, how you work and how to reach you. When you're ready, the same account runs your whole practice."
      footer="Free forever for your profile · No card needed"
      bullets={['Templates and prompts for every section', 'Your own address to share anywhere', 'Booking, payments and video when you want them']}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-labelledby="signup-title">
        <div>
          <h1 id="signup-title" className="text-[26px] font-extrabold tracking-[-0.03em] text-[var(--desk-text)]">Create your free therapist profile</h1>
          <p className="mt-1 text-[13.5px] text-[var(--desk-text-muted)]">
            Already have an account? <Link to="/login" className="font-bold text-[var(--desk-text)] hover:underline">Log in</Link>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AuthField label="First name" icon={<User size={16} className="text-[var(--desk-text-subtle)]" aria-hidden />}>
            <input aria-label="First name" autoComplete="given-name" className={authInputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </AuthField>
          <AuthField label="Last name">
            <input aria-label="Last name" autoComplete="family-name" className={authInputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </AuthField>
        </div>

        <AuthField label="Email" icon={<Mail size={16} className="text-[var(--desk-text-subtle)]" aria-hidden />}>
          <input aria-label="Email" type="email" autoComplete="email" className={authInputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </AuthField>

        <div>
          <AuthField label="Password" icon={<Lock size={16} className="text-[var(--desk-text-subtle)]" aria-hidden />}>
            <input aria-label="Password" type="password" autoComplete="new-password" className={authInputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </AuthField>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1" aria-label="Password rules">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={`flex items-center gap-1.5 text-[12px] ${ok ? 'text-[var(--desk-active)]' : 'text-[var(--desk-text-muted)]'}`}>
                  {ok ? <Check size={13} aria-hidden /> : <span aria-hidden className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--desk-pine-200)]" />}
                  {r.label}
                  <span className="sr-only">{ok ? ' (done)' : ' (not yet)'}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <AuthField label="Your profile address" icon={<AtSign size={16} className="text-[var(--desk-text-subtle)]" aria-hidden />}>
            <span className="text-[14.5px] text-[var(--desk-text-muted)] shrink-0">{host}/</span>
            <input
              aria-label="Your profile address"
              aria-describedby="handle-status"
              autoCapitalize="none"
              spellCheck={false}
              className={authInputCls}
              value={handle}
              onChange={(e) => {
                setHandleEdited(true);
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30));
              }}
              required
            />
          </AuthField>
          <p id="handle-status" aria-live="polite" className="mt-1.5 text-[12.5px] min-h-[18px]">
            {check.status === 'checking' && <span className="text-[var(--desk-text-muted)]">Checking…</span>}
            {check.status === 'free' && <span className="inline-flex items-center gap-1 text-[var(--desk-active)]"><Check size={13} aria-hidden /> {host}/{handle} is yours to take</span>}
            {check.status === 'taken' && <span className="inline-flex items-center gap-1 text-[var(--desk-danger)]"><X size={13} aria-hidden /> {check.message ?? 'That address is taken'}</span>}
            {check.status === 'idle' && <span className="text-[var(--desk-text-muted)]">3 to 30 letters, numbers or hyphens.</span>}
          </p>
        </div>

        <AuthField label="What kind of practitioner are you?">
          <select aria-label="What kind of practitioner are you?" className={select} value={kind} onChange={(e) => setKind(e.target.value)} required>
            <option value="">Choose one</option>
            {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </AuthField>

        {templates.length > 0 && (
          <AuthField label="Start from a template (optional)">
            <select aria-label="Start from a template (optional)" className={select} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              <option value="">No template, I'll write my own</option>
              {templates.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
            </select>
          </AuthField>
        )}

        <label className="flex items-start gap-2.5 text-[13px] text-[var(--desk-text-body)] cursor-pointer">
          <input type="checkbox" className="mt-[3px] h-4 w-4 accent-[var(--desk-pine-600)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className="font-semibold underline">terms</a> and{' '}
            <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className="font-semibold underline">privacy policy</a>, and that what I publish is accurate.
          </span>
        </label>

        {error && <p role="alert" className="text-[13px] font-semibold text-[var(--desk-danger)] bg-[var(--desk-danger-bg)] border border-[var(--desk-danger-border)] rounded-[12px] px-3 py-2.5">{error}</p>}

        <button
          type="submit"
          disabled={!ready || submitting}
          className="h-[52px] rounded-[14px] bg-[var(--desk-pine-600)] text-white text-[15px] font-bold disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer hover:brightness-110"
        >
          {submitting ? 'Creating your account…' : 'Create my free profile'}
        </button>
        <p className="text-[12px] text-[var(--desk-text-muted)]">
          Running a practice with a team? <Link to="/auth/signup" className="font-semibold underline">Set up a practice instead</Link>
        </p>
      </form>
    </AuthSplitShell>
  );
}
