import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';

/**
 * The logo travels inside the save request, which the API caps at 100 KB, so
 * the image must end up well under that. 90,000 characters of data URL leaves
 * room for the other brand fields.
 */
const MAX_LOGO_LENGTH = 90_000;
/** Big enough to stay sharp in the sidebar, on the booking page and in emails. */
const LOGO_EDGE = 320;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Redraws the image small enough to store: LOGO_EDGE pixels on its longest
 * side first, as PNG to keep transparency, then smaller and in compressed
 * formats, for photos and busy artwork that PNG cannot squeeze.
 */
async function shrink(dataUrl: string): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return dataUrl; // No canvas (e.g. tests): keep the original.
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
  if (!img || !img.naturalWidth) return dataUrl;
  let smallest = dataUrl;
  for (const edge of [LOGO_EDGE, 240, 160]) {
    const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const [type, quality] of [['image/png', undefined], ['image/webp', 0.85], ['image/jpeg', 0.85]] as const) {
      if (type === 'image/jpeg') {
        // JPEG has no transparency: put the logo on white rather than black.
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      const out = canvas.toDataURL(type, quality);
      // A browser that can't write the format hands back PNG; skip those.
      if (!out.startsWith(`data:${type}`)) continue;
      if (out.length <= MAX_LOGO_LENGTH) return out;
      if (out.length < smallest.length) smallest = out;
    }
  }
  return smallest;
}

/** Choose, preview and remove the practice logo. Shared by setup and Brand settings. */
export function LogoField({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file: PNG, JPG, WebP or SVG.');
      return;
    }
    setWorking(true);
    try {
      const logo = await shrink(await readAsDataUrl(file));
      if (logo.length > MAX_LOGO_LENGTH) {
        setError('That image is too large to use. Try a smaller or simpler logo (under about 60 KB).');
        return;
      }
      onChange(logo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label="Choose logo"
          className="h-[52px] w-[52px] rounded-[16px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-[#0F3A53] transition-all"
        >
          {value ? (
            <img src={value} alt="Practice logo" className="w-full h-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-[#94A3B8]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={working}
          className="h-[44px] px-4 rounded-[12px] bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] hover:bg-slate-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Upload className="h-4 w-4 text-[#64748B]" />
          {working ? 'Preparing…' : value ? 'Change logo' : 'Choose logo image'}
        </button>
        <input ref={input} type="file" accept="image/*" aria-label="Upload logo" onChange={(e) => void choose(e)} className="hidden" />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remove logo"
            className="h-[44px] px-3 rounded-[12px] text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
