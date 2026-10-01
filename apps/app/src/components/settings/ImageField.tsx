import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';

/**
 * The image travels inside the save request, which the API caps at 100 KB, so
 * it must end up well under that. 90,000 characters of data URL leaves room for
 * the other fields in the same request.
 */
const MAX_IMAGE_LENGTH = 90_000;
/** Big enough to stay sharp in the sidebar, on the booking page and in emails. */
const IMAGE_EDGE = 320;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Redraws the image small enough to store: IMAGE_EDGE pixels on its longest
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
  for (const edge of [IMAGE_EDGE, 240, 160]) {
    const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const [type, quality] of [['image/png', undefined], ['image/webp', 0.85], ['image/jpeg', 0.85]] as const) {
      if (type === 'image/jpeg') {
        // JPEG has no transparency: put the image on white rather than black.
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      const out = canvas.toDataURL(type, quality);
      // A browser that can't write the format hands back PNG; skip those.
      if (!out.startsWith(`data:${type}`)) continue;
      if (out.length <= MAX_IMAGE_LENGTH) return out;
      if (out.length < smallest.length) smallest = out;
    }
  }
  return smallest;
}

export type ImageFieldProps = {
  /** data URL or https URL; '' for none. */
  value: string;
  /** Called with the shrunk image, or '' on remove. */
  onChange: (dataUrl: string) => void;
  /** Names everything: "Upload {label}", "Remove {label}", alt "{label}". */
  label: string;
  /** Alt override when the label alone does not read right (e.g. "Practice logo"). */
  alt?: string;
  /** circle for profile photos. */
  shape?: 'square' | 'circle';
  /** When given, the field saves on its own and shows the save states. */
  onSave?: (dataUrl: string) => Promise<void>;
};

/**
 * Choose, preview, remove and — when `onSave` is given — save an image, with
 * every state visible: preparing, saving, saved, or the error with the
 * previous image restored.
 */
export function ImageField({ value, onChange, label, alt, shape = 'square', onSave }: ImageFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const circle = shape === 'circle';

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setSaved(false);
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file: PNG, JPG, WebP or SVG.');
      return;
    }
    setWorking(true);
    let image: string;
    try {
      image = await shrink(await readAsDataUrl(file));
    } catch (err) {
      setWorking(false);
      setError(err instanceof Error ? err.message : 'Could not use that image.');
      return;
    }
    setWorking(false);
    if (image.length > MAX_IMAGE_LENGTH) {
      setError('That image is too large to use. Try a smaller or simpler image (under about 60 KB).');
      return;
    }
    onChange(image);
    if (onSave) {
      setSaving(true);
      try {
        await onSave(image);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        onChange(value); // Put back what was showing before the failed save.
        setError(err instanceof Error ? err.message : 'Could not save the image.');
      } finally {
        setSaving(false);
      }
    }
  }

  async function remove() {
    setError(null);
    setSaved(false);
    onChange('');
    if (onSave) {
      setSaving(true);
      try {
        await onSave('');
      } catch (err) {
        onChange(value);
        setError(err instanceof Error ? err.message : 'Could not save the change.');
      } finally {
        setSaving(false);
      }
    }
  }

  const busy = working || saving;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={`Choose ${label}`}
          className={`h-[52px] w-[52px] ${circle ? 'rounded-full' : 'rounded-[16px]'} bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-[#0F3A53] transition-all`}
        >
          {value ? (
            <img src={value} alt={alt ?? label} className={`w-full h-full ${circle ? 'rounded-full' : ''} object-contain`} />
          ) : (
            <ImageIcon className="h-6 w-6 text-[#94A3B8]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="h-[44px] px-4 rounded-[12px] bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] hover:bg-slate-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Upload className="h-4 w-4 text-[#64748B]" />
          {working ? 'Preparing…' : saving ? 'Saving…' : value ? `Change ${label}` : `Choose ${label} image`}
        </button>
        <input ref={input} type="file" accept="image/*" aria-label={`Upload ${label}`} onChange={(e) => void choose(e)} className="hidden" disabled={busy} />
        {value ? (
          <button
            type="button"
            onClick={() => void remove()}
            aria-label={`Remove ${label}`}
            disabled={busy}
            className="h-[44px] px-3 rounded-[12px] text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
      {!error && (working || saving || saved) ? (
        <p role="status" className="text-xs font-semibold text-[#64748B]">
          {working ? 'Preparing…' : saving ? 'Saving…' : 'Saved'}
        </p>
      ) : null}
    </div>
  );
}
