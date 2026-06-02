#!/usr/bin/env python3
"""Turn reviewed Wikimedia Commons picks into repo-hosted images + plant.json shots.
The Commons counterpart of finalize.py (which is iNat-open-data only) — used for the
hand-sourced cultivars/hybrids that have no clean iNaturalist taxon.

Input: commons_picks.json
  { "<cat>/<slug>": [ {"file": "Name.jpg", "url": "<upload.wikimedia direct url>",
                       "kind": "flower|habit", "s": "spring|summer|fall|winter",
                       "cap": "<caption lead>", "by": "<photographer>",
                       "lic": "<license short>", "link": "<commons File: page>"} ] }

For each pick: download the full Commons original (UA + 429 backoff), EXIF-orient it,
write a <=1500px full image + a <=400px thumbnail into plants/<slug>/images/, then
rewrite that plant's shots[] (local thumb + local full + remote `commons` fallback +
attribution) and drop a credits.json for license provenance.
"""
import sys, json, os, io, time, urllib.request, urllib.error
from PIL import Image, ImageOps

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
picks = json.load(open(sys.argv[1]))
UA = "ColoPlantsHerbarium/1.0 (https://github.com/evanhanders/co-plants; evanhanders@gmail.com)"
FULL_MAX, THUMB_MAX, FULL_Q = 1500, 400, 84
SEAS_ABBR = {"spring": "sp", "summer": "su", "fall": "fa", "winter": "wi", "na": "yr"}

def dl(url):
    delay = 2
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                sys.stderr.write(f"   429, backoff {delay}s\n"); time.sleep(delay); delay *= 2; continue
            raise

def save_variant(im, path, maxpx, q):
    v = im.copy(); v.thumbnail((maxpx, maxpx))
    v.save(path, "JPEG", quality=q, optimize=True)
    return v.size

for slug, plist in picks.items():
    img_dir = os.path.join(REPO, "plants", slug, "images")
    os.makedirs(img_dir, exist_ok=True)
    shots, credits, used = [], [], {}
    for p in plist:
        data = dl(p["url"])
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        orig_px = im.size
        s, kind = p.get("s", "na"), p.get("kind", "close")
        base = f"{SEAS_ABBR.get(s, 'yr')}-{kind}"
        used[base] = used.get(base, 0) + 1
        if used[base] > 1:
            base = f"{base}{used[base]}"
        full_rel, thumb_rel = f"images/{base}.jpg", f"images/{base}-t.jpg"
        fsz = save_variant(im, os.path.join(img_dir, base + ".jpg"), FULL_MAX, FULL_Q)
        tsz = save_variant(im, os.path.join(img_dir, base + "-t.jpg"), THUMB_MAX, 82)
        by, lic = p["by"], p["lic"]
        cap = p.get("cap", "") + f" · © {by} ({lic}) / Wikimedia Commons"
        shots.append({
            "local": thumb_rel, "full": full_rel,
            "commons": p["file"],                 # remote fallback via Special:FilePath
            "s": s, "cap": cap, "by": by, "lic": lic, "link": p["link"],
        })
        credits.append({"file": full_rel, "commons_file": p["file"], "by": by,
                        "license": lic, "source": p["link"], "dataset": "Wikimedia Commons",
                        "orig_px": list(orig_px), "full_px": list(fsz), "thumb_px": list(tsz)})
        time.sleep(0.4)
        print(f"  {slug:24s} {base:12s} orig{orig_px} full{fsz} thumb{tsz}  © {by} ({lic})")

    pj_path = os.path.join(REPO, "plants", slug, "plant.json")
    pj = json.load(open(pj_path))
    pj["shots"] = shots
    json.dump(pj, open(pj_path, "w"), indent=2, ensure_ascii=False)
    json.dump(credits, open(os.path.join(img_dir, "credits.json"), "w"), indent=2, ensure_ascii=False)
print("done.")
