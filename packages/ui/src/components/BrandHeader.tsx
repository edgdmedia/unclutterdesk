// @ts-nocheck
import React from 'react';
import { useBrand } from '../BrandProvider';

export function BrandHeader() {
  const brand = useBrand();

  return (
    <header className="w-full bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className="h-8 max-w-[160px] object-contain" />
        ) : (
          <div className="h-9 px-3.5 rounded-xl bg-[var(--brand-primary,#0F3A53)] text-white flex items-center justify-center font-bold text-sm">
            {brand.name}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Online Practice
        </span>
      </div>
    </header>
  );
}
