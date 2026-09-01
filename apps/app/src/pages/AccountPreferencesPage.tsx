import React, { useState } from 'react';
import { Save, Download, Trash2, Monitor, Smartphone, Info } from 'lucide-react';
import { Eyebrow } from '@unclutterdesk/ui';

type DateFmt = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | '14 Aug 2026';
type TimeFmt = '24-hour' | '12-hour';
type WeekStart = 'Monday' | 'Sunday';
type NumFmt = '1,234.56' | '1.234,56';
type Currency = 'NGN' | 'GHS' | 'GBP' | 'USD';

const REVENUE: Record<Currency, string> = {
  NGN: '₦412,000',
  GHS: '₵5,940',
  GBP: '£3,180',
  USD: '$4,020',
};

function formatDate(fmt: DateFmt): string {
  switch (fmt) {
    case 'DD/MM/YYYY':
      return '14/08/2026';
    case 'MM/DD/YYYY':
      return '08/14/2026';
    case 'YYYY-MM-DD':
      return '2026-08-14';
    default:
      return '14 Aug 2026';
  }
}

function formatTime(fmt: TimeFmt): string {
  return fmt === '24-hour' ? '10:00' : '10:00 AM';
}

function Toggle({ on, onChange, w, h, knob }: { on: boolean; onChange: () => void; w: number; h: number; knob: number }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="relative rounded-full transition-colors cursor-pointer shrink-0"
      style={{ width: w, height: h, backgroundColor: on ? '#15803D' : '#CBD5E1' }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-transform duration-[180ms]"
        style={{ width: knob, height: knob, left: 4, transform: `translate(${on ? w - knob - 8 : 0}px, -50%)` }}
      />
    </button>
  );
}

const selectCls =
  'h-[46px] w-full px-[14px] rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-semibold text-[#0F172A] outline-none focus:bg-white focus:border-[#94A3B8] cursor-pointer';

function ChipGroup<T extends string>({ value, options, onSelect }: { value: T; options: T[]; onSelect: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onSelect(o)}
          className={`h-[42px] px-4 rounded-[13px] text-[13px] font-bold transition-all cursor-pointer ${
            value === o
              ? 'bg-[#0F3A53] text-white shadow-[0_6px_16px_rgba(15,58,83,0.22)]'
              : 'bg-white text-[#334155] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function AccountPreferencesPage() {
  const [email, setEmail] = useState('adaeze@okonkwotherapy.ng');
  const [language, setLanguage] = useState('English (Nigeria)');
  const [country, setCountry] = useState('Nigeria');
  const [timezone, setTimezone] = useState('GMT+1 Lagos');
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [dateFmt, setDateFmt] = useState<DateFmt>('DD/MM/YYYY');
  const [timeFmt, setTimeFmt] = useState<TimeFmt>('24-hour');
  const [week, setWeek] = useState<WeekStart>('Monday');
  const [numFmt, setNumFmt] = useState<NumFmt>('1,234.56');
  const [tfa, setTfa] = useState(true);
  const [channels, setChannels] = useState({ email: true, push: true, sms: false, digest: true });

  const toggleChannel = (k: keyof typeof channels) => setChannels((c) => ({ ...c, [k]: !c[k] }));

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      {/* 88px Header */}
      <header className="h-[88px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center gap-5 shrink-0">
        <div>
          <Eyebrow>ACCOUNT</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Account &amp; preferences</h1>
          <p className="text-xs text-[#64748B] font-medium">Sign-in, security, and how dates and money are shown to you</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11.5px] text-[#94A3B8] font-medium">Changes apply to your account only</span>
          <button className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-sm flex items-center gap-2 text-white cursor-pointer" style={{ backgroundColor: '#0F3A53' }}>
            <Save className="h-4 w-4" />
            Save preferences
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[24px_26px_32px] grid grid-cols-[minmax(0,1fr)_352px] gap-[20px] items-start">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          {/* Sign-in */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
            <Eyebrow className="mb-1">SIGN-IN</Eyebrow>
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[#0F172A] mb-5">How you access your account</h3>
            <div className="flex flex-col gap-[10px]">
              <div className="flex items-center gap-4 px-4 py-[14px] rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Email</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[13.5px] font-semibold text-[#0F172A]">{email}</span>
                    <span className="h-[18px] px-2 rounded-full bg-[#ECFDF5] text-[#059669] text-[9px] font-black tracking-[0.06em] uppercase flex items-center">
                      Verified
                    </span>
                  </div>
                </div>
                <button className="text-[12.5px] font-bold text-[#0F3A53] hover:underline cursor-pointer">Change</button>
              </div>

              <div className="flex items-center gap-4 px-4 py-[14px] rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Password</div>
                  <div className="mt-0.5 text-[13.5px] font-semibold text-[#0F172A]">Last changed 3 months ago</div>
                </div>
                <button className="text-[12.5px] font-bold text-[#0F3A53] hover:underline cursor-pointer">Change password</button>
              </div>

              <div className="flex items-center gap-4 px-4 py-[14px] rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Two-factor authentication</div>
                  <div className="mt-0.5 text-[13.5px] font-semibold text-[#0F172A]">Authenticator app · required for clinical records</div>
                </div>
                <Toggle on={tfa} onChange={() => setTfa((v) => !v)} w={52} h={30} knob={24} />
              </div>
            </div>
          </div>

          {/* Region & language */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
            <Eyebrow className="mb-1">REGION &amp; LANGUAGE</Eyebrow>
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[#0F172A] mb-5">Where you work</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Language</label>
                <select className={selectCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option>English (Nigeria)</option>
                  <option>English (UK)</option>
                  <option>English (US)</option>
                  <option>Français</option>
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Country</label>
                <select className={selectCls} value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option>Nigeria</option>
                  <option>Ghana</option>
                  <option>Kenya</option>
                  <option>United Kingdom</option>
                  <option>United States</option>
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Time zone</label>
                <select className={selectCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option>GMT+1 Lagos</option>
                  <option>GMT+0 London</option>
                  <option>GMT+3 Nairobi</option>
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-1.5">Currency</label>
                <select className={selectCls} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  <option value="NGN">NGN ₦</option>
                  <option value="GHS">GHS ₵</option>
                  <option value="GBP">GBP £</option>
                  <option value="USD">USD $</option>
                </select>
              </div>
            </div>
            <div className="mt-4 rounded-[14px] bg-[#F1F5F9] p-[12px_14px] flex items-start gap-2.5">
              <Info className="h-4 w-4 text-[#64748B] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[#64748B] font-medium leading-snug">
                Clients are always billed in the booking-page currency; this setting only converts what you see in reports.
              </p>
            </div>
          </div>

          {/* Date, time & numbers */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
            <Eyebrow className="mb-1">DATE, TIME &amp; NUMBERS</Eyebrow>
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[#0F172A] mb-5">How things are written</h3>

            <div className="space-y-5">
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-2">Date format</label>
                <ChipGroup value={dateFmt} options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', '14 Aug 2026']} onSelect={(v) => setDateFmt(v)} />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-2">Time format</label>
                <ChipGroup value={timeFmt} options={['24-hour', '12-hour']} onSelect={(v) => setTimeFmt(v)} />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-2">Week starts on</label>
                <ChipGroup value={week} options={['Monday', 'Sunday']} onSelect={(v) => setWeek(v)} />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#475569] mb-2">Number format</label>
                <ChipGroup value={numFmt} options={['1,234.56', '1.234,56']} onSelect={(v) => setNumFmt(v)} />
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[24px_26px]">
            <Eyebrow className="mb-1">DANGER ZONE</Eyebrow>
            <p className="mt-1 text-[13px] text-[#64748B] font-medium leading-snug">
              Clinical records are retained for 7 years regardless.
            </p>
            <div className="mt-4 flex gap-3">
              <button className="h-[42px] px-5 rounded-[13px] bg-white border border-[#E2E8F0] text-[#334155] text-[13px] font-bold flex items-center gap-2 hover:bg-[#F1F5F9] cursor-pointer">
                <Download className="h-4 w-4" />
                Export my data
              </button>
              <button className="h-[42px] px-5 rounded-[13px] bg-white border border-[#FCA5A5] text-[#DC2626] text-[13px] font-bold flex items-center gap-2 hover:bg-[#FEF2F2] cursor-pointer">
                <Trash2 className="h-4 w-4" />
                Deactivate account
              </button>
            </div>
          </div>
        </div>

        {/* Right column 352px */}
        <div className="flex flex-col gap-4">
          {/* Preview */}
          <div
            className="rounded-[24px] p-[24px_26px] shadow-[0_14px_40px_rgba(15,58,83,0.22)]"
            style={{ background: 'linear-gradient(135deg,#0F3A53,#1B5375)' }}
          >
            <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[#E3B341] block">PREVIEW</span>
            <div className="mt-3 flex flex-col">
              {[
                { label: 'NEXT SESSION', value: `${formatDate(dateFmt)} · ${formatTime(timeFmt)}` },
                { label: "THIS MONTH'S REVENUE", value: REVENUE[currency] },
                { label: 'WEEK VIEW STARTS', value: week },
              ].map((row, i) => (
                <React.Fragment key={row.label}>
                  {i > 0 && <div className="h-px bg-white/10" />}
                  <div className="py-[13px]">
                    <div className="text-[11px] font-bold text-[#94A3B8] tracking-[0.06em]">{row.label}</div>
                    <div className="mt-0.5 text-[19px] font-bold text-white">{row.value}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Notification channels */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px] shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
            <span className="text-[15px] font-bold text-[#0F172A]">Notification channels</span>
            <div className="mt-3 flex flex-col gap-3.5">
              {(
                [
                  { key: 'email' as const, name: 'Email', desc: 'Bookings, payments, forms' },
                  { key: 'push' as const, name: 'Push', desc: 'Browser and mobile app' },
                  { key: 'sms' as const, name: 'SMS', desc: 'Charged per message' },
                  { key: 'digest' as const, name: 'Weekly digest', desc: 'Sundays, 18:00' },
                ]
              ).map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-[#0F172A]">{c.name}</div>
                    <div className="text-[11.5px] text-[#94A3B8] font-medium">{c.desc}</div>
                  </div>
                  <Toggle on={channels[c.key]} onChange={() => toggleChannel(c.key)} w={48} h={28} knob={20} />
                </div>
              ))}
            </div>
            <p className="mt-3 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#94A3B8] font-medium">
              Full controls in Notifications settings.
            </p>
          </div>

          {/* Active sessions */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-[22px_24px] shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
            <span className="text-[15px] font-bold text-[#0F172A]">Active sessions</span>
            <div className="mt-3 flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 flex-none rounded-[12px] bg-[#EEF2F7] flex items-center justify-center">
                  <Monitor className="h-[17px] w-[17px] text-[#0F3A53]" />
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-[#0F172A]">MacBook Pro · Lagos</div>
                  <div className="text-[11.5px] text-[#059669] font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" /> This device · active now
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 flex-none rounded-[12px] bg-[#EEF2F7] flex items-center justify-center">
                  <Smartphone className="h-[17px] w-[17px] text-[#0F3A53]" />
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-[#0F172A]">iPhone 14 · Lagos</div>
                  <div className="text-[11.5px] text-[#94A3B8] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" /> Last active 6 hours ago
                  </div>
                </div>
              </div>
            </div>
            <button className="mt-3 text-[12px] font-bold text-[#DC2626] hover:underline cursor-pointer">
              Sign out of other sessions
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
