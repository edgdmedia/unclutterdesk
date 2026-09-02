import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, Plus, Edit2, MoreHorizontal, ChevronLeft, ChevronRight, X, User, Loader2 } from 'lucide-react';
import { Eyebrow, Card, StatusBadge, AvatarChip } from '@unclutterdesk/ui';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../utils/apiClient';
import type { Client } from '../App';

interface ClientsPageProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onRefresh: () => Promise<void>;
}

export function ClientsPage({ clients, setClients, onRefresh }: ClientsPageProps) {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Add Client Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCare, setFormCare] = useState('Individual Therapy');
  const [formStatus, setFormStatus] = useState('Active');
  const [formEmergency, setFormEmergency] = useState('');

  // Filter clients
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // KPIs
  const activeCount = clients.filter((c) => c.status === 'Active').length;
  const intakeCount = clients.filter((c) => c.status === 'Pending Intake').length;
  const pausedCount = clients.filter((c) => c.status === 'Paused').length;

  const kpis = [
    { label: 'Active clients', value: activeCount.toString() },
    { label: 'In intake', value: intakeCount.toString() },
    { label: 'Paused', value: pausedCount.toString() },
    { label: 'Total roster', value: clients.length.toString() },
  ];

  // Submit client to API
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) return;

    const [firstName, ...rest] = formName.trim().split(' ');
    const lastName = rest.join(' ') || undefined;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await api.post<Client>('/v1/tenant/clients', {
        firstName,
        lastName,
        email: formEmail,
        phone: formPhone || undefined,
        care: formCare,
        emergency: formEmergency || undefined,
      });

      // Optimistically add to local list, then trigger a refresh
      setClients((prev) => [created, ...prev]);
      await onRefresh();

      setShowAddModal(false);
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormCare('Individual Therapy');
      setFormStatus('Active');
      setFormEmergency('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
      {/* Top Header Bar */}
      <header className="h-[80px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] flex items-center justify-between gap-3 md:gap-5 shrink-0">
        <div>
          <Eyebrow>CASELOAD ROSTER</Eyebrow>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Clients</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-3 ml-auto">
          {/* Search Input */}
          <div className="hidden sm:flex h-[40px] bg-[#F1F5F9] border border-[#E2E8F0] rounded-[14px] px-3 items-center gap-2 w-[220px]">
            <Search className="h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="w-full bg-transparent text-xs font-medium text-[#0F172A] outline-none"
            />
          </div>

          <button className="hidden sm:flex h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] items-center gap-1.5 cursor-pointer">
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="os-brand-btn h-[40px] px-3 md:px-4 rounded-[14px] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">+ Add client</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-4 md:p-[24px_26px_30px] space-y-4 md:space-y-5 flex-1">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-3.5">
          {kpis.map((kpi, idx) => (
            <Card key={idx} padding="p-[16px_18px]">
              <Eyebrow>{kpi.label}</Eyebrow>
              <span className="text-[26px] font-extrabold tracking-[-0.03em] text-[#0F172A] block mt-1 leading-none">
                {kpi.value}
              </span>
            </Card>
          ))}
        </div>

        {/* Client Roster Table */}
        <Card padding="p-0" className="overflow-x-auto flex-none border border-[#E2E8F0] bg-white w-full">
          <div className="min-w-[800px]">
          {/* Table Header */}
          <div className="bg-[#FCFDFE] border-b border-[#E2E8F0] px-[22px] py-[14px] grid grid-cols-[2.2fr_1fr_0.7fr_1.1fr_0.9fr_90px] gap-4 items-center">
            <Eyebrow>CLIENT</Eyebrow>
            <Eyebrow>CARE TYPE</Eyebrow>
            <Eyebrow>SESSIONS</Eyebrow>
            <Eyebrow>NEXT SESSION</Eyebrow>
            <Eyebrow>STATUS</Eyebrow>
            <Eyebrow className="text-right">ACTIONS</Eyebrow>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[#F1F5F9]">
            {filteredClients.map((c) => (
              <Link
                key={c.id}
                to={`/dashboard/clients/${c.id}`}
                className="px-[22px] py-[14px] grid grid-cols-[2.2fr_1fr_0.7fr_1.1fr_0.9fr_90px] gap-4 items-center hover:bg-[#FCFDFE] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AvatarChip initials={c.initials} size="sm" />
                  <div>
                    <h3 className="text-[14px] font-bold text-[#0F172A] leading-tight">{c.name}</h3>
                    <p className="text-[11.5px] text-[#94A3B8] font-medium">{c.email}</p>
                  </div>
                </div>

                <span className="text-[13px] font-medium text-[#475569]">{c.care}</span>
                <span className="text-[13px] font-bold text-[#0F172A]">{c.sessions}</span>
                <span className="text-[13px] font-medium text-[#475569]">{c.next}</span>

                <div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="flex items-center gap-1 justify-end">
                  <button className="h-8 w-8 rounded-[9px] hover:bg-[#F1F5F9] text-[#64748B] flex items-center justify-center cursor-pointer">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button className="h-8 w-8 rounded-[9px] hover:bg-[#F1F5F9] text-[#64748B] flex items-center justify-center cursor-pointer">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </Link>
            ))}
          </div>

          {/* Table Footer */}
          <div className="p-[14px_22px] bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[12px] text-[#94A3B8] font-medium">
              Showing {filteredClients.length} of {clients.length} clients
            </span>
            <div className="flex items-center gap-1">
              <button className="h-[30px] px-3 rounded-[9px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#475569] flex items-center gap-1 hover:bg-[#F8FAFC] cursor-pointer">
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>
              <button className="h-[30px] px-3 rounded-[9px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#475569] flex items-center gap-1 hover:bg-[#F8FAFC] cursor-pointer">
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          </div>
        </Card>
      </main>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <form
            onSubmit={handleAddClient}
            className="w-full max-w-[460px] bg-white rounded-[24px] p-6 shadow-2xl space-y-4 border border-slate-200 relative"
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <User className="h-5 w-5" style={{ color: primaryColor }} />
              <h3 className="text-lg font-bold text-[#0F172A]">Add New Client</h3>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Full Name</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Amara Okoye"
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              />
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Phone Number</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. 0802 345 6789"
                  className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
                />
              </div>
            </div>

            {/* Care Type & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Care Type</label>
                <select
                  value={formCare}
                  onChange={(e) => setFormCare(e.target.value)}
                  className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
                >
                  <option value="Individual Therapy">Individual Therapy</option>
                  <option value="Couples Therapy">Couples Therapy</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Initial Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Pending Intake">Pending Intake</option>
                  <option value="Paused">Paused</option>
                </select>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Emergency Contact</label>
              <input
                type="text"
                value={formEmergency}
                onChange={(e) => setFormEmergency(e.target.value)}
                placeholder="e.g. Brother · Chidi Okoye · 0803 552 8814"
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              />
            </div>

            {/* Error message */}
            {submitError && (
              <p className="text-xs font-medium text-red-500 bg-red-50 rounded-[10px] px-3 py-2">{submitError}</p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-11 rounded-[14px] bg-[#F1F5F9] text-[#475569] font-bold text-xs hover:bg-[#E2E8F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: primaryColor }}
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isSubmitting ? 'Saving...' : 'Add Client'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
