import React, { useState } from 'react';
import { initialsOf } from '../../utils/initials';

export function PracticeLogo({ name, logoUrl, size = 44, color = '#0F3A53' }: { name: string; logoUrl?: string | null; size?: number; color?: string }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        style={{ height: size, maxWidth: size * 3 }}
        className="object-contain rounded-[10px]"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ height: size, width: size, backgroundColor: color }}
      className="inline-flex items-center justify-center rounded-[12px] text-white font-bold text-[15px]"
    >
      {initialsOf(name, 'UD')}
    </span>
  );
}
