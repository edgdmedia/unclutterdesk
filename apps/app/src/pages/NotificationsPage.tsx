import React from 'react';
import { Bell, CheckCircle2, Calendar, FileText } from 'lucide-react';
import { Eyebrow, Card } from '@unclutterdesk/ui';

export function NotificationsPage() {
  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[80px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>PRACTICE ACTIVITY</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Notifications & Alerts</h1>
        </div>
      </header>

      <main className="p-[24px_26px_30px] space-y-4 flex-1">
        <Card padding="p-0" className="overflow-hidden border border-[#E2E8F0]">
          <div className="divide-y divide-[#F1F5F9]">
            {[
              { title: 'New Booking Confirmed', time: '10 minutes ago', desc: 'Adaeze Okonkwo booked 50-min Individual Session for Friday 10:00 AM.', icon: Calendar, color: 'text-blue-600 bg-blue-50' },
              { title: 'Intake Questionnaire Submitted', time: '1 hour ago', desc: 'PHQ-9 score 14 submitted by Adaeze Okonkwo.', icon: FileText, color: 'text-amber-600 bg-amber-50' },
              { title: 'Paystack Settlement Deposited', time: 'Yesterday', desc: '₦450,000 deposited to Guaranty Trust Bank subaccount.', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            ].map((n, i) => {
              const Icon = n.icon;
              return (
                <div key={i} className="p-4 flex items-start gap-4 hover:bg-[#FCFDFE]">
                  <div className={`h-10 w-10 rounded-[12px] flex items-center justify-center shrink-0 ${n.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-bold text-[#0F172A]">{n.title}</h4>
                      <span className="text-[11px] text-[#94A3B8] font-medium">{n.time}</span>
                    </div>
                    <p className="text-xs text-[#475569] font-medium">{n.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
