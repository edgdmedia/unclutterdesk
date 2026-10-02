import React from 'react';

/** The calm centre of an empty room. */
export function WaitingPanel({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      style={{ background: 'radial-gradient(120% 120% at 30% 20%, #1E3448 0%, #101A28 60%, #0B1220 100%)' }}
    >
      <p className="text-[15px] font-semibold text-white">{text}</p>
      {children}
    </div>
  );
}
