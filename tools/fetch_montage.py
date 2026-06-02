#!/usr/bin/env python3
"""Download medium-size candidates from the iNat open-data bucket and build one labeled
contact-sheet per plant for visual review. Tiles are letterboxed (aspect preserved) so
rotated/odd-orientation shots are obvious. Index numbers match shortlist.json order.
Usage: fetch_montage.py shortlist.json out_dir [slug_filter]
"""
import sys, json, os, io, urllib.request, concurrent.futures
from PIL import Image, ImageDraw, ImageOps, ImageFont

shortlist = json.load(open(sys.argv[1]))
out_dir = sys.argv[2]
only = sys.argv[3] if len(sys.argv) > 3 else None
CACHE = "/tmp/imgwork/cache"; os.makedirs(CACHE, exist_ok=True)
os.makedirs(out_dir, exist_ok=True)
UA = "ColoPlantsHerbarium/1.0 (https://github.com/evanhanders/co-plants; evanhanders@gmail.com)"
BUCKET = "https://inaturalist-open-data.s3.amazonaws.com/photos"

def fetch(pid, ext, size="medium"):
    fp = f"{CACHE}/{pid}_{size}.jpg"
    if os.path.exists(fp) and os.path.getsize(fp) > 0:
        return fp
    url = f"{BUCKET}/{pid}/{size}.{ext}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        data = urllib.request.urlopen(req, timeout=30).read()
        open(fp, "wb").write(data)
        return fp
    except Exception as e:
        sys.stderr.write(f"  fail {pid}: {e}\n"); return None

def load_font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

F = load_font(20); Fs = load_font(15)
TILE_W, TILE_H, COLS, PAD = 380, 300, 4, 6

def build(slug, cands):
    paths = [None]*len(cands)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(fetch, c["photo_id"], c["ext"]): i for i, c in enumerate(cands)}
        for fu in concurrent.futures.as_completed(futs):
            paths[futs[fu]] = fu.result()
    n = len(cands); rows = (n + COLS - 1)//COLS
    W = COLS*(TILE_W+PAD)+PAD; H = rows*(TILE_H+PAD)+PAD
    sheet = Image.new("RGB", (W, H), (28, 26, 22))
    d = ImageDraw.Draw(sheet)
    for i, c in enumerate(cands):
        r, col = divmod(i, COLS)
        x0, y0 = PAD+col*(TILE_W+PAD), PAD+r*(TILE_H+PAD)
        d.rectangle([x0, y0, x0+TILE_W, y0+TILE_H], fill=(15, 14, 12))
        if paths[i]:
            try:
                im = ImageOps.exif_transpose(Image.open(paths[i])).convert("RGB")
                im.thumbnail((TILE_W-8, TILE_H-44))
                sheet.paste(im, (x0+(TILE_W-im.width)//2, y0+34+((TILE_H-44-im.height)//2)))
            except Exception as e:
                d.text((x0+8, y0+40), f"ERR {e}", font=Fs, fill=(255,120,120))
        else:
            d.text((x0+8, y0+40), "no image", font=Fs, fill=(255,120,120))
        d.rectangle([x0, y0, x0+TILE_W, y0+30], fill=(60, 50, 38))
        label = f"[{i}] {c['season']} {c['w']}x{c['h']} {c['lic']}"
        d.text((x0+6, y0+6), label, font=F, fill=(255, 240, 210))
    fp = f"{out_dir}/{slug.replace('/','__')}.jpg"
    sheet.save(fp, "JPEG", quality=84)
    print(f"  {slug}: {n} tiles -> {fp}")

for slug, cands in shortlist.items():
    if only and only not in slug:
        continue
    build(slug, cands)
