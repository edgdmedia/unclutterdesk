// Builds the favicon set from the design system's app icon:
//   node packages/ui/scripts/make-favicons.mjs <out-dir>
// favicon.svg (as drawn), apple-touch-icon.png (180, square: iOS rounds it),
// icon-192.png and icon-512.png (web manifest), and favicon-32/16 PNGs that
// make-favicons-ico.py packs into favicon.ico.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(join(process.cwd(), 'apps/api/package.json'));
const { Resvg } = require('@resvg/resvg-js');
const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, '../src/brand/therapysts/logos/therapysts-app-icon.svg'), 'utf8');
const square = svg.replace(/ rx="22"/, '');
const out = process.argv[2];
if (!out) throw new Error('usage: make-favicons.mjs <out-dir>');
mkdirSync(out, { recursive: true });

const png = (source, size) => new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
writeFileSync(join(out, 'favicon.svg'), svg);
writeFileSync(join(out, 'apple-touch-icon.png'), png(square, 180));
writeFileSync(join(out, 'icon-192.png'), png(svg, 192));
writeFileSync(join(out, 'icon-512.png'), png(svg, 512));
for (const s of [16, 32, 48]) writeFileSync(join(out, `.favicon-${s}.png`), png(svg, s));
