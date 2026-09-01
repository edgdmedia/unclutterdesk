// @ts-nocheck
import React from 'react';

export interface MetricTileProps {
  value: string;
  label: string;
  minWidth?: string;
}

export function MetricTile({ value, label, minWidth = 'min-w-[96px]' }: MetricTileProps) {
  return (
    <div className={`${minWidth} p-[12px_14px] rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0]`}>
      <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0F172A] block leading-none mb-1">{value}</span>
      <span className="text-[11px] text-[#64748B] font-medium block">{label}</span>
    </div>
  );
}
