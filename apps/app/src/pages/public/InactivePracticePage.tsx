import React from 'react';
import { PauseCircle, Mail, ArrowLeft } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';

export function InactivePracticePage() {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  return (
    <div className="min-h-screen bg-[#EFF3F7] text-[#0F172A] font-outfit flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Radial Bloom */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#0F3A53]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[560px] bg-white rounded-[24px] p-[38px_40px_32px] shadow-[0_24px_80px_rgba(15,23,42,.14)] text-center space-y-6 relative z-10 border border-[#E2E8F0]">
        {/* Practice Monogram Header */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-[52px] w-[52px] rounded-[16px] bg-[#0F3A53] text-[#E3B341] font-extrabold text-xl flex items-center justify-center border border-[#E3B341]/30">
            DS
          </div>
          <div className="text-left">
            <h2 className="text-[16px] font-bold text-[#0F172A] leading-tight">{brand.name || 'Therapy Practice'}</h2>
            <p className="text-xs text-[#64748B] font-medium">Lagos, Nigeria</p>
          </div>
        </div>

        {/* Status Block */}
        <div className="p-[30px_26px] rounded-[22px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
          <div className="h-[64px] w-[64px] rounded-[20px] bg-[#FEF3C7] text-[#92400E] flex items-center justify-center mx-auto border border-[#E3B341]/30 shadow-xs">
            <PauseCircle className="h-8 w-8" />
          </div>
          <h2 className="text-[16px] font-bold text-[#0F172A] leading-tight">{brand.name || 'Therapy Practice'}</h2>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">Online booking unavailable</p>
        </div>
        <div className="p-6 text-sm text-[#475569] leading-relaxed">
          This practice is not currently accepting new online bookings. Existing booked sessions remain scheduled and active.
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {/*
            "Contact practice" was a button with no handler, and nothing on this
            public page carries an address to contact — the brand config has no
            contact email. A dead button promising contact is worse than saying
            plainly that there is no route from here.
          */}
          <div
            className="w-full min-h-[48px] rounded-[16px] bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] font-medium text-[13px] flex items-center justify-center gap-2 px-4 py-3 text-center"
          >
            <Mail className="h-4 w-4 shrink-0" />
            <span>Please reach the practice the way you normally do.</span>
          </div>
          <a href="/" className="text-xs font-bold text-[#64748B] hover:text-[#0F172A] block">
            Return to homepage
          </a>
        </div>

        {/* Powered by Unclutter Desk Footer */}
        <div className="pt-4 border-t border-[#F1F5F9] flex items-center gap-2 justify-center opacity-60">
          <span className="text-[10.5px] font-semibold text-[#94A3B8]">Powered by</span>
          <span className="text-[10.5px] font-extrabold text-[#0F3A53]">Unclutter Desk</span>
        </div>
      </div>
    </div>
  );
}
