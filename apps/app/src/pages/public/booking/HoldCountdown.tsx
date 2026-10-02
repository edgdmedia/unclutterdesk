import React, { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** BKG-09: how long the client's time stays held while they pay. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  if (left === 0) {
    return (
      <p className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-800">
        Your hold has ended. Pay now and we'll keep the time if it's still free.
      </p>
    );
  }
  return (
    <p className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[13.5px] text-[#475569]">
      Your time is held for{' '}
      <span role="timer" aria-live="off" className="font-bold text-[#0F172A]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {pad(Math.floor(left / 60))}:{pad(left % 60)}
      </span>
    </p>
  );
}
