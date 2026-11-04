// @ts-nocheck
import React, { useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';

export interface BookingLinkFieldProps {
  url: string;
  onCopy?: () => void;
  width?: string;
  className?: string;
}

export function BookingLinkField({ url, onCopy, width = 'w-[238px]', className = '' }: BookingLinkFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={`h-[44px] bg-[var(--desk-surface-muted)] border border-[var(--desk-border)] rounded-[14px] px-3.5 flex items-center gap-2.5 ${className}`}>
      <Link2 className="h-4 w-4 text-[var(--desk-text-muted)] shrink-0" />
      <input
        type="text"
        readOnly
        value={url}
        className={`${width} bg-transparent text-[13px] font-medium text-[var(--desk-text-body)] select-all outline-none`}
      />
      <button
        type="button"
        onClick={handleCopy}
        className="h-[32px] w-[32px] bg-white rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,.08)] hover:bg-[var(--desk-border)] flex items-center justify-center transition-colors border border-[var(--desk-border)] shrink-0"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-[var(--desk-text-body)]" />}
      </button>
    </div>
  );
}
