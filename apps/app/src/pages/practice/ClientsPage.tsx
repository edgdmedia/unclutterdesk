import React, { useState } from 'react';
import { Download, Plus, ChevronLeft, ChevronRight, X, User, Loader2 } from 'lucide-react';
import { Eyebrow, Card, StatusBadge, AvatarChip, useToast, Page, PageHeader, Grid, ResponsiveTable, sortRows, byText, byNumber, type Column, type SortState } from '@unclutterdesk/ui';
import { RouterLink } from '../../components/shell/RouterLink';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import type { Client } from '../../App';

interface ClientsPageProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onRefresh: () => Promise<void>;
}

export function ClientsPage({ clients, setClients, onRefresh }: ClientsPageProps) {
  const toast = useToast();
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  const [searchQuery, setSearchQuery] = useState('');
  // "Previous" and "Next" had no handlers: the list showed every client at
  // once and the pager was decoration. Paging it for real is what makes the
  // two buttons true.
  const [page, setPage] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Add Client Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCare, setFormCare] = useState('Individual Therapy');
  const [formStatus, setFormStatus] = useState('Active');
  const [formEcName, setFormEcName] = useState('');
  const [formEcRelationship, setFormEcRelationship] = useState('');
  const [formEcPhone, setFormEcPhone] = useState('');

  const [sort, setSort] = useState<SortState | null>(null);

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client',
      sort: byText((c) => c.name),
      // The flexible column: takes the remaining width and truncates, so a
      // long email never forces the table past the screen.
      className: 'w-full max-w-0',
      cell: (c) => (
        <span className="flex items-center gap-3 min-w-0">
          <AvatarChip initials={c.initials} size="sm" />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-[#0F172A] leading-tight truncate">{c.name}</span>
            <span className="block text-[11.5px] text-[#94A3B8] font-medium truncate">{c.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'next', header: 'Next session', cell: (c) => <span className="text-[13px] font-medium text-[#475569]">{c.next}</span> },
    { key: 'care', header: 'Care type', priority: 'md', cell: (c) => <span className="text-[13px] font-medium text-[#475569]">{c.care}</span>, sort: byText((c) => c.care) },
    { key: 'sessions', header: 'Sessions', priority: 'md', align: 'end', cell: (c) => <span className="text-[13px] font-bold text-[#0F172A]">{c.sessions}</span>, sort: byNumber((c) => Number(c.sessions)) },
    { key: 'status', header: 'Status', priority: 'lg', cell: (c) => <StatusBadge status={c.status} />, sort: byText((c) => c.status) },
  ];

  // Search, then sort, then page: sorting covers every client, not only the 25 on screen.
  const q = searchQuery.trim().toLowerCase();
  const filteredClients = q ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : clients;
  const sortedClients = sortRows(filteredClients, columns, sort);

  const PAGE_SIZE = 25;
  const lastPage = Math.max(0, Math.ceil(sortedClients.length / PAGE_SIZE) - 1);
  // A search that shortens the list can strand the reader past the end.
  const currentPage = Math.min(page, lastPage);
  const pageStart = currentPage * PAGE_SIZE;
  const pageClients = sortedClients.slice(pageStart, pageStart + PAGE_SIZE);

  const onSearch = (value: string) => {
    setSearchQuery(value);
    setPage(0);
  };

  /**
   * The roster as a CSV.
   *
   * "Export" had no handler — a button that looked enabled, took the click and
   * did nothing. It exports the rows being shown, matching the current search,
   * from data already in the browser.
   *
   * Deliberately no clinical content: this is a roster, and a spreadsheet in a
   * downloads folder is the wrong place for session notes.
   */
  function exportClients() {
    const rows = [
      ['Name', 'Email', 'Care type', 'Sessions', 'Next session', 'Status'],
      ...sortedClients.map((c) => [c.name, c.email, c.care, String(c.sessions), c.next, c.status]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => (/[",\n]/.test(cell ?? '') ? `"${String(cell).replace(/"/g, '""')}"` : cell ?? ''))
          .join(','),
      )
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

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
        emergencyContact: formEcName ? { name: formEcName, relationship: formEcRelationship, phone: formEcPhone } : undefined,
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
      setFormEcName('');
      setFormEcRelationship('');
      setFormEcPhone('');
      toast.success('Client added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the client');
      setSubmitError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Page
      header={
        <PageHeader
          eyebrow="CASELOAD ROSTER"
          title="Clients"
          actions={
            <button
              onClick={() => setShowAddModal(true)}
              className="os-brand-btn h-[40px] px-3 md:px-4 rounded-[14px] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="h-4 w-4" />
              <span>Add client</span>
            </button>
          }
          secondaryActions={
            <button
              type="button"
              onClick={exportClients}
              disabled={filteredClients.length === 0}
              className="flex h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          }
        />
      }
    >
      <Grid cols={{ base: 2, lg: 4 }}>
        {kpis.map((kpi, idx) => (
          <Card key={idx} padding="p-[16px_18px]">
            <Eyebrow>{kpi.label}</Eyebrow>
            <span className="text-[26px] font-extrabold tracking-[-0.03em] text-[#0F172A] block mt-1 leading-none">{kpi.value}</span>
          </Card>
        ))}
      </Grid>

      <Card padding="p-0" className="overflow-hidden border border-[#E2E8F0] bg-white">
        <ResponsiveTable<Client>
          caption="Clients"
          rows={pageClients}
          rowKey={(c) => c.id}
          rowLabel={(c) => c.name}
          columns={columns}
          rowHref={(c) => `/dashboard/clients/${c.id}`}
          LinkComponent={RouterLink}
          sort={sort}
          onSortChange={setSort}
          filter={{ placeholder: 'Search clients', query: searchQuery, onQueryChange: onSearch }}
          empty="No clients yet."
          footer={
            <div className="p-[14px_22px] bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-[#94A3B8] font-medium">
                {sortedClients.length === 0
                  ? `No clients${q ? ' match that search' : ' yet'}`
                  : `Showing ${pageStart + 1}–${pageStart + pageClients.length} of ${sortedClients.length}${
                      sortedClients.length !== clients.length ? ` (filtered from ${clients.length})` : ''
                    }`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="h-[30px] px-3 rounded-[9px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#475569] flex items-center gap-1 hover:bg-[#F8FAFC] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(lastPage, currentPage + 1))}
                  disabled={currentPage >= lastPage}
                  className="h-[30px] px-3 rounded-[9px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#475569] flex items-center gap-1 hover:bg-[#F8FAFC] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          }
        />
      </Card>

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
            <Grid cols={{ base: 1, sm: 2 }} gap="sm">
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
            </Grid>

            {/* Care Type & Status */}
            <Grid cols={{ base: 1, sm: 2 }} gap="sm">
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
            </Grid>

            {/* Emergency Contact */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Emergency contact name</label>
              <input
                type="text"
                value={formEcName}
                onChange={(e) => setFormEcName(e.target.value)}
                placeholder="e.g. Chidi Okoye"
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Relationship</label>
              <input
                type="text"
                value={formEcRelationship}
                onChange={(e) => setFormEcRelationship(e.target.value)}
                placeholder="e.g. Brother"
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Phone</label>
              <input
                type="tel"
                value={formEcPhone}
                onChange={(e) => setFormEcPhone(e.target.value)}
                placeholder="e.g. 0803 552 8814"
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
    </Page>
  );
}
