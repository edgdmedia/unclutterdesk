"""Packs the 16/32/48 PNGs from make-favicons.mjs into favicon.ico, then removes them."""
import os, sys
from PIL import Image
out = sys.argv[1]
src = [os.path.join(out, f'.favicon-{s}.png') for s in (16, 32, 48)]
Image.open(src[2]).save(os.path.join(out, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
for p in src: os.remove(p)
