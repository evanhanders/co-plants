#!/usr/bin/env python3
"""Regenerate every card thumbnail (`*-t.jpg`) larger and smart-cropped.

The card grid renders each shot in a 3:2 plate (object-fit:cover), at up to ~334 CSS px
wide on desktop and ~400+ on phones — i.e. 700px+ of *device* pixels on a retina/mobile
screen. The old thumbnails were full-frame resizes capped at 400px on the long edge, so
on any high-DPI display they were upscaled ~1.7-3x and looked soft, and portrait shots
got an arbitrary center-crop that could miss the subject.

This rebuilds each `<base>-t.jpg` from the already-sharp `<base>.jpg` full image as a
**720x480 (3:2)** crop centered on the most *interesting* region — the sharpest, most
detailed band of the photo (in-focus subject = strong edges), with a mild center bias.
For shots already near 3:2 the crop is essentially the whole frame. The uncropped full
image is untouched and still opens in the lightbox.

Usage: rethumb.py [plants/<cat>/<slug> ...]   (no args = all plants)
"""
import sys, os, glob
from PIL import Image, ImageOps, ImageFilter

TW, TH = 720, 480
A = TW / TH                      # target aspect 1.5
DW = 256                         # interest-map working width
EDGE_BIAS = 0.25                 # how strongly to prefer center (0 = pure saliency)
Q = 84

def interest_offset(im, axis, win_full, free_full):
    """Pick the crop offset (in full-image px) that maximizes edge energy under the
    window, with a mild center bias. axis 'x' slides horizontally, 'y' vertically."""
    W, H = im.size
    scale = DW / W
    DH = max(1, round(H * scale))
    edges = im.convert("L").resize((DW, DH)).filter(ImageFilter.FIND_EDGES)
    px = edges.load()
    if axis == "x":
        line = [sum(px[x, y] for y in range(DH)) for x in range(DW)]
        n, win = DW, max(1, round(win_full * scale))
    else:
        line = [sum(px[x, y] for x in range(DW)) for y in range(DH)]
        n, win = DH, max(1, round(win_full * scale))
    pre = [0]
    for v in line:
        pre.append(pre[-1] + v)
    win = min(win, n)
    best, best_pos = None, 0
    for p in range(0, n - win + 1):
        s = pre[p + win] - pre[p]
        center = (p + win / 2) / n
        bias = 1 - EDGE_BIAS * abs(center - 0.5) * 2     # 1 at center, 1-bias at edge
        score = s * bias
        if best is None or score > best:
            best, best_pos = score, p
    off = round(best_pos / scale)
    return min(max(0, off), free_full)

def crop_box(im):
    W, H = im.size
    if W / H >= A:                       # wide: full height, slide horizontally
        cw, ch = round(H * A), H
        free = W - cw
        off = interest_offset(im, "x", cw, free) if free > 0 else 0
        return (off, 0, off + cw, H)
    else:                                # tall/near-square: full width, slide vertically
        cw, ch = W, round(W / A)
        free = H - ch
        off = interest_offset(im, "y", ch, free) if free > 0 else 0
        return (0, off, W, off + ch)

def rethumb(full_path):
    im = ImageOps.exif_transpose(Image.open(full_path)).convert("RGB")
    thumb = im.crop(crop_box(im)).resize((TW, TH), Image.LANCZOS)
    out = full_path[:-4] + "-t.jpg"
    thumb.save(out, "JPEG", quality=Q, optimize=True)
    return out, os.path.getsize(out)

roots = sys.argv[1:] or ["plants"]
fulls = []
for r in roots:
    fulls += [f for f in glob.glob(os.path.join(r, "**", "images", "*.jpg"), recursive=True)
              if not f.endswith("-t.jpg")]
total = 0
for f in sorted(fulls):
    out, sz = rethumb(f)
    total += sz
    print(f"  {out:60s} {sz//1024:4d} KB")
print(f"{len(fulls)} thumbnails, {total/1024/1024:.1f} MB total")
