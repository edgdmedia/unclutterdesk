import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authInputCls } from '../../components/AuthField';

export function PlatformAdminLoginPage() {
  const navigate = useNavigate();
  const { loginAdmin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await loginAdmin(email, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B2C40] text-white flex flex-col items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-[#E3B341]/10 blur-[90px]" />
        <div className="absolute -bottom-48 -left-32 h-[420px] w-[420px] rounded-full bg-[#1B5375]/40 blur-[90px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="h-9 w-9 rounded-[12px] bg-[#0F3A53] text-[#E3B341] flex items-center justify-center font-extrabold text-base border border-[#E3B341]/30 shadow-sm">
            O
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[19px] tracking-[-0.02em] text-[#F8FAFC]">unclutterOS</span>
            <span className="h-[18px] px-2 rounded-full text-[9px] font-extrabold tracking-[0.08em] bg-[#E3B341] text-[#0F172A] flex items-center justify-center uppercase">
              Admin
            </span>
          </div>
        </div>

        <div className="bg-white rounded-[24px] text-[#0F172A] p-[30px] shadow-[0_24px_60px_rgba(0,0,0,0.35)] border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-[18px] w-[18px] text-[#0F3A53]" strokeWidth={2.2} />
            <div className="text-[10px] font-black tracking-[0.2em] uppercase text-[#94A3B8]">
              Platform console
            </div>
          </div>
          <div className="text-[26px] font-bold tracking-[-0.03em]">Admin sign in</div>
          <p className="mt-[6px] text-[13.5px] text-[#64748B] leading-[1.6]">
            Restricted to unclutterOS staff managing practice tenants.
          </p>

          <form onSubmit={handleLogin} className="mt-[26px]">
            <label className="block text-[12.5px] font-semibold text-[#475569] mb-1.5">
              Email address
            </label>
            <div className="flex items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-white px-4 focus-within:border-[#0F3A53]">
              <Mail className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@unclutterdesk.com"
                className={authInputCls}
              />
            </div>

            <div className="mt-[18px]">
              <label className="block text-[12.5px] font-semibold text-[#475569] mb-1.5">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-white px-4 focus-within:border-[#0F3A53]">
                <Lock className="h-[17px] w-[17px] text-[#94A3B8] flex-none" strokeWidth={2} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className={authInputCls}
                />
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
              </div>
            </div>

            {error && (
              <p className="mt-4 text-xs font-medium text-red-600 bg-red-50 rounded-[12px] px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-[26px] w-full h-[54px] rounded-[14px] bg-[#0F3A53] text-white text-[15px] font-bold inline-flex items-center justify-center gap-[10px] cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.3)] transition-[filter] hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-[17px] w-[17px] animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Enter console</span>
                  <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-[13px] font-semibold text-white/70 hover:text-white transition-colors"
          >
            ← Back to practice sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
