type Listener = () => void;

let width = 1280;
const listeners = new Set<Listener>();

/** A matchMedia that answers min-width queries against a width tests control. */
export function installMatchMedia(initial = 1280): void {
  width = initial;
  listeners.clear();
  window.matchMedia = ((query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
    return {
      get matches() {
        return width >= min;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, l: Listener) => listeners.add(l),
      removeEventListener: (_type: string, l: Listener) => listeners.delete(l),
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/** Changes the width and tells every listener, as a real resize would. */
export function setViewportWidth(next: number): void {
  width = next;
  listeners.forEach((l) => l());
}
