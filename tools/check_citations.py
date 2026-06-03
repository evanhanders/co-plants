#!/usr/bin/env python3
"""Audit every plant's care_src citations: are the URLs reachable, and do they actually
serve the right plant? Catches the failure mode where a care_src URL returns HTTP 200 but
resolves to a DIFFERENT plant (fabricated MBG `kempercode`/RHS numeric IDs have pointed at
boxwood, daffodils, peonies, Gentiana…), plus plain dead links.

Per source it reports:
  OK      — 200 and the page text mentions the plant's genus/species/common name
  REVIEW  — 200 but no name match found (could be a JS-rendered page, or the wrong plant)
  DEAD    — non-200 / fetch error

Exit status is non-zero if any plant has ZERO ok-or-review (i.e. no reachable) sources, or
if --strict and any plant has zero OK sources. Use it after adding/editing care_src.

  python3 tools/check_citations.py            # audit all plants
  python3 tools/check_citations.py --strict   # also fail if a plant has 0 content-verified sources
  python3 tools/check_citations.py plants/perennials/knautia   # just one (or a few) dirs
"""
import sys, os, re, json, glob, ssl, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "co-plants-herbarium/1.0 (evanhanders@gmail.com)"
CTX = ssl._create_unverified_context()  # tolerate the container's proxy CA
STOP = {"the","of","and","a","grape","flower","aster","sage","tree","rose","grass","daisy",
        "primrose","speedwell","poppy","spurge","lupine","anemone","native","garden","wild",
        "creeping","hardy","blue","white","yellow","western","mountain","prairie","scarlet"}

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
            return r.getcode(), r.read(200000).decode("utf-8", "ignore").lower()
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return None, ""

def name_tokens(d):
    """genus, species epithet, and distinctive common-name words to look for in the page."""
    toks = set()
    bot = re.sub(r"[^A-Za-z×' ]", " ", d.get("botanical", ""))
    parts = [p for p in bot.replace("×", " ").replace("'", " ").split() if len(p) > 2]
    toks.update(p.lower() for p in parts[:2])                      # genus + species epithet
    for w in re.sub(r"[^A-Za-z ]", " ", d.get("common", "")).split():
        if len(w) > 3 and w.lower() not in STOP:
            toks.add(w.lower())
    return {t for t in toks if t not in STOP}

def audit(path):
    d = json.load(open(path)); slug = os.path.dirname(path).replace(REPO + "/plants/", "").replace("plants/", "")
    toks = name_tokens(d); rows = []
    for s in d.get("references", d.get("care_src", [])):
        code, body = fetch(s["url"])
        if code not in (200, 202):
            rows.append(("DEAD", code, s["url"]))
        elif any(t in body for t in toks):
            rows.append(("OK", code, s["url"]))
        else:
            rows.append(("REVIEW", code, s["url"]))
    return slug, rows

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    strict = "--strict" in sys.argv
    if args:
        paths = [os.path.join(a, "plant.json") if not a.endswith(".json") else a for a in args]
    else:
        paths = sorted(glob.glob(os.path.join(REPO, "plants", "*", "*", "plant.json")))
    results = list(ThreadPoolExecutor(max_workers=12).map(audit, paths))
    dead = review = ok = 0; no_reach = []; no_ok = []
    for slug, rows in results:
        flags = [r for r in rows if r[0] != "OK"]
        if flags:
            print(f"\n{slug}")
            for st, code, url in rows:
                if st != "OK": print(f"  {st:7} {code}  {url}")
        ok += sum(r[0]=="OK" for r in rows); review += sum(r[0]=="REVIEW" for r in rows); dead += sum(r[0]=="DEAD" for r in rows)
        if not any(r[0] in ("OK","REVIEW") for r in rows): no_reach.append(slug)
        if not any(r[0]=="OK" for r in rows): no_ok.append(slug)
    print(f"\n{'='*60}\n{len(results)} plants | sources: {ok} OK, {review} REVIEW, {dead} DEAD")
    if no_reach: print(f"!! {len(no_reach)} plants with NO reachable source: {no_reach}")
    if no_ok: print(f"!! {len(no_ok)} plants with NO content-verified source: {no_ok}")
    bad = no_reach or (strict and no_ok)
    print("RESULT:", "FAIL" if bad else "PASS")
    sys.exit(1 if bad else 0)
