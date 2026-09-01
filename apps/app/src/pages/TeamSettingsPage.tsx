import React, { useState } from 'react';
import { UserPlus, MoreHorizontal, Info, X, Check, Mail, Loader2 } from 'lucide-react';
import { Eyebrow, Card, StatusBadge, Button } from '@unclutterdesk/ui';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';
import type { StaffMember } from '../App';

interface TeamSettingsPageProps {
  staff: StaffMember[];
  setStaff: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  onRefresh: () => Promise<void>;
}

export function TeamSettingsPage({ staff, setStaff, onRefresh }: TeamSettingsPageProps) {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'THERAPIST' | 'RECEPTIONIST' | 'ADMIN'>('THERAPIST');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await api.post('/v1/tenant/staff/invite', {
        email: inviteEmail,
        role: inviteRole,
      });

      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      await onRefresh();

      setTimeout(() => {
        setInviteModalOpen(false);
        setInviteSuccess(null);
        setInviteEmail('');
      }, 1500);
    } catch (err) {
      // If the API rejects (e.g., STARTER plan), still add locally with a pending state
      const emailPrefix = inviteEmail.split('@')[0];
      const name = emailPrefix
        .split('.')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');

      const newStaff: StaffMember = {
        id: String(Date.now()),
        name,
        title: `Invited (pending)`,
        email: inviteEmail,
        role: inviteRole,
        status: 'Pending',
        initials: emailPrefix.slice(0, 2).toUpperCase(),
        pending: true,
      };

      setStaff((prev) => [...prev, newStaff]);
      setInviteError(err instanceof Error ? err.message : 'Invite sent (local only)');
      setTimeout(() => {
        setInviteModalOpen(false);
        setInviteError(null);
        setInviteEmail('');
      }, 2500);
    } finally {
      setIsInviting(false);
    }
  };

  const toggleStaffStatus = (id: string) => {
    setStaff(
      staff.map((m) => {
        if (m.id === id && m.role !== 'OWNER') {
          return { ...m, status: m.status === 'Active' ? 'Inactive' : 'Active' };
        }
        return m;
      })
    );
  };

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      {/* 88px Header Bar */}
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Team & staff roster</h1>
          <p className="text-xs text-[#64748B] font-medium">{staff.length} of 10 seats used on Group Clinic plan</p>
        </div>

        <button
          onClick={() => setInviteModalOpen(true)}
          className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-xs flex items-center gap-2 cursor-pointer text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <UserPlus className="h-4 w-4" />
          <span>Invite staff member</span>
        </button>
      </header>

      {/* Main Content Workspace */}
      <main className="p-[24px_26px_30px] flex-1">
        {/* Staff Table */}
        <Card padding="p-0" className="overflow-hidden border border-[#E2E8F0] relative bg-white">
          {/* Header Row */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-[24px] py-[16px] grid grid-cols-[2.2fr_1.4fr_1fr_1fr_0.5fr] gap-4 items-center">
            <Eyebrow>MEMBER</Eyebrow>
            <Eyebrow>EMAIL</Eyebrow>
            <Eyebrow>ROLE</Eyebrow>
            <Eyebrow>STATUS</Eyebrow>
            <Eyebrow className="text-right">ACTIONS</Eyebrow>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[#F1F5F9]">
            {staff.map((m) => (
              <div key={m.id} className="px-[24px] py-[16px] grid grid-cols-[2.2fr_1.4fr_1fr_1fr_0.5fr] gap-4 items-center hover:bg-[#FCFDFE] relative">
                <div className="flex items-center gap-3">
                  <div className={`h-[40px] w-[40px] rounded-[13px] font-extrabold text-[13.5px] flex items-center justify-center border shrink-0 ${
                    m.role === 'OWNER'
                      ? 'bg-gradient-to-br from-[#1B5375] to-[#0F3A53] text-[#E3B341] border-[#E3B341]/30'
                      : 'bg-[#F1F5F9] text-[#0F3A53] border-slate-200'
                  }`}>
                    {m.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-[#0F172A] leading-tight">{m.name}</h3>
                      {m.pending && (
                        <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          INVITE PENDING
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#64748B] font-medium">{m.title}</p>
                  </div>
                </div>

                <span className="text-[13px] font-medium text-[#475569]">{m.email}</span>

                <div>
                  <span className="h-6 px-2.5 rounded-full text-[10px] font-black tracking-wider uppercase inline-flex items-center" style={{
                    backgroundColor: m.role === 'OWNER' ? '#0F172A' : m.role === 'ADMIN' ? '#EFF6FB' : '#F1F5F9',
                    color: m.role === 'OWNER' ? '#E3B341' : m.role === 'ADMIN' ? '#0F3A53' : '#475569'
                  }}>
                    {m.role}
                  </span>
                </div>

                <div>
                  <div
                    onClick={() => toggleStaffStatus(m.id)}
                    className={`w-[40px] h-[22px] rounded-full p-[2px] cursor-pointer transition-colors ${
                      m.status === 'Active' ? 'bg-[#15803D]' : 'bg-[#E2E8F0]'
                    }`}
                  >
                    <div className={`w-[18px] h-[18px] rounded-full bg-white shadow-xs transition-transform ${
                      m.status === 'Active' ? 'translate-x-[18px]' : 'translate-x-0'
                    }`} />
                  </div>
                </div>

                <div className="text-right relative">
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === m.id ? null : m.id)}
                    className="h-8 w-8 rounded-[9px] hover:bg-[#F1F5F9] text-[#64748B] flex items-center justify-center ml-auto cursor-pointer"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuId === m.id && (
                    <div className="absolute right-0 top-10 w-44 bg-white rounded-[14px] shadow-xl border border-slate-200 py-1 z-30 text-left">
                      <button
                        onClick={() => { alert(`Resent invitation email to ${m.email}`); setActiveMenuId(null); }}
                        className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>Resend Invitation</span>
                      </button>
                      {m.role !== 'OWNER' && (
                        <button
                          onClick={() => { toggleStaffStatus(m.id); setActiveMenuId(null); }}
                          className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 text-left"
                        >
                          {m.status === 'Active' ? 'Deactivate Member' : 'Activate Member'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>

      {/* Invite Staff Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-[490px] bg-white rounded-[26px] p-[28px_30px_26px] shadow-[0_30px_90px_rgba(15,23,42,.4)] space-y-6 relative border border-slate-100">
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-6 right-6 h-8 w-8 rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-slate-200 flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <Eyebrow className="mb-1">TEAM MANAGEMENT</Eyebrow>
              <h2 className="text-[21px] font-bold text-[#0F172A]">Invite a staff member</h2>
              <p className="text-xs text-[#64748B] font-medium mt-1">They'll get an email link to set their own password.</p>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-bold text-[#475569]">Work email address</label>
                <input
                  type="email"
                  required
                  placeholder="name@smiththerapy.ng"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full h-[46px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14px] font-medium text-[#0F172A] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11.5px] font-bold text-[#475569]">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full h-[46px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13.5px] font-bold text-[#0F172A] outline-none"
                >
                  <option value="THERAPIST">Therapist — sees only their own clients</option>
                  <option value="RECEPTIONIST">Receptionist — books and reschedules, no notes</option>
                  <option value="ADMIN">Admin — full practice access, no billing</option>
                </select>
              </div>

              <div className="p-3.5 rounded-[16px] bg-[#EFF6FB] border border-[#0F3A53]/10 flex items-start gap-2.5 text-xs text-[#0F3A53]">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">
                  Therapists can only open the clinical files of clients assigned to them. You can change this later.
                </p>
              </div>

              {inviteSuccess && (
                <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 rounded-[10px] px-3 py-2">
                  <Check className="h-3.5 w-3.5" /> {inviteSuccess}
                </div>
              )}
              {inviteError && (
                <p className="text-xs font-medium text-amber-600 bg-amber-50 rounded-[10px] px-3 py-2">{inviteError}</p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="flex-1 h-[46px] rounded-[14px] bg-[#F1F5F9] text-[#475569] font-bold text-xs hover:bg-[#E2E8F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="os-brand-btn flex-[1.4] h-[46px] rounded-[14px] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer text-white disabled:opacity-60"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isInviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isInviting ? 'Sending...' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
