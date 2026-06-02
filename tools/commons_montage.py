#!/usr/bin/env python3
"""Build a labeled contact-sheet from the thumbnails commons_search.py downloaded.
Usage: commons_montage.py <slug>   (reads /tmp/commonswork/<slug>/candidates.json)
Tiles are letterboxed so rotated shots are obvious; index matches candidates.json order.
"""
import sys, os, json
from PIL import Image, ImageDraw, ImageOps, ImageFont

slug = sys.argv[1]
work = os.path.join("/tmp/commonswork", slug)
cands = json.load(open(os.path.join(work, "candidates.json")))

def load_font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

F = load_font(18); Fs = load_font(13)
TILE_W, TILE_H, COLS, PAD = 400, 320, 4, 6
n = len(cands); rows = (n + COLS - 1) // COLS
W = COLS * (TILE_W + PAD) + PAD; H = rows * (TILE_H + PAD) + PAD
sheet = Image.new("RGB", (W, H), (28, 26, 22))
d = ImageDraw.Draw(sheet)
for i, c in enumerate(cands):
    r, col = divmod(i, COLS)
    x0, y0 = PAD + col * (TILE_W + PAD), PAD + r * (TILE_H + PAD)
    d.rectangle([x0, y0, x0 + TILE_W, y0 + TILE_H], fill=(15, 14, 12))
    tp = os.path.join(work, c["thumb"])
    try:
        im = ImageOps.exif_transpose(Image.open(tp)).convert("RGB")
        im.thumbnail((TILE_W - 8, TILE_H - 50))
        sheet.paste(im, (x0 + (TILE_W - im.width) // 2, y0 + 40 + ((TILE_H - 50 - im.height) // 2)))
    except Exception as e:
        d.text((x0 + 8, y0 + 50), f"ERR {e}", font=Fs, fill=(255, 120, 120))
    d.rectangle([x0, y0, x0 + TILE_W, y0 + 36], fill=(60, 50, 38))
    d.text((x0 + 6, y0 + 3), f"[{i}] {c['w']}x{c['h']} {c['license']}", font=F, fill=(255, 240, 210))
    d.text((x0 + 6, y0 + 20), c["file"][:54], font=Fs, fill=(210, 200, 180))
fp = os.path.join(work, "montage.jpg")
sheet.save(fp, "JPEG", quality=85)
print(f"{slug}: {n} tiles -> {fp}")
