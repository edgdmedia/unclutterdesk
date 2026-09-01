import React from 'react';
import { Check } from 'lucide-react';
import { UnclutterMark } from './UnclutterMark';

export type AuthStat = { value: string; label: string };

type MotifVariant = 'login' | 'signup';

type MotifCircle = {
  kind: 'ring' | 'fill' | 'dot';
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  size: number;
  opacity: number;
};

const MOTIFS: Record<MotifVariant, MotifCircle[]> = {
  login: [
    { kind: 'ring', top: 96, left: 16, size: 300, opacity: 0.22 },
    { kind: 'ring', top: 146, left: 76, size: 300, opacity: 0.14 },
    { kind: 'fill', top: -70, right: -110, size: 380, opacity: 0.07 },
    { kind: 'fill', bottom: -90, left: -70, size: 280, opacity: 0.05 },
    { kind: 'dot', top: 236, left: 166, size: 12, opacity: 0.45 },
  ],
  signup: [
    { kind: 'ring', top: 110, left: 22, size: 320, opacity: 0.2 },
    { kind: 'ring', top: 170, left: 92, size: 320, opacity: 0.13 },
    { kind: 'fill', top: -90, right: -120, size: 400, opacity: 0.07 },
    { kind: 'ring', bottom: -110, right: 40, size: 300, opacity: 0.12 },
    { kind: 'dot', top: 262, left: 190, size: 12, opacity: 0.45 },
  ],
};

interface AuthSplitShellProps {
  variant: MotifVariant;
  headline: string;
  tagline: string;
  footer: string;
  stats?: AuthStat[];
  bullets?: string[];
  children: React.ReactNode;
}

export function AuthSplitShell({
  variant,
  headline,
  tagline,
  footer,
  stats,
  bullets,
  children,
}: AuthSplitShellProps) {
  return (
    <div className="min-h-screen flex bg-white font-outfit">
      {/* Left slate panel */}
      <div className="hidden lg:flex w-[600px] flex-none bg-[#0F172A] px-12 py-11 flex-col relative overflow-hidden">
        {MOTIFS[variant].map((c, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: c.size,
              height: c.size,
              opacity: c.opacity,
              top: c.top,
              left: c.left,
              right: c.right,
              bottom: c.bottom,
              borderRadius: '50%',
              ...(c.kind === 'ring'
                ? { border: '1.5px solid #E3B341' }
                : { background: '#E3B341' }),
            }}
          />
        ))}

        <div className="flex items-center gap-[11px] relative z-[2]">
          <UnclutterMark size={32} className="rounded-[10px]" />
          <span className="text-white text-[18px] font-semibold tracking-[-0.02em]">unclutter</span>
          <span className="h-[19px] px-[9px] rounded-full bg-[#E3B341] text-[#0F172A] text-[9.5px] font-black tracking-[0.1em] inline-flex items-center">
            OS
          </span>
        </div>

        <div className="mt-auto pt-10 relative z-[2]">
          <div className="w-9 h-[3px] rounded bg-[#E3B341] mb-6" />
          <h2 className="text-[42px] font-bold leading-[1.12] tracking-[-0.04em] text-white max-w-[430px]">
            {headline}
          </h2>
          <p className="mt-5 text-[15.5px] text-[#94A3B8] leading-[1.7] max-w-[410px]">{tagline}</p>

          {stats && stats.length > 0 && (
            <div className="mt-[38px] flex gap-[26px]">
              {stats.map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <div className="w-px bg-white/[0.12]" />}
                  <div>
                    <div className="text-[24px] font-extrabold tracking-[-0.03em] text-[#E3B341]">
                      {s.value}
                    </div>
                    <div className="text-xs text-[#64748B]">{s.label}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {bullets && bullets.length > 0 && (
            <div className="mt-[34px] flex flex-col gap-[14px]">
              {bullets.map((b) => (
                <div key={b} className="flex items-center gap-3">
                  <span className="h-7 w-7 flex-none rounded-[9px] bg-[#E3B341]/15 text-[#E3B341] flex items-center justify-center">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </span>
                  <span className="text-sm text-[#CBD5E1]">{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-11 text-xs text-[#64748B] relative z-[2]">{footer}</div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 min-w-0 bg-white flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-[404px]">{children}</div>
      </div>
    </div>
  );
}
