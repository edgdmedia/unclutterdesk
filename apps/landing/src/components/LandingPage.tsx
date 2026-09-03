import React, { useState, useEffect } from 'react';

const PRESETS = [
  { name: "Deep navy", primary: "#0F3A53", secondary: "#E3B341" },
  { name: "Signal blue", primary: "#007BFF", secondary: "#6F42C1" },
  { name: "Calm teal", primary: "#0E7490", secondary: "#F59E0B" },
  { name: "Deep violet", primary: "#7C3AED", secondary: "#EC4899" },
  { name: "Forest", primary: "#15803D", secondary: "#B45309" }
];

const VALUE_CARDS = [
  { title: "100% White-Label Portal", body: "Your brand, your booking link, your client experience. Launch with your own practice subdomain and connect a custom domain for a fully branded front door.", icon1: true, icon2: false, icon3: false },
  { title: "Telehealth, Notes, and Assessments", body: "Run secure Jitsi or Google Meet sessions, capture SOAP notes with live autosave, and keep PHQ-9 and GAD-7 results attached to the client record.", icon1: false, icon2: true, icon3: false },
  { title: "Direct Paystack Bank Payouts", body: "Take bookings, collect payments, and route payouts directly to your bank account with no platform commission on session revenue.", icon1: false, icon2: false, icon3: true }
];

const TABS = [
  {
    label: "Client Scheduling & Availability",
    eyebrow: "SCHEDULING",
    title: "Availability you set once, bookings that fill themselves.",
    body: "Publish weekly availability, session lengths, and booking rules once. Clients choose a slot, pay through Paystack, and receive reminders while the session lands in your calendar.",
    bullets: ["Recurring rules and blackout dates", "Automatic email and in-app reminders", "Reschedule and cancellation policies"]
  },
  {
    label: "Intake, Consent & Assessments",
    eyebrow: "ASSESSMENTS",
    title: "Capture intake, consent, and scored assessments in one flow.",
    body: "Build intake and consent forms, then use launch-ready PHQ-9 and GAD-7 assessments with automatic scoring. Results stay attached to the client record so therapists have context before the session starts.",
    bullets: ["Conditional logic and required consent", "Auto-scored PHQ-9 and GAD-7", "Assessment results stored in the client file"]
  },
  {
    label: "Team Roles & Oversight",
    eyebrow: "TEAMS",
    title: "Run a clinic with the right access for each role.",
    body: "Give owners, admins, therapists, and receptionists the access they need. Front desk can manage bookings, therapists keep ownership of clinical notes, and clinic leaders maintain visibility across practice activity.",
    bullets: ["Owner, admin, therapist, and receptionist roles", "Clinical notes stay with the treating therapist", "Practice-wide visibility and reporting"]
  }
];

const TRUST_STRIP = ["No card required", "NDPR compliant", "Paystack verified"];

const PLANS = [
  {
    tier: "STARTER", price: "₦5,000", fee: "/month", cta: "Start 14-day trial", dark: false, popular: false,
    blurb: "For a solo practitioner getting started with a branded practice workflow.",
    features: ["1 practitioner", "Up to 25 bookings per month", "Jitsi telehealth", "Google Calendar sync", "Email support"]
  },
  {
    tier: "PRO SOLO", price: "₦15,000", fee: "/month", cta: "Start 14-day trial", dark: true, popular: true,
    blurb: "For a growing private practice ready to own its brand and client experience.",
    features: ["Unlimited sessions", "Custom domain (CNAME)", "1 receptionist login", "Auto-scored PHQ-9 and GAD-7", "0% payout fee"]
  },
  {
    tier: "CLINIC", price: "From ₦45,000", fee: "/month", cta: "Talk to sales", dark: false, popular: false,
    blurb: "For multi-therapist clinics that need shared visibility and operational support.",
    features: ["2-5 therapists", "Owner/admin/therapist/reception roles", "Clinic-wide revenue analytics", "Priority support", "Dedicated onboarding"]
  }
];

const FAQS = [
  ["What is included in each plan?", "Starter includes core scheduling, Jitsi telehealth, and email support. Pro Solo adds unlimited sessions, custom domain, and auto-scored assessments. Clinic plans include team access, role management, and analytics."],
  ["Can I upgrade or downgrade my plan?", "Yes, you can upgrade or downgrade anytime. Changes take effect at the next billing cycle."],
  ["Do you store clinical notes securely?", "Yes. All clinical notes are encrypted at rest and meet NDPR requirements for therapist-client confidentiality."],
  ["How does Paystack payout work?", "Payments from clients are processed through Paystack and settled to your bank account within 24 hours."],
  ["Do you offer a free trial?", "Yes, all plans include a 14-day free trial with no credit card required."],
  ["What happens if I cancel my subscription?", "Your data remains accessible for download for 30 days after cancellation. No additional charges apply."]
];

function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

export function LandingPage() {
  const [swatch, setSwatch] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [service, setService] = useState(0);
  const [slot, setSlot] = useState(1);
  const [plan, setPlan] = useState(1);
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setSwatch((prev) => (prev + 1) % PRESETS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const p = PRESETS[swatch];
  const primary = p.primary;
  const secondary = p.secondary;
  const primaryTint = tint(primary, 0.86);
  const secondaryTint = tint(secondary, 0.86);

  const activeTabContent = TABS[activeTab];

  const calendarDays = Array.from({ length: 35 }, (_, i) => {
    const day = i - 2;
    const inMonth = day >= 1 && day <= 30;
    const sel = day === 14;
    return {
      label: inMonth ? String(day) : "",
      bg: sel ? primary : "transparent",
      fg: sel ? "#fff" : (inMonth ? "#334155" : "#CBD5E1"),
      weight: sel ? "700" : "500"
    };
  });

  const timeSlots = ["09:00 — 09:50", "11:00 — 11:50", "14:00 — 14:50", "16:00 — 16:50"];
  const serviceOptions = [
    { name: "Individual Therapy", detail: "50 minutes · Online or in-person", price: "₦35,000" },
    { name: "Couples Therapy", detail: "80 minutes · Online or in-person", price: "₦45,000" }
  ];

  const toggleFaq = (i: number) => {
    setFaqOpen(prev => ({ ...prev, [i]: !prev[i] }));
  };

  const appBaseUrl = import.meta.env.DEV
    ? "http://app.localhost:5173"
    : "https://app.unclutterdesk.com";
  const loginUrl = `${appBaseUrl}/login`;
  const registerUrl = `${appBaseUrl}/register`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#0F172A]">
      {/* Navigation */}
      <header className="sticky top-0 z-50 h-[76px] px-4 md:px-10 flex items-center gap-7 bg-white/85 backdrop-blur-[18px] border-b border-[#E2E8F0]">
        <img src="/unclutterdesk-lockup.svg" alt="unclutter desk" className="h-8 md:h-9 w-auto shrink-0 object-contain" />
        <nav className="hidden md:flex ml-auto items-center gap-7">
          <a href="#features" className="text-[14px] font-[600] text-[#64748B] hover:text-[#0F172A] transition-colors">Features</a>
          <a href="#pricing" className="text-[14px] font-[600] text-[#64748B] hover:text-[#0F172A] transition-colors">Pricing</a>
          <a href="#faq" className="text-[14px] font-[600] text-[#64748B] hover:text-[#0F172A] transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-3 ml-auto md:ml-0">
          <a href={loginUrl} className="flex items-center justify-center h-11 px-[18px] rounded-[14px] bg-white border border-[#CBD5E1] text-[#24614F] text-[14px] font-[700] hover:bg-gray-50 transition-colors">Log in</a>
          <a href={registerUrl} className="flex items-center justify-center h-11 px-[22px] rounded-[14px] bg-[#24614F] border-none text-white text-[14px] font-[700] shadow-[0_6px_18px_rgba(36,97,79,0.22)] hover:bg-[#1C4E3F] transition-colors">Start free trial</a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#F8FAFC] pt-[72px] px-4 md:px-10 overflow-hidden">
        <div className="max-w-[760px] mx-auto text-center flex flex-col items-center gap-5">
          <div className="h-7 px-3.5 rounded-full bg-[#DDEDE6] text-[#1C4E3F] text-[11px] font-[800] tracking-[0.08em] inline-flex items-center uppercase">
            Practice Management & Telehealth for Therapists in Nigeria
          </div>
          <h1 className="m-0 text-[36px] md:text-[46px] leading-[1.08] font-[800] tracking-[-0.035em] text-[#0F172A] text-balance">
            Your own branded therapy practice. Zero platform fees.
          </h1>
          <p className="m-0 text-[15px] md:text-[16.5px] leading-[1.62] text-[#64748B] max-w-[620px] text-pretty">
            Give your clients a branded booking experience under your own domain. Manage scheduling, live SOAP notes, PHQ-9 and GAD-7 assessments, secure telehealth sessions, and direct Paystack payouts from one calm workspace.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1 w-full sm:w-auto">
            <a href={registerUrl} className="w-full sm:w-auto h-[52px] px-7 rounded-[16px] bg-[#24614F] border-none text-white text-[15px] font-[700] flex items-center justify-center gap-2.5 shadow-[0_10px_26px_rgba(36,97,79,0.26)] hover:bg-[#1C4E3F] transition-colors cursor-pointer">
              Start Free 14-Day Trial
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>
            </a>
            <a href="#features" className="w-full sm:w-auto h-[52px] px-6 rounded-[16px] bg-white border border-[#CBD5E1] text-[#24614F] text-[15px] font-[700] flex items-center justify-center gap-2.5 hover:bg-gray-50 transition-colors cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24614F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 4 14 8-14 8z"></path></svg>
              Watch 2-Min Demo
            </a>
          </div>
          <div className="flex items-center justify-center gap-[22px] flex-wrap mt-2">
            {TRUST_STRIP.map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#64748B]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#24614F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7"></path></svg>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Product Mockup */}
        <div className="max-w-[980px] w-full mx-auto mt-12 rounded-[24px] overflow-hidden bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] hidden md:block group cursor-pointer relative transition-all duration-300 hover:shadow-[0_30px_90px_rgba(15,23,42,0.20)] hover:-translate-y-1">
          <div className="absolute inset-0 z-10 pointer-events-none rounded-[24px] ring-2 ring-transparent group-hover:ring-[#24614F] transition-all"></div>
          
          <div className="h-11 bg-[#F1F5F9] border-b border-[#E2E8F0] flex items-center px-4 gap-[7px]">
            <span className="w-[11px] h-[11px] rounded-full bg-[#FB7185]"></span>
            <span className="w-[11px] h-[11px] rounded-full bg-[#FCD34D]"></span>
            <span className="w-[11px] h-[11px] rounded-full bg-[#6EE7B7]"></span>
            <div className="mx-auto h-[26px] px-3.5 rounded-full bg-white border border-[#E2E8F0] flex items-center gap-[7px] text-[11.5px] text-[#64748B]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>
              booking.smiththerapy.ng
            </div>
          </div>

          <div 
            className="pt-[34px] px-10 pb-[30px] flex flex-col items-center gap-3 text-center transition-colors duration-500"
            style={{ background: `linear-gradient(120deg, ${primaryTint}, ${secondaryTint})` }}
          >
            <div 
              className="w-[82px] h-[82px] rounded-[26px] bg-white text-[26px] font-[800] flex items-center justify-center shadow-[0_10px_26px_rgba(15,23,42,0.1)] transition-colors duration-500"
              style={{ color: primary }}
            >
              JS
            </div>
            <div className="text-[11px] font-[900] tracking-[0.2em] transition-colors duration-500" style={{ color: primary }}>
              DR. JANE SMITH THERAPY
            </div>
            <div className="h-[22px] px-2.5 rounded-full text-white text-[11px] font-[800] tracking-[0.06em] inline-flex items-center transition-colors duration-500" style={{ backgroundColor: secondary }}>
              CLINICAL PSYCHOLOGY
            </div>
            <h2 className="mt-0.5 mb-0 text-[30px] font-[800] tracking-[-0.03em] text-[#0F172A]">
              Book a session with Dr. Jane Smith
            </h2>
            <div className="flex gap-2.5 pt-1">
              <span className="h-[30px] px-3.5 rounded-full bg-white/75 text-[12px] font-[600] text-[#334155] inline-flex items-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#2E7A63" stroke="#2E7A63" strokeWidth="1" className="mr-1.5"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 6.9L12 17l-6.3 3.8 1.7-6.9L2 9.2l7.1-.6z"></path></svg>
                4.9 · 214 reviews
              </span>
              <span className="h-[30px] px-3.5 rounded-full bg-white/75 text-[12px] font-[600] text-[#334155] inline-flex items-center">
                Lagos, Nigeria · Online & in-person
              </span>
              <span className="h-[30px] px-3.5 rounded-full bg-white/75 text-[12px] font-[600] text-[#334155] inline-flex items-center">
                Licensed · 12 years practising
              </span>
            </div>
          </div>

          <div className="bg-[#FCFDFE] pt-[30px] px-10 pb-[36px] flex flex-col gap-[26px] relative z-20">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full text-white text-[11px] font-[800] flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: primary }}>1</span>
                <span className="text-[15px] font-[700] text-[#0F172A]">Choose a service</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {serviceOptions.map((s, i) => (
                  <div 
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setService(i); }}
                    className="bg-white rounded-[20px] p-5 cursor-pointer flex flex-col gap-1.5 transition-all hover:border-[#24614F] hover:shadow-md"
                    style={{ border: i === service ? `2px solid ${primary}` : "1px solid #E2E8F0" }}
                  >
                    <div className="text-[15px] font-[700] text-[#0F172A]">{s.name}</div>
                    <div className="text-[12.5px] text-[#64748B]">{s.detail}</div>
                    <div className="text-[24px] font-[800] tracking-[-0.03em] text-[#0F172A] pt-0.5">{s.price}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full text-white text-[11px] font-[800] flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: primary }}>2</span>
                <span className="text-[15px] font-[700] text-[#0F172A]">Pick a date & time</span>
              </div>
              <div className="grid grid-cols-[1fr_240px] gap-5">
                <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[18px] grid grid-cols-7 gap-1.5">
                  {calendarDays.map((c, i) => (
                    <div 
                      key={i}
                      className="h-[34px] rounded-[10px] text-[12px] flex items-center justify-center transition-colors duration-500 cursor-pointer hover:bg-slate-100"
                      style={{ backgroundColor: c.bg, color: c.fg, fontWeight: c.weight }}
                    >
                      {c.label}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2.5">
                  {timeSlots.map((t, i) => {
                    const sel = i === slot;
                    return (
                      <div 
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setSlot(i); }}
                        className="h-[42px] rounded-full text-[13px] font-[600] flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                        style={{ 
                          backgroundColor: sel ? primary : "#fff",
                          color: sel ? "#fff" : "#334155",
                          border: sel ? `1px solid ${primary}` : "1px solid #E2E8F0"
                        }}
                      >
                        {t}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full text-white text-[11px] font-[800] flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: primary }}>3</span>
                <span className="text-[15px] font-[700] text-[#0F172A]">Your details</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="h-[46px] rounded-[14px] border border-[#E2E8F0] bg-white flex items-center px-4 text-[14px] text-[#334155] cursor-pointer hover:border-[#CBD5E1]">Adaeze Okonkwo</div>
                <div className="h-[46px] rounded-[14px] border border-[#E2E8F0] bg-white flex items-center px-4 text-[14px] text-[#334155] cursor-pointer hover:border-[#CBD5E1]">adaeze@email.com</div>
              </div>
            </div>
          </div>
          <div className="text-center pb-4 text-[10px] text-[#94A3B8] opacity-70 bg-[#FCFDFE]">Booking powered by Unclutter Desk</div>
        </div>
        <div className="text-center text-[12px] text-[#64748B] pt-3.5 pb-[60px] hidden md:block">The client-facing booking page — entirely in your brand. No Desk chrome, ever.</div>
      </section>

      {/* Value Cards */}
      <section className="px-4 pb-10 md:pb-[80px] md:px-10 bg-[#F8FAFC]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {VALUE_CARDS.map((v, i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-[24px] p-7 text-left flex flex-col gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-[#DDEDE6] flex items-center justify-center">
                {v.icon1 && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#24614F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M3 9h18"></path><path d="M8 14h6"></path></svg>}
                {v.icon2 && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#24614F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10.5V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3.5l7 4.5V6z"></path></svg>}
                {v.icon3 && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#24614F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="3"></rect><circle cx="12" cy="12" r="2.5"></circle><path d="M6 12h.01M18 12h.01"></path></svg>}
              </div>
              <div className="text-[17px] font-[700] text-[#0F172A] tracking-[-0.02em]">{v.title}</div>
              <p className="m-0 text-[13.5px] leading-[1.6] text-[#64748B] text-pretty">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Showcase (Tabs) */}
      <section id="features" className="px-4 py-12 md:py-[80px] md:px-10 bg-white text-center">
        <div className="text-[9px] font-[900] tracking-[0.22em] text-[#94A3B8]">EVERYTHING THE PRACTICE RUNS ON</div>
        <h2 className="mt-3 mb-0 text-[26px] md:text-[34px] font-[800] tracking-[-0.035em] text-[#0F172A]">One workspace, from first enquiry to final note.</h2>

        <div className="max-w-[1100px] mx-auto mt-10 flex flex-row overflow-x-auto gap-2 md:gap-4 justify-start md:justify-center border-b border-[#E2E8F0] pb-0 hide-scrollbar snap-x">
          {TABS.map((tb, i) => {
            const isActive = i === activeTab;
            return (
              <button 
                key={i}
                onClick={() => setActiveTab(i)}
                className="px-5 py-3.5 bg-transparent border-none text-[14px] font-[700] cursor-pointer -mb-px transition-colors whitespace-nowrap shrink-0 snap-center hover:bg-gray-50"
                style={{ 
                  borderBottom: isActive ? "2px solid #24614F" : "2px solid transparent",
                  color: isActive ? "#0F172A" : "#94A3B8"
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        <div className="max-w-[1100px] mx-auto mt-9 p-6 md:p-11 rounded-[24px] bg-[#F8FAFC] border border-[#E2E8F0] text-left grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col gap-3.5">
            <div className="text-[9px] font-[900] tracking-[0.22em] text-[#94A3B8] uppercase">{activeTabContent.eyebrow}</div>
            <h3 className="m-0 text-[23px] font-[800] tracking-[-0.03em] text-[#0F172A]">{activeTabContent.title}</h3>
            <p className="m-0 text-[14.5px] leading-[1.65] text-[#64748B] text-pretty">{activeTabContent.body}</p>
          </div>
          <div className="flex flex-col gap-3.5">
            {activeTabContent.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-white border border-[#E2E8F0] rounded-[16px] p-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#24614F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px"><path d="m5 13 4 4L19 7"></path></svg>
                <span className="text-[14px] leading-[1.4] text-[#334155]">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* White-label Section */}
      <section className="mx-4 md:mx-10 mb-12 md:mb-[80px] p-6 md:p-12 bg-[#0F172A] rounded-[24px] md:rounded-[40px] flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_460px] gap-10 md:gap-12 items-center overflow-hidden">
        <div className="flex flex-col gap-4">
          <div className="text-[9px] font-[900] tracking-[0.22em] text-[#B08320]">TRULY WHITE-LABEL</div>
          <h2 className="m-0 text-[28px] md:text-[34px] font-[800] tracking-[-0.035em] text-[#F8FAFC] text-balance">Your brand everywhere your clients are.</h2>
          <p className="m-0 text-[15px] leading-[1.65] text-[#94A3B8] text-pretty">
            Pick two colours in Brand Settings and the entire client experience — booking page, confirmation screen, client portal — updates live. Your clients never see "Unclutter Desk".
          </p>
          <div className="bg-white rounded-[20px] p-4.5 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 max-w-[520px] mt-2 p-5">
            <span className="h-[22px] px-2.5 rounded-full bg-[#F0FDF4] text-[#16A34A] text-[9px] font-[900] tracking-[0.12em] inline-flex items-center shrink-0">VERIFIED</span>
            <span className="text-[13.5px] leading-[1.55] text-[#0F172A]">
              Point your CNAME at <span className="font-mono text-[12.5px] bg-[#F1F5F9] px-1.5 py-0.5 rounded-md">cname.unclutterdesk.com</span> to run the whole thing on <span className="font-mono text-[12.5px] bg-[#F1F5F9] px-1.5 py-0.5 rounded-md">booking.yourpractice.com</span>.
            </span>
          </div>
        </div>
        
        {/* Inline Carousel for Brands */}
        <div className="flex flex-row overflow-x-auto gap-4 w-full hide-scrollbar snap-x relative py-2 pr-4 md:pr-0" style={{ scrollBehavior: 'smooth' }}>
          {PRESETS.map((s, i) => {
            const sel = i === swatch;
            return (
              <div 
                key={i}
                onClick={() => setSwatch(i)}
                className="rounded-[20px] overflow-hidden bg-white cursor-pointer transition-all shrink-0 snap-center w-[280px]"
                style={{ 
                  border: sel ? "2px solid #24614F" : "2px solid transparent",
                  boxShadow: sel ? "0 14px 34px rgba(0,0,0,.35)" : "none",
                  opacity: sel ? 1 : 0.8,
                  transform: sel ? "scale(1)" : "scale(0.96)"
                }}
              >
                <div 
                  className="py-3.5 px-4 flex items-center gap-3.5 transition-colors duration-500"
                  style={{ background: `linear-gradient(120deg, ${tint(s.primary, 0.86)}, ${tint(s.secondary, 0.86)})` }}
                >
                  <span 
                    className="w-14 h-14 rounded-[18px] bg-white text-[18px] font-[800] flex items-center justify-center shrink-0 transition-colors duration-500"
                    style={{ color: s.primary }}
                  >
                    JS
                  </span>
                  <div className="flex-1 flex flex-col gap-[7px]">
                    <span className="h-[9px] w-[60%] rounded-full transition-colors duration-500" style={{ backgroundColor: s.primary }}></span>
                    <span className="h-[9px] w-[38%] rounded-full bg-slate-900/20"></span>
                  </div>
                </div>
                <div className="py-2.5 px-4 flex items-center gap-2.5">
                  <span className="text-[12.5px] font-[700] text-[#0F172A] flex-1">{s.name}</span>
                  <span className="font-mono text-[11px] uppercase px-2 py-1 rounded-lg bg-[#F1F5F9] text-[#334155]">{s.primary}</span>
                  <span className="font-mono text-[11px] uppercase px-2 py-1 rounded-lg bg-[#F1F5F9] text-[#334155]">{s.secondary}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 py-12 md:py-[80px] md:px-10 bg-[#F8FAFC] text-center">
        <div className="text-[9px] font-[900] tracking-[0.22em] text-[#94A3B8]">PRICING</div>
        <h2 className="mt-3 mb-2 text-[26px] md:text-[34px] font-[800] tracking-[-0.035em] text-[#0F172A]">Simple, transparent pricing. No hidden fees.</h2>
        <p className="m-0 text-[15px] text-[#64748B]">Every plan keeps 0% of your session revenue. Cancel any time.</p>

        <div className="max-w-[1200px] mx-auto mt-11 flex flex-col md:grid md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((pl, i) => {
            const current = i === plan;
            const cardBg = pl.dark ? "#0F172A" : "#fff";
            const border = pl.dark ? "2px solid #8A5A3C" : (current ? "2px solid #24614F" : "1px solid #E2E8F0");
            const shadow = pl.dark ? "0 20px 50px rgba(15,23,42,.22)" : "none";
            const eyebrow = pl.dark ? "#4A9781" : "#94A3B8";
            const priceColor = pl.dark ? "#F8FAFC" : "#0F172A";
            const muted = pl.dark ? "#94A3B8" : "#64748B";
            const featColor = pl.dark ? "#E2E8F0" : "#475569";
            const tick = pl.dark ? "#4A9781" : "#24614F";
            const btnBg = pl.dark ? "#fff" : "#24614F";
            const btnFg = pl.dark ? "#24614F" : "#fff";
            const btnBorder = pl.dark ? "none" : "none";
            const btnShadow = pl.dark ? "0 6px 18px rgba(0,0,0,.25)" : "0 4px 12px rgba(36,97,79,0.15)";

            return (
              <div 
                key={i}
                onClick={() => setPlan(i)}
                className="relative p-8 rounded-[24px] cursor-pointer text-left flex flex-col gap-4 transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ backgroundColor: cardBg, border, boxShadow: shadow }}
              >
                {pl.popular && (
                  <span className="absolute top-[22px] right-[22px] h-6 px-3 rounded-full bg-[#8A5A3C] text-white text-[10px] font-[800] tracking-[0.08em] inline-flex items-center">
                    MOST POPULAR
                  </span>
                )}
                {current && (
                  <span className="absolute -top-[11px] left-[32px] h-[22px] px-3 rounded-full bg-[#24614F] text-white text-[10px] font-[800] tracking-[0.1em] inline-flex items-center">
                    CURRENT PLAN
                  </span>
                )}
                <div className="text-[9px] font-[900] tracking-[0.22em]" style={{ color: eyebrow }}>{pl.tier}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] font-[800] tracking-[-0.02em]" style={{ color: priceColor }}>{pl.price}</span>
                  <span className="text-[13px]" style={{ color: muted }}>{pl.fee}</span>
                </div>
                <p className="m-0 text-[13.5px] leading-[1.55]" style={{ color: muted }}>{pl.blurb}</p>
                <div className="flex-1 flex flex-col gap-[11px] py-1.5">
                  {pl.features.map((f, j) => (
                    <div key={j} className="flex items-start gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tick} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="m5 13 4 4L19 7"></path></svg>
                      <span className="text-[14px] leading-[1.4]" style={{ color: featColor }}>{f}</span>
                    </div>
                  ))}
                </div>
                <a 
                  href={registerUrl}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center h-12 rounded-[14px] text-[14px] font-[700] transition-colors hover:opacity-90"
                  style={{ backgroundColor: btnBg, border: btnBorder, color: btnFg, boxShadow: btnShadow }}
                >
                  {pl.cta}
                </a>
              </div>
            );
          })}
        </div>
        <div className="text-[12.5px] text-[#94A3B8] pt-6">All prices in Nigerian Naira. Paystack handles billing; payouts settle to your bank in 24 hours.</div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="px-4 pb-12 md:pb-[80px] md:px-10 bg-[#F8FAFC] text-center">
        <div className="text-[9px] font-[900] tracking-[0.22em] text-[#94A3B8]">FAQ</div>
        <h2 className="mt-3 mb-0 text-[26px] md:text-[34px] font-[800] tracking-[-0.035em] text-[#0F172A]">Good to know.</h2>
        <div className="max-w-[760px] mx-auto mt-8 flex flex-col gap-3 text-left">
          {FAQS.map(([q, a], i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-[20px] overflow-hidden transition-all hover:border-[#CBD5E1]">
              <div 
                onClick={() => toggleFaq(i)}
                className="flex items-center gap-4 py-4 px-5 cursor-pointer select-none"
              >
                <span className="flex-1 text-[14px] font-[700] text-[#0F172A]">{q}</span>
                <svg 
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" 
                  className="transition-transform duration-200"
                  style={{ transform: faqOpen[i] ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </div>
              {faqOpen[i] && (
                <p className="m-0 px-5 pb-5 text-[13.5px] leading-[1.65] text-[#64748B] text-pretty border-t border-[#E2E8F0] pt-4">
                  {a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Bottom Section */}
      <section className="px-4 pb-12 md:pb-[80px] md:px-10 bg-[#F8FAFC]">
        <div className="max-w-[1240px] mx-auto rounded-[24px] md:rounded-[32px] bg-gradient-to-br from-[#24614F] to-[#1C4E3F] p-8 md:p-[64px] text-center shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="text-[9px] font-[900] tracking-[0.22em] text-[#7DB8A5]">NO CREDIT CARD REQUIRED</div>
          <h2 className="mt-3.5 mb-2.5 text-[28px] md:text-[34px] font-[800] tracking-[-0.035em] text-[#F8FAFC] text-balance">Launch your branded booking portal today.</h2>
          <p className="mt-0 mb-6 text-[15px] text-[#CBD5E1] max-w-[600px] mx-auto">Start your 14-day trial and give clients a calmer, more professional way to book, pay, and meet with your practice.</p>
          <a href={registerUrl} className="inline-flex items-center justify-center h-[52px] px-[30px] rounded-[16px] bg-white border-none text-[#24614F] text-[15px] font-[800] shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:bg-gray-50 transition-colors cursor-pointer">Start Free 14-Day Trial</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] pt-12 pb-8 px-4 md:px-10">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div className="flex flex-col gap-4">
            <img src="/unclutterdesk-lockup.svg" alt="unclutter desk" className="h-8 w-auto shrink-0 brightness-0 invert object-contain" />
            <p className="m-0 text-[13px] leading-[1.6] text-[#94A3B8] max-w-[280px]">Practice management and white-label booking for Nigerian therapists.</p>
            <div className="flex gap-2.5">
              <a href="#" className="w-[34px] h-[34px] rounded-full bg-[#1E293B] flex items-center justify-center cursor-pointer hover:bg-[#334155] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><path d="M17.5 6.5h.01"></path></svg>
              </a>
              <a href="#" className="w-[34px] h-[34px] rounded-full bg-[#1E293B] flex items-center justify-center cursor-pointer hover:bg-[#334155] transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 4 16 16M20 4 4 20"></path></svg>
              </a>
              <a href="#" className="w-[34px] h-[34px] rounded-full bg-[#1E293B] flex items-center justify-center cursor-pointer hover:bg-[#334155] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z"></path></svg>
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-[800] tracking-[0.12em] text-[#64748B]">PRODUCT</div>
            <a href="#features" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Features</a>
            <a href="#pricing" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Pricing</a>
            <a href="#pricing" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Booking page</a>
            <a href="#pricing" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Security</a>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-[800] tracking-[0.12em] text-[#64748B]">COMPANY</div>
            <a href="#pricing" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">About</a>
            <a href="#pricing" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Careers</a>
            <a href="#pricing" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Contact</a>
            <a href="#pricing" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Partner with us</a>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-[800] tracking-[0.12em] text-[#64748B]">LEGAL</div>
            <a href="/terms" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Terms</a>
            <a href="/privacy" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Privacy</a>
            <a href="/privacy#sub-processors" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">Data protection</a>
            <a href="/privacy#rights" className="text-[14px] text-white hover:text-[#94A3B8] transition-colors">NDPR compliance</a>
          </div>
        </div>
        <div className="max-w-[1240px] mx-auto mt-9 pt-5 border-t border-white/10 text-[13px] text-[#64748B] text-center md:text-left">
          © 2026 Unclutter Desk · Lagos, Nigeria · Made with care in WAT
        </div>
      </footer>
    </div>
  );
}
