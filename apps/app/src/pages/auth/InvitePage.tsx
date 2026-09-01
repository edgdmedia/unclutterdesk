import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, User } from 'lucide-react';
import { UnclutterMark } from '../../components/UnclutterMark';

const inviteInputCls =
  'w-full h-12 px-[15px] border border-[#E2E8F0] rounded-[14px] bg-[#F8FAFC] text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]';

const bullets = [
  'Your own booking link under the clinic brand',
  'Telehealth room with live SOAP notes',
  'Only the clients assigned to you',
];

export function InvitePage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('Segun Oyelaran');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPendingAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleClaimInvite = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

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
            ST
          </div>
          <div className="leading-[1.3]">
            <div className="text-white text-base font-bold tracking-[-0.01em]">Smith Therapy Ltd</div>
            <div className="text-[#64748B] text-[11.5px]">Lagos, Nigeria</div>
          </div>
        </div>

        <div className="my-auto py-10 relative z-[2]">
          <div className="text-[9px] font-black tracking-[0.24em] text-[#E3B341]">YOU'VE BEEN INVITED</div>
          <div className="mt-4 text-[38px] font-bold tracking-[-0.035em] text-white leading-[1.15]">
            You've been invited to join the practice
          </div>
          <p className="mt-[18px] text-[15px] text-[#94A3B8] leading-[1.65] max-w-[380px]">
            Your practice manager added you as a{' '}
            <span className="text-[#E3B341] font-semibold">Therapist</span>. Set a password and
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
          <span>Powered by unclutterOS · invite expires in 5 days</span>
        </div>
      </div>

      {/* Right card */}
      <div className="flex-1 min-w-0 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-[520px] bg-white rounded-[26px] p-[34px_36px] shadow-[0_20px_60px_rgba(15,23,42,0.1)]">
          <div className="text-[22px] font-bold tracking-[-0.02em] text-[#0F172A]">
            Set up your account
          </div>
          <p className="mt-[5px] text-[13.5px] text-[#64748B]">Takes about a minute.</p>

          {/* Avatar uploader */}
          <div className="mt-6 flex items-center gap-4 p-4 rounded-[20px] bg-[#F8FAFC] border border-dashed border-[#CBD5E1]">
            <div className="w-[66px] h-[66px] flex-none rounded-[20px] bg-[#EFF6FB] text-[#0F3A53] flex items-center justify-center overflow-hidden">
              {pendingAvatar ? (
                <img src={pendingAvatar} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6" strokeWidth={1.9} />
              )}
            </div>
            <div className="leading-[1.4]">
              <div className="text-sm font-bold text-[#0F172A]">Profile photo</div>
              <div className="text-xs text-[#64748B]">
                JPG or PNG, up to 2MB. Clients see this on your booking page.
              </div>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
                <span className="mt-[9px] inline-flex items-center h-9 px-[14px] border border-[#E2E8F0] rounded-[11px] bg-white text-[#334155] text-[12.5px] font-semibold cursor-pointer transition-colors hover:bg-[#F1F5F9]">
                  Choose file
                </span>
              </label>
            </div>
          </div>

          <form onSubmit={handleClaimInvite} className="mt-[20px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-[7px]">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inviteInputCls}
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-[7px]">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Counselling psychologist"
                  className={inviteInputCls}
                />
              </div>
            </div>

            <div className="mt-[14px]">
              <div className="text-[11.5px] font-bold text-[#475569] mb-[7px]">Email</div>
              <div className="flex items-center gap-[10px] h-12 px-[15px] border border-[#E2E8F0] rounded-[14px] bg-[#F1F5F9]">
                <span className="text-sm text-[#64748B]">segun@smiththerapy.ng</span>
                <span className="ml-auto h-5 px-[9px] rounded-full bg-white text-[#64748B] text-[9px] font-black tracking-[0.1em] inline-flex items-center">
                  LOCKED
                </span>
              </div>
            </div>

            <div className="mt-[14px] grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-[7px]">
                  Create password
                </label>
                <div className="relative">
                  <Lock className="h-[17px] w-[17px] text-[#94A3B8] absolute left-[15px] top-1/2 -translate-y-1/2" strokeWidth={2} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`${inviteInputCls} pl-[38px]`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-[7px]">
                  Confirm password
                </label>
                <input
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
                <div className="h-full w-[72%] bg-[#15803D]" />
              </div>
              <span className="text-[11.5px] font-bold text-[#15803D] whitespace-nowrap">Strong</span>
            </div>

            <button
              type="submit"
              className="mt-[22px] w-full h-[52px] rounded-[16px] bg-[#0F3A53] text-white text-[15px] font-bold cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110"
            >
              Join Smith Therapy Ltd
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
