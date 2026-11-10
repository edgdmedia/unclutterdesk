import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// jsdom does no layout, so it has no client rects; the formatted-text editor
// (ProseMirror) measures the caret when it focuses and scrolls to it.
const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
const zeroRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects ??= noRects;
  Range.prototype.getBoundingClientRect ??= zeroRect;
}
if (typeof Element !== 'undefined') Element.prototype.getClientRects ??= noRects;
if (typeof Text !== 'undefined') (Text.prototype as any).getClientRects ??= noRects;
