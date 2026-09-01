/* Standalone loader for the UI kits.
 *
 * Once this project is compiled as a design system, `_ds_bundle.js` provides
 * the component namespace and this file is a no-op fallback. Until then — and
 * when the kits are opened straight off disk — it fetches the component
 * sources, strips their ESM syntax (React is already global here), and puts
 * every primitive on `window.DESK`.
 *
 * Prototype plumbing only. Not part of the design system's public surface.
 */
(function () {
  const FILES = [
    'core/AvatarChip', 'core/Badge', 'core/Button', 'core/Card', 'core/Eyebrow',
    'core/IconButton', 'core/StatusPill',
    'forms/Input', 'forms/Textarea', 'forms/SegmentedControl', 'forms/Toggle', 'forms/ColorField',
    'data/StatTile', 'data/BarChart', 'data/ProgressRow',
    'brand/Logo',
    'navigation/NavItem', 'navigation/Sidebar', 'navigation/AppHeader', 'navigation/BottomNav',
  ];

  const NAMES = [
    'AvatarChip', 'Badge', 'Button', 'Card', 'Eyebrow', 'IconButton', 'StatusPill', 'STATUS',
    'Input', 'Textarea', 'SegmentedControl', 'Toggle', 'ColorField', 'BRAND_PRESETS', 'PresetSwatches',
    'StatTile', 'BarChart', 'ProgressRow', 'Logo',
    'NavItem', 'Sidebar', 'AppHeader', 'BottomNav',
  ];

  /* Iterate keys defensively — Object.values(window) touches cross-origin
     frames and throws a SecurityError when a page is previewed in an iframe. */
  function findBundleNamespace() {
    for (const k of Object.getOwnPropertyNames(window)) {
      try {
        const v = window[k];
        if (v && typeof v === 'object' && v !== window.DESK && v.Sidebar && v.BarChart && v.StatusPill) return v;
      } catch (e) { /* cross-origin frame */ }
    }
    return null;
  }

  function tryBundle(base) {
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = base + '_ds_bundle.js';
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  window.loadDeskComponents = async function (base) {
    if (!findBundleNamespace()) await tryBundle(base);
    const bundled = findBundleNamespace();
    if (bundled) { window.DESK = bundled; return bundled; }

    const sources = await Promise.all(
      FILES.map(f => fetch(base + 'components/' + f + '.jsx').then(r => r.text()))
    );

    const ns = {};
    window.__DESK_NS = ns;

    /* Each file is wrapped in its own IIFE so module-private constants
       (several files declare a local TONES map) don't collide, and its
       sibling imports are re-bound from the namespace built so far. */
    const chunks = sources.map(src => {
      const declared = [...src.matchAll(/^export\s+(?:function|const)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
      const needed = NAMES.filter(n => !declared.includes(n));
      const body = src
        .replace(/^\s*import[^;]+;\s*$/gm, '')
        .replace(/^export\s+/gm, '');
      return [
        '(function(){',
        needed.length ? 'const {' + needed.join(', ') + '} = window.__DESK_NS;' : '',
        body,
        'Object.assign(window.__DESK_NS, {' + declared.join(', ') + '});',
        '})();',
      ].join('\n');
    });

    for (const chunk of chunks) {
      (0, eval)(Babel.transform(chunk, { presets: [['react', { runtime: 'classic' }]] }).code);
    }

    window.DESK = ns;
    return ns;
  };

  /* Load kit screen files the same way. Babel's own script-tag transformer
     doesn't reliably execute external sources here, and code it evaluates
     isn't global — so each screen file publishes what it defines on window. */
  window.loadDeskScreens = async function (paths) {
    for (const p of paths) {
      const src = await fetch(p).then(r => r.text());
      (0, eval)(Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code);
    }
  };
})();
