#!/usr/bin/env python3
"""Search Wikimedia Commons for CC-licensed candidate photos for hand-sourced plants
(cultivars/hybrids with no clean iNaturalist taxon). For each query it pulls files in
the File: namespace, reads imageinfo (URL + size + license + artist via extmetadata),
keeps only free licenses + real raster photos, downloads a review thumbnail, and writes
a candidates json. Use fetch_montage-style review, then hand-write picks for commons_finalize.py.

Usage: commons_search.py <slug> "query one" "query two" ...
Writes /tmp/commonswork/<slug>/cand_*.jpg + /tmp/commonswork/<slug>/candidates.json
"""
import sys, json, os, time, urllib.request, urllib.parse, html, re

UA = "ColoPlantsHerbarium/1.0 (https://github.com/evanhanders/co-plants; evanhanders@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"
FREE = ("cc0", "cc-by", "cc by", "public domain", "pdm", "cc-by-sa", "cc by-sa")
# reject explicit non-free
BAD = ("all rights reserved", "non-commercial only", "fair use")

def api(params):
    params = dict(params, format="json")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=60))

def search_titles(query, limit=12):
    r = api({"action": "query", "list": "search", "srsearch": query,
             "srnamespace": 6, "srlimit": limit})
    return [s["title"] for s in r.get("query", {}).get("search", [])]

def imageinfo(titles):
    if not titles:
        return {}
    r = api({"action": "query", "titles": "|".join(titles), "prop": "imageinfo",
             "iiprop": "url|size|mime|extmetadata|user", "iiurlwidth": 600})
    return r.get("query", {}).get("pages", {})

def clean(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", "", s)        # strip html tags
    s = html.unescape(s).strip()
    return re.sub(r"\s+", " ", s)

def dl(url, path):
    delay = 2
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            data = urllib.request.urlopen(req, timeout=90).read()
            open(path, "wb").write(data)
            return len(data)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                time.sleep(delay); delay *= 2; continue
            raise

def main():
    slug = sys.argv[1]
    queries = sys.argv[2:]
    out = os.path.join("/tmp/commonswork", slug)
    os.makedirs(out, exist_ok=True)
    seen, cands = set(), []
    titles = []
    for q in queries:
        titles += search_titles(q)
    # dedup keep order
    titles = [t for t in dict.fromkeys(titles)]
    for chunk_start in range(0, len(titles), 25):
        pages = imageinfo(titles[chunk_start:chunk_start + 25])
        for pg in pages.values():
            title = pg.get("title", "")
            ii = (pg.get("imageinfo") or [{}])[0]
            if not ii:
                continue
            mime = ii.get("mime", "")
            if mime not in ("image/jpeg", "image/png"):
                continue
            meta = ii.get("extmetadata", {})
            lic = clean(meta.get("LicenseShortName", {}).get("value", ""))
            artist = clean(meta.get("Artist", {}).get("value", ""))
            usage = clean(meta.get("UsageTerms", {}).get("value", "")).lower()
            llow = lic.lower()
            if any(b in llow or b in usage for b in BAD):
                continue
            if not any(f in llow for f in FREE):
                continue
            w, h = ii.get("width", 0), ii.get("height", 0)
            if w < 800 or h < 600 and h < w:  # require decent resolution
                pass
            if title in seen:
                continue
            seen.add(title)
            idx = len(cands)
            thumb_url = ii.get("thumburl") or (API.replace("/w/api.php", "") +
                "/wiki/Special:FilePath/" + urllib.parse.quote(title.replace("File:", "")) + "?width=600")
            tpath = os.path.join(out, f"cand_{idx:02d}.jpg")
            try:
                dl(thumb_url, tpath)
                time.sleep(0.4)
            except Exception as e:
                sys.stderr.write(f"thumb fail {title}: {e}\n")
                continue
            cands.append({
                "i": idx, "title": title, "file": title.replace("File:", ""),
                "url": ii.get("url"), "w": w, "h": h, "mime": mime,
                "license": lic, "artist": artist,
                "descurl": ii.get("descriptionurl", ""),
                "thumb": os.path.basename(tpath),
            })
            print(f"  [{idx:02d}] {w}x{h} {lic:14s} {title}  — {artist[:40]}")
    json.dump(cands, open(os.path.join(out, "candidates.json"), "w"), indent=2, ensure_ascii=False)
    print(f"{slug}: {len(cands)} candidates -> {out}/candidates.json")

if __name__ == "__main__":
    main()
