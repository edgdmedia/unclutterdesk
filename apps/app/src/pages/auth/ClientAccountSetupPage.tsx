import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { AuthSplitShell } from '../../components/AuthSplitShell';
import { AuthField, authInputCls } from '../../components/AuthField';

export function ClientAccountSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingState = (location.state as { fullName?: string; email?: string } | null) || {};
  const [fullName, setFullName] = useState(bookingState.fullName || '');
  const [email, setEmail] = useState(bookingState.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const [firstName, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
    try {
      await api.post('/v1/auth/register', {
        email,
        password,
        firstName,
        lastName: rest.join(' '),
        type: 'user',
      });
      navigate('/verify-email', { state: { email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create client account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthSplitShell variant="signup" headline="Create your client account" tagline="Save your booking details, manage your sessions, and join telehealth rooms securely." footer="Client access for booked sessions only.">
      <div className="text-[29px] font-bold tracking-[-0.03em] text-[#0F172A]">Finish setting up your account</div>
      <p className="mt-[7px] text-[14.5px] text-[#64748B] leading-[1.6]">Use the same email you booked with so your sessions appear automatically.</p>
      <form onSubmit={handleSignup} className="mt-[26px] flex flex-col gap-4">
        <AuthField label="Full name" icon={<User className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={authInputCls} /></AuthField>
        <AuthField label="Email" icon={<Mail className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInputCls} /></AuthField>
        <AuthField label="Password" icon={<Lock className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />}><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={authInputCls} /></AuthField>
        {error ? <p className="text-xs font-medium text-red-500 bg-red-50 rounded-[12px] px-3.5 py-2.5">{error}</p> : null}
        <button type="submit" disabled={saving} className="w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold inline-flex items-center justify-center gap-[10px] cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-70">
          <span>{saving ? 'Creating account…' : 'Create client account'}</span>
          <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
        </button>
      </form>
      <div className="mt-[18px] text-[13.5px] text-[#64748B] text-center">Already created your account? <Link to="/login" state={{ email }} className="font-bold text-[#0F3A53] hover:underline">Sign in</Link></div>
    </AuthSplitShell>
  );
}
