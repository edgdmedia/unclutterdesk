/**
 * Loads a heavy module on first use instead of at startup, once.
 *
 * Every module the API imports is loaded before it can answer /health, and
 * the production server is many times slower than a laptop: sharp,
 * googleapis, resvg and satori together took most of a ~20 s boot there,
 * for features few requests use (link-preview images, PDFs, Google
 * Calendar). `lazy-modules.spec.ts` keeps them out of startup.
 *
 * Interop: the build is CommonJS without esModuleInterop, so a CommonJS
 * module arrives as module.exports itself; under ESM (tests) it arrives as a
 * namespace with `default`. `pick` takes whichever is there.
 */
export function lazyModule<T>(load: () => Promise<any>, pick: (m: any) => T = (m) => (m?.default ?? m) as T): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () => (loading ??= load().then(pick));
}
