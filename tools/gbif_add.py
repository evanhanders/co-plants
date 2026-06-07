#!/usr/bin/env python3
"""APPEND reviewed GBIF (or any direct-URL) photos to a plant's reel — does NOT rewrite the
whole shots[] the way finalize.py/commons_finalize.py do, so it's the tool for adding a
single missing shot type (a berry, a fall-colour shot) to an existing reel.

Input: picks.json
  { "<cat>/<slug>": [ {"url": "<direct image url>", "kind": "berries|color|...",
                       "s": "spring|summer|fall|winter", "cap": "<caption lead>",
                       "by": "<photographer>", "lic": "<CC-BY-NC|...>",
                       "link": "<source page>", "source": "GBIF|iNaturalist|..."} ] }

For each pick: download the image, EXIF-orient, write a <=1400px full + provisional thumb into
plants/<slug>/images/, APPEND a shot to that plant's shots[] and an entry to credits.json.
Run tools/rethumb.py <slug> afterward to make the 720x480 card thumbnails.
"""
import sys, os, io, json, urllib.request
from PIL import Image, ImageOps

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "co-plants-herbarium/1.0 (evanhanders@gmail.com)"
SEAS = {"spring": "sp", "summer": "su", "fall": "fa", "winter": "wi", "na": "yr"}
picks = json.load(open(sys.argv[1]))

def dl(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()

for slug, plist in picks.items():
    pj_path = os.path.join(REPO, "plants", slug, "plant.json")
    pj = json.load(open(pj_path)); shots = pj.get("shots", [])
    img_dir = os.path.join(REPO, "plants", slug, "images"); os.makedirs(img_dir, exist_ok=True)
    cred_path = os.path.join(img_dir, "credits.json")
    credits = json.load(open(cred_path)) if os.path.exists(cred_path) else []
    have = {os.path.basename(s.get("local", "")) for s in shots}
    for p in plist:
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(dl(p["url"])))).convert("RGB")
        base = f"{SEAS.get(p.get('s','na'),'yr')}-{p['kind']}"; n = 1
        while f"{base}-t.jpg" in have:
            n += 1; base = f"{SEAS.get(p.get('s','na'),'yr')}-{p['kind']}{n}"
        full = im.copy(); full.thumbnail((1400, 1400)); full.save(os.path.join(img_dir, base+".jpg"), "JPEG", quality=82, optimize=True)
        thumb = im.copy(); thumb.thumbnail((400, 400)); thumb.save(os.path.join(img_dir, base+"-t.jpg"), "JPEG", quality=82, optimize=True)
        src = p.get("source", "GBIF")
        # append attribution idempotently so a re-baked cap can't double the tail
        attr = f"© {p['by']} ({p['lic']}) / {src}"
        base_cap = p.get("cap", "")
        cap = base_cap if base_cap.rstrip().endswith(attr) else (f"{base_cap} · {attr}" if base_cap else attr)
        shots.append({"local": f"images/{base}-t.jpg", "full": f"images/{base}.jpg", "url": p["url"],
                      "s": p.get("s", "summer"), "cap": cap,
                      "by": p["by"], "lic": p["lic"], "link": p.get("link", "")})
        credits.append({"file": f"images/{base}.jpg", "by": p["by"], "license": p["lic"],
                        "source": p.get("link", ""), "via": src})
        have.add(f"{base}-t.jpg")
        print(f"  + {slug}  {base}.jpg  © {p['by']} ({p['lic']}) / {src}")
    pj["shots"] = shots
    json.dump(pj, open(pj_path, "w"), indent=2, ensure_ascii=False); open(pj_path, "a").write("\n")
    json.dump(credits, open(cred_path, "w"), indent=2, ensure_ascii=False)
print("done — now run tools/rethumb.py for each plant.")
