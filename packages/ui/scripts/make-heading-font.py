"""
Fraunces for headings, cut from the design system's variable font
(packages/ui/src/brand/therapysts/fonts/Fraunces-Variable.woff2) to what the
Therapysts design system uses: weight 560, 'SOFT' 100, 'WONK' 0, optical size
20-96, Latin only. The full variable font is 118 KB; public pages have a
100 KB budget before the photo.

Run with fonttools 4.55.0 and brotli 1.1.0:
  python packages/ui/scripts/make-heading-font.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

FONTS = Path(__file__).resolve().parent.parent / 'src/brand/therapysts/fonts'
src = TTFont(FONTS / 'Fraunces-Variable.woff2')
cut = instantiateVariableFont(src, {'wght': 560, 'SOFT': 100, 'WONK': 0, 'opsz': (20, 96)})
options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['kern', 'liga', 'calt', 'onum', 'lnum', 'pnum', 'tnum']
options.name_IDs = ['*']
sub = subset.Subsetter(options)
# Basic Latin, Latin-1 and the punctuation and currency signs we use (incl. the naira sign).
sub.populate(unicodes=list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x20A6, 0x2122])
sub.subset(cut)
cut.flavor = 'woff2'
out = FONTS / 'Fraunces-Heading.woff2'
cut.save(out)
print(out.name, out.stat().st_size, 'bytes')
