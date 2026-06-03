#!/usr/bin/env python3
"""Broaden the photo net via GBIF — it aggregates iNaturalist, observation.org, and many
other datasets, with license metadata, so it surfaces openly-licensed photos (and shot
types — ripe berries, fall colour) that iNat's vote-sorted top results bury. Month-filter
to find seasonal shots. Companion to inat_montage.py / commons_montage.py.

  python3 tools/gbif_montage.py "<cat/slug>" "<Scientific name>" [--us] [--month 9,10,11]

Pulls StillImage media under open licenses (CC0/CC-BY/CC-BY-SA/CC-BY-NC — never -ND, since
we crop), dedupes, tiles a labeled montage.jpg to Read, and writes candidates.json with the
image url + license + photographer + source. Then hand-write picks for gbif_add.py.
Set GBIFWORK=/tmp/<dir> to isolate parallel runs.
"""
import sys, os, io, json, time, urllib.request, urllib.parse, urllib.error
from PIL import Image, ImageDraw, ImageFont

UA = "co-plants-herbarium/1.0 (evanhanders@gmail.com)"
WORK = os.environ.get("GBIFWORK", "/tmp/gbifwork"); os.makedirs(WORK, exist_ok=True)
LIC = {"http://creativecommons.org/publicdomain/zero/1.0/": "CC0",
       "http://creativecommons.org/licenses/by/4.0/": "CC-BY",
       "http://creativecommons.org/licenses/by-sa/4.0/": "CC-BY-SA",
       "http://creativecommons.org/licenses/by-nc/4.0/": "CC-BY-NC",
       "http://creativecommons.org/licenses/by-nc-sa/4.0/": "CC-BY-NC-SA"}

def get(url):
    delay = 2
    for attempt in range(5):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                time.sleep(delay); delay *= 2; continue
            raise

def fetch(name, us, month):
    cands, seen = [], set()
    for offset in range(0, 300, 100):
        p = {"scientificName": name, "mediaType": "StillImage", "limit": 100, "offset": offset}
        if us: p["country"] = "US"
        if month: p["month"] = [int(x) for x in str(month).split(",") if x.strip()]
        d = json.load(get("https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode(p, doseq=True)))
        for o in d.get("results", []):
            for m in o.get("media", []):
                u = m.get("identifier"); lic = LIC.get(m.get("license"))
                if not u or not lic or u in seen:
                    continue
                seen.add(u)
                cands.append({"url": u, "lic": lic,
                              "by": (m.get("creator") or m.get("rightsHolder") or "Unknown").strip(),
                              "link": m.get("references") or f"https://www.gbif.org/occurrence/{o.get('key')}",
                              "source": (o.get("publisher") or "GBIF")})
        if d.get("endOfRecords"):
            break
    return cands[:40]

def montage(slug, cands):
    cols, cell, pad, lab = 6, 300, 6, 22
    n = len(cands); rows = (n + cols - 1) // cols
    sheet = Image.new("RGB", (cols*(cell+pad)+pad, rows*(cell+lab+pad)+pad), (24, 18, 8))
    d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except Exception: font = ImageFont.load_default()
    for i, c in enumerate(cands):
        r, col = divmod(i, cols); x = pad+col*(cell+pad); y = pad+r*(cell+lab+pad)
        try:
            im = Image.open(io.BytesIO(get(c["url"]).read())).convert("RGB"); im.thumbnail((cell, cell))
            sheet.paste(im, (x, y+lab))
        except Exception as e:
            d.text((x+4, y+lab+4), f"x {e}"[:26], fill=(255, 110, 110), font=font)
        d.text((x+3, y+3), f"[{i}] {c['lic']}", fill=(255, 235, 180), font=font)
    out = os.path.join(WORK, slug.replace("/", "__")); os.makedirs(out, exist_ok=True)
    mp = os.path.join(out, "montage.jpg"); sheet.save(mp, "JPEG", quality=85); return mp

if __name__ == "__main__":
    slug, name = sys.argv[1], sys.argv[2]
    us = "--us" in sys.argv
    month = next((a.split()[-1] for a in sys.argv if a.startswith("--month")), None)
    if "--month" in sys.argv:
        month = sys.argv[sys.argv.index("--month")+1]
    cands = fetch(name, us, month)
    print(f"{slug}: {len(cands)} open-licensed GBIF candidates"
          + (f" (month={month})" if month else "") + (" US" if us else " global"))
    clp = os.path.join(WORK, slug.replace("/", "__")); os.makedirs(clp, exist_ok=True)
    json.dump(cands, open(os.path.join(clp, "candidates.json"), "w"), indent=1, ensure_ascii=False)
    print("montage:", montage(slug, cands))
