import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useViewport } from '../layout/useViewport';

export type TourStep = {
  /** The value of a data-tour attribute on the element this step points at. */
  anchor: string;
  title: string;
  body: string;
};

type Rect = { top: number; left: number; width: number; height: number };

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * A guided walkthrough of a screen: dims the page, cuts a brand-ring highlight
 * around each stop, and talks from a popover beside it. Steps whose anchor is
 * not on screen are skipped, so the same tour works at every width.
 */
export function Tour({ steps, open, onDone }: { steps: TourStep[]; open: boolean; onDone: (how: 'finished' | 'skipped') => void }) {
  const viewport = useViewport();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const popover = useRef<HTMLDivElement>(null);

  const [anchors, setAnchors] = useState<(Element | null)[]>([]);

  // Anchors live in the page the tour walks, which mounts after this portal in
  // the same commit — so they are read in an effect, not during render.
  useEffect(() => {
    if (!open) return;
    setAnchors(steps.map((s) => document.querySelector(`[data-tour="${s.anchor}"]`)));
  }, [open, steps]);

  const visible = React.useMemo(
    () =>
      steps
        .map((step, i) => ({ step, el: anchors[i] }))
        .filter((entry): entry is { step: TourStep; el: Element } => entry.el !== null && entry.el !== undefined),
    [steps, anchors],
  );

  const current = visible[Math.min(index, Math.max(0, visible.length - 1))];

  const measure = useCallback(() => {
    if (current) setRect(rectOf(current.el));
  }, [current]);

  useLayoutEffect(() => {
    if (!current) return;
    if (typeof current.el.scrollIntoView === 'function') current.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    const onScrollOrResize = () => measure();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [current, measure, open]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (open && popover.current) popover.current.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone('skipped');
      if (e.key === 'Enter') {
        e.preventDefault();
        if (index >= visible.length - 1) onDone('finished');
        else setIndex((i) => i + 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, index, visible.length, onDone]);

  if (!open || !current) return null;

  const last = index >= visible.length - 1;
  const phone = viewport === 'phone';
  const pad = 12;
  const popoverStyle: React.CSSProperties = phone
    ? { position: 'fixed', left: 0, right: 0, bottom: 0 }
    : rect
      ? {
          position: 'fixed',
          top: Math.max(pad, Math.min(rect.top - 8, window.innerHeight - 240)),
          left: Math.max(pad, Math.min(rect.left + rect.width + 16, window.innerWidth - 340)),
          width: 320,
        }
      : { position: 'fixed', top: '40%', left: '40%', width: 320 };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200 }}>
      {/* The dim, with a hole punched where the anchor is. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.55)',
          clipPath: rect
            ? `polygon(0 0,0 100%,${rect.left}px 100%,${rect.left}px ${rect.top}px,${rect.left + rect.width}px ${rect.top}px,${rect.left + rect.width}px ${rect.top + rect.height}px,${rect.left}px ${rect.top + rect.height}px,${rect.left}px 100%,100% 100%,100% 0)`
            : undefined,
        }}
      />
      {rect ? (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            borderRadius: 12,
            border: '4px solid transparent',
            boxShadow: '0 0 0 4px var(--brand-ring)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        ref={popover}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        tabIndex={-1}
        style={{
          ...popoverStyle,
          background: '#FFFFFF',
          borderRadius: phone ? '16px 16px 0 0' : 16,
          padding: 20,
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.25)',
        }}
      >
        <h3 id="tour-step-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
          {current.step.title}
        </h3>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, color: '#475569' }}>{current.step.body}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>
            {index + 1} of {visible.length}
          </span>
          <span style={{ flex: 1 }} />
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? onDone('finished') : setIndex((i) => i + 1))}
            style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--brand-primary, #0F3A53)', fontSize: 12.5, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
          >
            {last ? 'Done' : 'Next'}
          </button>
          <button
            type="button"
            onClick={() => onDone('skipped')}
            style={{ padding: '8px 6px', borderRadius: 10, border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
