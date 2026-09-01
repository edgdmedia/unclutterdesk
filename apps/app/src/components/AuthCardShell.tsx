import React from 'react';
import { UnclutterMark } from './UnclutterMark';

type Accent = 'gold' | 'green';

type MotifVariant = 'forgot' | 'reset' | 'verify';

type MotifCircle = {
  kind: 'ring' | 'fill' | 'dot';
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  size: number;
  opacity: number;
};

const CIRCLE_COLOR: Record<Accent, string> = {
  gold: '#E3B341',
  green: '#34D399',
};

const MOTIFS: Record<MotifVariant, MotifCircle[]> = {
  forgot: [
    { kind: 'ring', top: 60, left: 290, size: 340, opacity: 0.16 },
    { kind: 'ring', top: 130, left: 360, size: 340, opacity: 0.1 },
    { kind: 'fill', bottom: -120, right: 180, size: 380, opacity: 0.05 },
    { kind: 'dot', top: 196, left: 520, size: 12, opacity: 0.4 },
  ],
  reset: [
    { kind: 'ring', bottom: 40, right: 280, size: 340, opacity: 0.16 },
    { kind: 'ring', bottom: 110, right: 350, size: 340, opacity: 0.1 },
    { kind: 'fill', top: -110, left: 200, size: 360, opacity: 0.05 },
  ],
  verify: [
    { kind: 'ring', top: 70, left: 320, size: 330, opacity: 0.16 },
    { kind: 'ring', top: 140, left: 390, size: 330, opacity: 0.1 },
    { kind: 'fill', bottom: -120, right: 200, size: 360, opacity: 0.05 },
    { kind: 'dot', top: 210, left: 552, size: 12, opacity: 0.4 },
  ],
};

interface AuthCardShellProps {
  variant: MotifVariant;
  accent?: Accent;
  center?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCardShell({
  variant,
  accent = 'gold',
  center = false,
  children,
  footer,
}: AuthCardShellProps) {
  const color = CIRCLE_COLOR[accent];

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 font-outfit relative overflow-hidden">
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
            ...(c.kind === 'ring' ? { border: `1.5px solid ${color}` } : { background: color }),
          }}
        />
      ))}

      <div className="w-full max-w-[480px] bg-white rounded-[24px] p-[36px_38px_30px] shadow-[0_30px_80px_rgba(0,0,0,0.4)] relative">
        <div className={center ? 'flex items-center justify-center gap-[10px]' : 'flex items-center gap-[10px]'}>
          <UnclutterMark size={30} className="rounded-[10px]" />
          <span className="text-[16px] font-semibold text-[#0F172A] tracking-[-0.02em]">
            unclutter<span className="opacity-45">OS</span>
          </span>
        </div>

        {children}

        {footer && (
          <div className="mt-[26px] pt-5 border-t border-[#F1F5F9] text-center">{footer}</div>
        )}
      </div>
    </div>
  );
}
