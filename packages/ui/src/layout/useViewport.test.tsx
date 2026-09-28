import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useViewport } from './useViewport';
import { installMatchMedia, setViewportWidth } from '../test/matchMedia';

describe('useViewport', () => {
  it('names the width band', () => {
    installMatchMedia(390);
    expect(renderHook(() => useViewport()).result.current).toBe('phone');
    installMatchMedia(820);
    expect(renderHook(() => useViewport()).result.current).toBe('tablet');
    installMatchMedia(1279);
    expect(renderHook(() => useViewport()).result.current).toBe('tablet');
    installMatchMedia(1280);
    expect(renderHook(() => useViewport()).result.current).toBe('desktop');
  });

  it('follows the screen when it changes', () => {
    installMatchMedia(820);
    const { result } = renderHook(() => useViewport());
    act(() => setViewportWidth(1400));
    expect(result.current).toBe('desktop');
    act(() => setViewportWidth(500));
    expect(result.current).toBe('phone');
  });
});
