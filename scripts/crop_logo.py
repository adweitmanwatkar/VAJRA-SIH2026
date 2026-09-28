"""Crop the diamond emblem out of the VAJRA logo lockup.

Outputs (written next to this script's outputs dir = ../src/assets):
  logo-mark.png        - tight-cropped diamond emblem (transparent bg)
  favicon.png          - 64x64 downscale of the same mark
Prints the crop box + final sizes for verification.
"""
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'logo-source.png')
OUT_DIR = os.path.abspath(os.path.join(HERE, '..', 'src', 'assets'))
os.makedirs(OUT_DIR, exist_ok=True)

im = Image.open(SRC)
print('source:', im.size, im.mode)
im = im.convert('RGBA')
w, h = im.size

# Diamond emblem bounding box measured from the lockup (fractions of the canvas).
box = (int(0.215 * w), int(0.145 * h), int(0.785 * w), int(0.635 * h))
mark = im.crop(box)

# Trim fully-transparent margins around the emblem.
alpha = mark.split()[3]
bbox = alpha.getbbox()
if bbox:
    mark = mark.crop(bbox)

# Pad to a square canvas (transparent) so it scales uniformly.
mw, mh = mark.size
side = max(mw, mh)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(mark, ((side - mw) // 2, (side - mh) // 2), mark)

mark_path = os.path.join(OUT_DIR, 'logo-mark.png')
canvas.save(mark_path, optimize=True)
print('logo-mark.png:', canvas.size, '<-', mark_path)

favicon = canvas.resize((64, 64), Image.LANCZOS)
fav_path = os.path.join(OUT_DIR, 'favicon.png')
favicon.save(fav_path, optimize=True)
print('favicon.png:', favicon.size, '<-', fav_path)

# Report alpha coverage to confirm we cropped the emblem, not the wordmark.
import math
px = canvas.split()[3].getdata()
opaque = sum(1 for a in px if a > 16)
print('alpha coverage: %.1f%% of %dx%d' % (100.0 * opaque / (side * side), side, side))
