import React, { useState } from 'react';
import { UserPlus, MoreHorizontal, Info, X, Check, Mail, Loader2 } from 'lucide-react';
import { Eyebrow, Card, StatusBadge, Button } from '@unclutterdesk/ui';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';
import type { StaffMember } from '../App';

/**
 * The staff roster.
 *
 * Every write on this page was pretend. The status toggle only edited React
 * state, so deactivating a practitioner looked like it worked and lasted until
 * the next refresh — while that person kept their access, their bookable slots
 * and their clinical records. "Resend Invitation" popped an alert saying an
 * email had gone out; none had. And when the invite API rejected a request —
 * which it does on the free plan, with a clear message about upgrading — the
 * page swallowed the error and added the person to the roster locally, so an
 * owner saw a colleague who had never been invited.
 *
 * Each of those now either performs the write or says why it could not.
 */
interface TeamSettingsPageProps {
  staff: StaffMember[];
  onRefresh: () => Promise<void>;
}

export function TeamSettingsPage({ staff, onRefresh }: TeamSettingsPageProps) {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'THERAPIST' | 'RECEPTIONIST' | 'ADMIN'>('THERAPIST');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  // The invite is not emailed anywhere yet; the API returns a claim link and
  // the practice sends it. Saying "check your inbox" would be the same lie in a
  // different place.
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const invite = await api.post<{ inviteUrl?: string }>('/v1/tenant/staff/invite', {
        email: inviteEmail,
        role: inviteRole,
      });

      setInviteSuccess(`Invitation created for ${inviteEmail}`);
      setInviteUrl(invite?.inviteUrl ?? null);
      await onRefresh();
    } catch (err) {
      // The free plan rejects staff invites with a message explaining the
      // upgrade. That message is the useful part, so it is shown rather than
      // being replaced by a roster entry for someone who was never invited.
      setInviteError(err instanceof Error ? err.message : 'Could not create that invitation');
    } finally {
      setIsInviting(false);
    }
  };

  function closeInviteModal() {
    setInviteModalOpen(false);
    setInviteError(null);
    setInviteSuccess(null);
    setInviteUrl(null);
    setInviteEmail('');
  }

  /**
   * Deactivating someone takes them out of service, so it has to reach the
   * server. This used to be a local setState: the row flipped, the person kept
   * working, and the next page load put them back.
   *
   * The list is re-read afterwards rather than patched in place, so what is on
   * screen is what the practice actually has — including the side effect the
   * server applies, which is to drop a deactivated practitioner from the public
   * booking page.
   */
  const toggleStaffStatus = async (member: StaffMember) => {
    // The owner cannot be deactivated; the server refuses it too.
    if (member.role === 'OWNER' || statusPendingId) return;

    const nextStatus = member.status === 'Active' ? 'inactive' : 'active';
    setStatusPendingId(member.id);
    setStatusError(null);
    try {
      await api.patch(`/v1/consult/admin/therapists/${member.id}/status`, { status: nextStatus });
      await onRefresh();
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? `${member.name}: ${err.message}`
          : `Could not change ${member.name}'s status`,
      );
    } finally {
      setStatusPendingId(null);
    }
  };

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      {/* 88px Header Bar */}
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Team & staff roster</h1>
          {/* Claimed a Group Clinic plan and a ten-seat limit to every
              practice, including one on the free plan that cannot invite
              anyone. The count is the part that was true. */}
          <p className="text-xs text-[#64748B] font-medium">
            {staff.length} {staff.length === 1 ? 'team member' : 'team members'}
          </p>
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
        {statusError && (
          <div
            role="alert"
            className="mb-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            {statusError}
          </div>
        )}
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
                  <button
                    type="button"
                    role="switch"
                    aria-checked={m.status === 'Active'}
                    aria-label={`${m.name} active`}
                    onClick={() => toggleStaffStatus(m)}
                    disabled={m.role === 'OWNER' || statusPendingId !== null}
                    className={`w-[40px] h-[22px] rounded-full p-[2px] transition-colors block ${
                      m.status === 'Active' ? 'bg-[#15803D]' : 'bg-[#E2E8F0]'
                    } ${
                      m.role === 'OWNER' || statusPendingId !== null
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                    }`}
                  >
                    <div className={`w-[18px] h-[18px] rounded-full bg-white shadow-xs transition-transform ${
                      m.status === 'Active' ? 'translate-x-[18px]' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="text-right relative">
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === m.id ? null : m.id)}
                    aria-label={`Actions for ${m.name}`}
                    className="h-8 w-8 rounded-[9px] hover:bg-[#F1F5F9] text-[#64748B] flex items-center justify-center ml-auto cursor-pointer"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuId === m.id && (
                    <div className="absolute right-0 top-10 w-44 bg-white rounded-[14px] shadow-xl border border-slate-200 py-1 z-30 text-left">
                      {/*
                        "Resend Invitation" alerted that an email had been sent
                        to this address. Nothing was sent, and everyone in this
                        list has already joined — an invitation that is still
                        outstanding has no profile yet, so it never appears
                        here at all.
                      */}
                      {m.role === 'OWNER' ? (
                        <p className="px-3 py-2 text-xs font-medium text-slate-500">
                          The owner cannot be deactivated.
                        </p>
                      ) : (
                        <button
                          onClick={() => { void toggleStaffStatus(m); setActiveMenuId(null); }}
                          disabled={statusPendingId !== null}
                          className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 text-left disabled:opacity-50"
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
              onClick={closeInviteModal}
              className="absolute top-6 right-6 h-8 w-8 rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-slate-200 flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <Eyebrow className="mb-1">TEAM MANAGEMENT</Eyebrow>
              <h2 className="text-[21px] font-bold text-[#0F172A]">Invite a staff member</h2>
              {/* Said they would get an email. The invite endpoint sends none —
                  it mints a claim link and returns it. */}
              <p className="text-xs text-[#64748B] font-medium mt-1">
                You&apos;ll get a claim link to send them. It sets their own password and expires in
                seven days.
              </p>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-bold text-[#475569]">Work email address</label>
                <input
                  type="email"
                  required
                  placeholder="name@yourpractice.ng"
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 rounded-[10px] px-3 py-2">
                    <Check className="h-3.5 w-3.5" /> {inviteSuccess}
                  </div>
                  {inviteUrl && (
                    <div className="rounded-[12px] border border-slate-200 bg-[#F8FAFC] p-3 space-y-2">
                      <p className="text-[11px] font-bold text-[#475569] flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Send them this link
                      </p>
                      <p className="text-[11px] font-mono text-[#0F172A] break-all">{inviteUrl}</p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(inviteUrl)}
                        className="h-8 px-3 rounded-[10px] bg-white border border-[#E2E8F0] text-[11.5px] font-bold text-[#0F3A53] hover:bg-[#F1F5F9] cursor-pointer"
                      >
                        Copy link
                      </button>
                    </div>
                  )}
                </div>
              )}
              {inviteError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-amber-700 bg-amber-50 rounded-[10px] px-3 py-2"
                >
                  {inviteError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeInviteModal}
                  className="flex-1 h-[46px] rounded-[14px] bg-[#F1F5F9] text-[#475569] font-bold text-xs hover:bg-[#E2E8F0] cursor-pointer"
                >
                  {inviteSuccess ? 'Done' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isInviting || !!inviteSuccess}
                  className="os-brand-btn flex-[1.4] h-[46px] rounded-[14px] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer text-white disabled:opacity-60"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isInviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isInviting ? 'Creating…' : 'Create invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
