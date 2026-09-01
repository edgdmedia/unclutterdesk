import React from 'react';

export const authInputCls =
  'flex-1 min-w-0 bg-transparent border-none outline-none text-[14.5px] text-[#0F172A]';

interface AuthFieldProps {
  label: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  labelRow?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthField({ label, icon, trailing, labelRow, children }: AuthFieldProps) {
  return (
    <div>
      <div className="flex items-baseline mb-2">
        <span className="text-[11.5px] font-bold text-[#475569]">{label}</span>
        {labelRow}
      </div>
      <div className="flex items-center gap-[11px] h-[52px] px-[15px] border border-[#E2E8F0] rounded-[14px] bg-[#F8FAFC]">
        {icon}
        {children}
        {trailing}
      </div>
    </div>
  );
}
