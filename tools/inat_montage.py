#!/usr/bin/env python3
"""iNat API path: query CC photos for a species, build a labeled contact-sheet to Read,
and write a shortlist.json entry. Usage:

  python3 tools/inat_montage.py <cat/slug> "<Botanical name>" [place_id] [--global]

Writes to /tmp/photowork/<slug-flat>/montage.jpg and appends the per-slug candidate list
to /tmp/photowork/shortlist.json (the input finalize.py expects). Each candidate carries
{photo_id, ext, by, lic, link, season}. Review the montage, then hand-write picks.json
({ "<cat/slug>": [ {"i":idx,"kind":"close|structure","s":"summer","cap":"..."} ] }) and run
finalize.py + rethumb.py.

Front Range place_id is 34. For garden cultivars with few CO records, pass --global to drop
the place filter (species-level photos are fine; verify the species in the montage).
"""
import sys, json, os, io, urllib.request, urllib.parse
from PIL import Image, ImageDraw, ImageFont

UA = "co-plants-herbarium/1.0 (evanhanders@gmail.com)"
WORK = os.environ.get("PHOTOWORK", "/tmp/photowork")  # set per-agent to avoid collisions
os.makedirs(WORK, exist_ok=True)

def api(path, params):
    url = "https://api.inaturalist.org/v1/" + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=40))

def resolve_taxon(name):
    # strip cultivar quotes / parentheticals / hybrid × for a clean species/genus query
    q = name.split("(")[0].replace("'", " ").replace("×", " ").strip()
    q = " ".join(q.split()[:2]) if len(q.split()) > 1 else q
    r = api("taxa", {"q": q, "per_page": 5})
    results = [t for t in r.get("results", []) if t.get("is_active")]
    # prefer an exact (case-insensitive) name match so e.g. "Prunus cerasus" doesn't grab "Prunus avium"
    for t in results:
        if t.get("name", "").lower() == q.lower():
            return t["id"], t.get("name")
    if results:
        return results[0]["id"], results[0].get("name")
    raise SystemExit(f"no active taxon for '{name}' (tried '{q}')")

PHENO = {"flowering": 13, "fruiting": 14, "budding": 15, "no_evidence": 21}  # iNat Plant Phenology annotation (term_id 12)

def fetch(slug, name, place_id, use_place, anygrade=False, month=None, pheno=None):
    tid, tname = resolve_taxon(name)
    params = {"taxon_id": tid, "photo_license": "cc0,cc-by,cc-by-nc",
              "order_by": "votes", "per_page": 60}
    if not anygrade:
        params["quality_grade"] = "research"   # --anygrade keeps cultivated/casual obs (garden cultivars)
    if month:                                  # --month 9,10,11 → seasonal shots (fall colour, berries)
        params["month"] = month
    if pheno:                                  # --phenology fruiting|flowering|budding → target a shot type
        params["term_id"] = 12; params["term_value_id"] = PHENO[pheno]
    if use_place and place_id:
        params["place_id"] = place_id
    obs = api("observations", params)
    results = obs.get("results", [])
    if use_place and len(results) < 10:   # too few local records — widen to global
        params.pop("place_id", None)
        results = api("observations", params).get("results", [])
        use_place = False
    cands, seen = [], set()
    for o in results:
        for ph in o.get("photos", [])[:1]:        # one photo per obs for observer variety
            pid = ph["id"]
            if pid in seen:
                continue
            seen.add(pid)
            ext = ph["url"].rsplit(".", 1)[-1].split("?")[0]
            attr = (ph.get("attribution") or "").replace("(c)", "").split(",")[0].strip()
            cands.append({"photo_id": pid, "ext": ext, "by": attr or "Unknown",
                          "lic": (ph.get("license_code") or "").upper(),
                          "link": f"https://www.inaturalist.org/observations/{o['id']}",
                          "season": "na",
                          "_thumb": ph["url"].replace("square", "medium")})
        if len(cands) >= 30:
            break
    print(f"{slug}: taxon {tname} (#{tid}); {len(cands)} candidates "
          f"({'CO' if use_place else 'global'})")
    return cands

def montage(slug, cands):
    cols, cell, pad, lab = 6, 300, 6, 22
    n = len(cands); rows = (n + cols - 1) // cols
    W = cols * (cell + pad) + pad
    H = rows * (cell + lab + pad) + pad
    sheet = Image.new("RGB", (W, H), (24, 18, 8))
    d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
    except Exception: font = ImageFont.load_default()
    for i, c in enumerate(cands):
        r, col = divmod(i, cols)
        x = pad + col * (cell + pad); y = pad + r * (cell + lab + pad)
        try:
            req = urllib.request.Request(c["_thumb"], headers={"User-Agent": UA})
            im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=40).read())).convert("RGB")
            im.thumbnail((cell, cell)); sheet.paste(im, (x, y + lab))
        except Exception as e:
            d.text((x + 4, y + lab + 4), f"fail {e}"[:30], fill=(255, 120, 120), font=font)
        d.text((x + 3, y + 3), f"[{i}] {c['lic']}", fill=(255, 235, 180), font=font)
    out = os.path.join(WORK, slug.replace("/", "__"))
    os.makedirs(out, exist_ok=True)
    mp = os.path.join(out, "montage.jpg")
    sheet.save(mp, "JPEG", quality=85)
    return mp

if __name__ == "__main__":
    slug, name = sys.argv[1], sys.argv[2]
    place_id = 34; use_place = True; anygrade = False; month = None; pheno = None
    args = sys.argv[3:]
    for i, a in enumerate(args):
        if a == "--global": use_place = False
        elif a == "--anygrade": anygrade = True
        elif a == "--month": month = args[i+1]
        elif a == "--phenology": pheno = args[i+1].lower()
        elif a.isdigit(): place_id = int(a)
    cands = fetch(slug, name, place_id, use_place, anygrade, month, pheno)
    # strip the private _thumb before persisting the shortlist
    shortlist_path = os.path.join(WORK, "shortlist.json")
    sl = json.load(open(shortlist_path)) if os.path.exists(shortlist_path) else {}
    sl[slug] = [{k: v for k, v in c.items() if not k.startswith("_")} for c in cands]
    json.dump(sl, open(shortlist_path, "w"), indent=1, ensure_ascii=False)
    mp = montage(slug, cands)
    print("montage:", mp)
