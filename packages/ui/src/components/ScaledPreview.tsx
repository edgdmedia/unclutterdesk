import { useState, type ReactNode, type CSSProperties } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

/**
 * A live scaled preview of a page at different device widths.
 * The previewed content renders at its natural desktop width (default 1180px)
 * and is scaled down to fit the container.
 */
export interface ScaledPreviewProps {
  /** The page/content to preview. Rendered at `width` then scaled. */
  children: ReactNode;
  /** Desktop width the previewed content assumes (px). Default 1180. */
  width?: number;
  /** Minimum height of the preview container (px). Default 580. */
  minHeight?: number;
  /** Whether to show the device width selector. Default true. */
  showDeviceSwitch?: boolean;
  /** Whether to show the "View full screen" button. Default true. */
  showFullScreen?: boolean;
  /** Label for the full-screen button. Default "View full screen". */
  fullScreenLabel?: string;
  /** Callback when full-screen is requested. The host should open the real page in a new tab/window. */
  onFullScreen?: () => void;
  /** Additional className for the outer card. */
  className?: string;
}

const DEVICE_PRESETS: Array<{ key: 'phone' | 'tablet' | 'desktop'; label: string; width: number }> = [
  { key: 'phone', label: 'Phone', width: 375 },
  { key: 'tablet', label: 'Tablet', width: 768 },
  { key: 'desktop', label: 'Desktop', width: 1180 },
];

export function ScaledPreview({
  children,
  width: desktopWidth = 1180,
  minHeight = 580,
  showDeviceSwitch = true,
  showFullScreen = true,
  fullScreenLabel = 'View full screen',
  onFullScreen,
  className = '',
}: ScaledPreviewProps) {
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('desktop');

  const preset = DEVICE_PRESETS.find((d) => d.key === device)!;
  const scale = preset.width / desktopWidth;
  const previewWidth = Math.min(preset.width, desktopWidth);
  const previewHeight = minHeight;

  const containerStyle: CSSProperties = {
    width: preset.width,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    // The container needs to reserve space for the scaled content
    // height is handled by the outer div
  };

  const outerWidth = preset.width * scale;
  const outerHeight = previewHeight * scale;

  return (
    <Card padding="p-[22px]" className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-[var(--desk-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4" aria-hidden="true" />
          <span className="text-[9px] font-black tracking-[0.2em] uppercase text-[var(--desk-text-subtle)]">LIVE SCALED PREVIEW</span>
        </div>
        {showDeviceSwitch && (
          <div className="flex items-center gap-1 bg-[var(--desk-surface-muted)] p-1 rounded-[12px]">
            {DEVICE_PRESETS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDevice(d.key)}
                className={`px-3 py-1 text-xs font-bold rounded-[8px] transition-all ${
                  device === d.key ? 'bg-white text-[var(--desk-text)] shadow-xs' : 'text-[var(--desk-text-muted)]'
                }`}
                aria-pressed={device === d.key}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-[var(--desk-border)] bg-[var(--desk-surface)] p-4 flex items-center justify-center overflow-hidden" style={{ minHeight }}>
        <div
          className="relative rounded-[16px] bg-slate-50 border border-[var(--desk-border)] overflow-auto"
          style={{
            width: previewWidth,
            height: previewHeight,
            // Reserve space for the scaled content
          }}
        >
          <div
            className="absolute origin-top-left pointer-events-none select-none"
            aria-hidden="true"
            style={containerStyle}
          >
            {children}
          </div>
        </div>
      </div>

      {showFullScreen && onFullScreen && (
        <div className="pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onFullScreen}
            className="w-full"
          >
            {fullScreenLabel}
          </Button>
        </div>
      )}
    </Card>
  );
}