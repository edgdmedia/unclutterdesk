import React from 'react';
import { formatDateParts } from './portalFormat';

export function DateTile({ startsAt, size = 'md' }: { startsAt: string; size?: 'md' | 'lg' }) {
  const parts = formatDateParts(startsAt);
  const cls = size === 'lg' ? 'w-[86px] rounded-[20px] py-[14px]' : 'w-[54px] rounded-[16px] py-[9px]';
  return (
    // The large tile sits on the dark "next session" card; the small one on the white list.
    <div className={`${cls} flex-none text-center ${size === 'lg' ? 'bg-[rgba(255,255,255,0.1)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]' : 'bg-[#F8FAFC] shadow-[inset_0_0_0_1px_#E2E8F0]'}`}>
      <div className={`text-[9.5px] font-black tracking-[0.1em] uppercase ${size === 'lg' ? 'text-[#E3B341]' : 'text-[#B45309]'}`}>{parts.day}</div>
      <div className={`${size === 'lg' ? 'text-[30px] text-white' : 'text-[19px] text-[#0F172A]'} font-extrabold leading-none`}>{parts.date}</div>
      <div className={`mt-0.5 text-[10.5px] font-black tracking-[0.08em] uppercase ${size === 'lg' ? 'text-[#E3B341]' : 'text-[#B45309]'}`}>{parts.month}</div>
    </div>
  );
}
