import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { RenderBar } from './types';
import { WaitingPanel } from './WaitingPanel';

/** VID-01: a room that can't be embedded opens in a new tab. */
export function LinkStage({ url, provider, renderBar }: { url: string; provider: 'LINK' | 'GOOGLE_MEET'; renderBar: RenderBar }) {
  const text = provider === 'GOOGLE_MEET' ? 'This session runs on Google Meet, in a new tab.' : 'This session opens in a new tab.';
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative flex-1 min-h-[320px] overflow-hidden rounded-[22px] border border-white/[0.06]">
        <WaitingPanel text={text}>
          <button
            type="button"
            onClick={() => window.open(url, '_blank', 'noopener')}
            className="inline-flex h-[44px] items-center gap-2 rounded-[14px] bg-[#E3B341] px-5 text-[13px] font-bold text-[#0F172A] cursor-pointer"
          >
            <ExternalLink className="h-4 w-4" />
            Open video call
          </button>
          <p className="text-[12px] text-slate-400">Keep this page open; come back here to leave.</p>
        </WaitingPanel>
      </div>
      {renderBar(null)}
    </div>
  );
}
