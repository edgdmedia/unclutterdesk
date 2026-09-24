// @ts-nocheck
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const noop = () => undefined;
const ToastContext = createContext<ToastApi>({ success: noop, error: noop, info: noop });

const TONES: Record<ToastKind, { bg: string; border: string; dot: string }> = {
  success: { bg: '#0F172A', border: '#1C4E3F', dot: '#4ADE80' },
  error: { bg: '#0F172A', border: '#7F1D1D', dot: '#F87171' },
  info: { bg: '#0F172A', border: '#334155', dot: '#93C5FD' },
};

/** How long a toast stays up. Errors stay longer: they usually need reading. */
const DURATION: Record<ToastKind, number> = { success: 3500, error: 6000, info: 4000 };

/**
 * Short confirmations after an action ("Service saved"). Inline messages on
 * the page stay the place for anything the user has to act on; a toast only
 * says that what they just did worked, or that it did not.
 *
 * Styled inline so it looks the same in every app regardless of its Tailwind
 * build, and announced to screen readers through an aria-live region.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      // At most three at once; the oldest makes room.
      setItems((current) => [...current.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DURATION[kind]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        role="status"
        style={{
          position: 'fixed',
          zIndex: 1000,
          left: '50%',
          transform: 'translateX(-50%)',
          // Above the mobile bottom navigation.
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 'min(92vw, 380px)',
          pointerEvents: 'none',
        }}
        className="md:!bottom-6"
      >
        {items.map((t) => {
          const tone = TONES[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : undefined}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 14,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                color: '#F8FAFC',
                fontSize: 13.5,
                fontWeight: 600,
                lineHeight: 1.4,
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.28)',
                animation: 'desk-toast-in 160ms ease-out',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.dot, flex: 'none' }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 2,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <style>{'@keyframes desk-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
