import React from 'react';
import { Mic, MicOff, Monitor, MonitorOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import type { CallControls, ControlButton } from './types';

type BarButton = ControlButton & { name: string };

/**
 * VID-01: the session room's control bar, as designed for the therapist room:
 * MUTE, CAMERA, SHARE, the page's own buttons, then End session or Leave.
 * Without call controls (a link room) only the page's buttons and the end show.
 */
export function ControlBar({
  controls,
  extraButtons = [],
  endLabel,
  onEnd,
}: {
  controls: CallControls | null;
  extraButtons?: ControlButton[];
  endLabel: string;
  onEnd(): void;
}) {
  const buttons: BarButton[] = [
    ...(controls
      ? [
          { label: 'MUTE', name: controls.muted ? 'Unmute' : 'Mute', icon: controls.muted ? MicOff : Mic, active: controls.muted, onClick: controls.toggleMic },
          { label: 'CAMERA', name: controls.cameraOff ? 'Turn camera on' : 'Turn camera off', icon: controls.cameraOff ? VideoOff : Video, active: controls.cameraOff, onClick: controls.toggleCamera },
          { label: 'SHARE', name: controls.sharing ? 'Stop sharing' : 'Share screen', icon: controls.sharing ? MonitorOff : Monitor, active: controls.sharing, onClick: controls.toggleShare },
        ]
      : []),
    ...extraButtons.map((b) => ({ ...b, name: b.label.charAt(0) + b.label.slice(1).toLowerCase() })),
  ];

  return (
    <div className="flex justify-center">
      <div className="bg-[#172130]/90 backdrop-blur-xl border border-white/10 rounded-[22px] p-[12px_14px] flex flex-wrap items-center justify-center gap-x-5 gap-y-3 shadow-[0_24px_60px_rgba(0,0,0,.5)] max-w-full">
        {buttons.length > 0 ? (
          <div className="flex items-center gap-3">
            {buttons.map((btn) => {
              const Icon = btn.icon;
              return (
                <div key={btn.label} className="flex flex-col items-center gap-1 w-[64px] sm:w-[74px]">
                  <button
                    type="button"
                    aria-label={btn.name}
                    aria-pressed={btn.active ?? false}
                    onClick={btn.onClick}
                    className={`h-[52px] w-[52px] rounded-[16px] flex items-center justify-center transition-all cursor-pointer ${btn.active ? 'bg-[#E3B341] text-[#0F172A] shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                  <span className="text-[10px] font-black tracking-[0.08em] text-slate-400 uppercase">{btn.label}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {buttons.length > 0 ? <div className="hidden sm:block h-[44px] w-[1px] bg-white/10" /> : null}
        <button
          type="button"
          onClick={onEnd}
          className="h-[52px] px-6 rounded-[16px] bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-[14.5px] flex items-center gap-2 shadow-[0_10px_26px_rgba(225,29,72,.4)] cursor-pointer whitespace-nowrap"
        >
          <PhoneOff className="h-4 w-4" />
          <span>{endLabel}</span>
        </button>
      </div>
    </div>
  );
}
