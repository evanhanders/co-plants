#!/usr/bin/env python3
"""Turn reviewed picks into repo-hosted images + plant.json shots.
Inputs:
  shortlist.json  (from select_candidates.py)
  picks.json      { "<cat>/<slug>": [ {"i": <idx>, "kind":"close|structure",
                                        "s":"spring|summer|fall|winter", "cap":"..."} ] }
For each pick: download the largest available iNat open-data render, EXIF-orient it,
write a <=1500px full image + a <=400px thumbnail into plants/<slug>/images/, then
rewrite that plant's shots[] (local thumb + local full + remote fallback + attribution)
and drop a credits.json for license provenance.
"""
import sys, json, os, urllib.request
from PIL import Image, ImageOps

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shortlist = json.load(open(sys.argv[1]))
picks = json.load(open(sys.argv[2]))
UA = "ColoPlantsHerbarium/1.0 (https://github.com/evanhanders/co-plants; evanhanders@gmail.com)"
BUCKET = "https://inaturalist-open-data.s3.amazonaws.com/photos"
FULL_MAX, THUMB_MAX = 1400, 400
FULL_Q = 82

def dl(pid, ext, size):
    url = f"{BUCKET}/{pid}/{size}.{ext}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=60).read()

def best_image(pid, ext):
    for size in ("original", "large", "medium"):
        try:
            data = dl(pid, ext, size)
            im = ImageOps.exif_transpose(Image.open(__import__("io").BytesIO(data))).convert("RGB")
            return im, size
        except Exception as e:
            sys.stderr.write(f"   {pid} {size} fail: {e}\n")
    return None, None

def save_variant(im, path, maxpx, q):
    v = im.copy(); v.thumbnail((maxpx, maxpx))
    v.save(path, "JPEG", quality=q, optimize=True)
    return v.size

SEAS_ABBR = {"spring":"sp","summer":"su","fall":"fa","winter":"wi","na":"yr"}

for slug, plist in picks.items():
    cands = shortlist[slug]
    img_dir = os.path.join(REPO, "plants", slug, "images")
    os.makedirs(img_dir, exist_ok=True)
    shots, credits, used = [], [], {}
    for p in plist:
        c = cands[p["i"]]
        im, size = best_image(c["photo_id"], c["ext"])
        if im is None:
            print(f"  !! {slug} idx {p['i']} could not download"); continue
        s = p.get("s", c["season"]); kind = p.get("kind", "close")
        base = f"{SEAS_ABBR.get(s,'yr')}-{kind}"
        used[base] = used.get(base, 0) + 1
        if used[base] > 1: base = f"{base}{used[base]}"
        full_rel = f"images/{base}.jpg"; thumb_rel = f"images/{base}-t.jpg"
        fsz = save_variant(im, os.path.join(img_dir, base + ".jpg"), FULL_MAX, FULL_Q)
        tsz = save_variant(im, os.path.join(img_dir, base + "-t.jpg"), THUMB_MAX, 82)
        by, lic = c["by"], c["lic"]
        # append the attribution, but idempotently — a pre-baked or re-finalized cap that
        # already carries this tail must not double it up
        attr = f"© {by} ({lic}) / iNaturalist"
        base_cap = p.get("cap", "")
        cap = base_cap if base_cap.rstrip().endswith(attr) else (f"{base_cap} · {attr}" if base_cap else attr)
        shots.append({
            "local": thumb_rel, "full": full_rel,
            "url": f"{BUCKET}/{c['photo_id']}/large.{c['ext']}",   # remote fallback
            "s": s, "cap": cap, "by": by, "lic": lic, "link": c["link"],
        })
        credits.append({"file": full_rel, "photo_id": c["photo_id"], "by": by,
                        "license": lic, "source": c["link"], "dataset": "iNaturalist open data",
                        "render": size, "full_px": fsz, "thumb_px": tsz})
        print(f"  {slug:32s} {base:14s} {size:8s} full{fsz} thumb{tsz}  © {by} ({lic})")

    pj_path = os.path.join(REPO, "plants", slug, "plant.json")
    pj = json.load(open(pj_path))
    pj["shots"] = shots
    json.dump(pj, open(pj_path, "w"), indent=2, ensure_ascii=False)
    json.dump(credits, open(os.path.join(img_dir, "credits.json"), "w"), indent=2, ensure_ascii=False)
print("done.")
