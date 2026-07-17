#!/usr/bin/env python3
"""Procedurally generate plants/bundle.json from the per-plant truth files.

The grid (index.html / app.js) and the Favourites page used to fetch every
plant's plant.json individually — one request per plant (250+). This bundles
them into ONE file the grid loads in a single request, so first paint no longer
waits on hundreds of round-trips.

The per-plant plants/<cat>/<slug>/plant.json files remain the single source of
truth — this bundle is *derived* from them and is safe to delete/regenerate at
any time (the pages fall back to per-file loading if it's missing). Run this
whenever a plant is added/edited (it's the last data step, after finalize/
rethumb/check_refs), and commit the refreshed bundle.json alongside the change.

The bundle carries ONLY the fields the grid actually reads — the heavy,
detail-page-only fields (care, references, fact_src, care_src) are dropped, so
the bundle stays small. The full record is still served per-plant to the detail
page (plant.html/plant.js), which fetches its own plant.json.

Usage:
  python3 tools/build_bundle.py           # (re)write plants/bundle.json
  python3 tools/build_bundle.py --check    # verify bundle.json is up to date (CI/guard); nonzero if stale
"""
import sys, json, os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANTS = os.path.join(REPO, "plants")
BUNDLE = os.path.join(PLANTS, "bundle.json")

# Fields the grid never reads — detail-page only. Stripped from the bundle to keep it lean.
# (Verified against app.js/reel.js/favorites.js: they never touch these; plant.js reads them
#  from the per-plant file it fetches itself.)
DROP = ("care", "references", "fact_src", "care_src")


def build():
    man = json.load(open(os.path.join(PLANTS, "manifest.json")))
    rels = man.get("plants", [])
    plants = []
    missing = []
    for rel in rels:
        pj = os.path.join(PLANTS, rel, "plant.json")
        if not os.path.exists(pj):
            missing.append(rel)
            continue
        rec = json.load(open(pj))
        rec = {k: v for k, v in rec.items() if k not in DROP}
        rec["dir"] = "plants/" + rel          # image base, exactly as loadSeed stamps it
        plants.append(rec)
    if missing:
        sys.stderr.write("WARNING: manifest lists plants with no plant.json:\n  " + "\n  ".join(missing) + "\n")

    collections = {}
    cpath = os.path.join(PLANTS, "collections.json")
    if os.path.exists(cpath):
        cj = json.load(open(cpath))
        collections = cj.get("collections", cj) or {}

    # compact (load speed) but one plant per line (readable diffs on a generated file)
    body = ",\n".join(json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in plants)
    cols = json.dumps(collections, ensure_ascii=False, separators=(",", ":"))
    return '{"plants":[\n' + body + '\n],"collections":' + cols + '}\n'


def main():
    check = "--check" in sys.argv[1:]
    out = build()
    if check:
        cur = open(BUNDLE, encoding="utf-8").read() if os.path.exists(BUNDLE) else ""
        if cur != out:
            sys.stderr.write("bundle.json is STALE — run `python3 tools/build_bundle.py` and commit.\n")
            sys.exit(1)
        print("bundle.json is up to date.")
        return
    open(BUNDLE, "w", encoding="utf-8").write(out)
    n = out.count("\n") - 1  # rough plant count via per-line body
    kb = len(out.encode("utf-8")) / 1024
    print(f"wrote {os.path.relpath(BUNDLE, REPO)}  ({kb:.0f} KB, {json.loads(out)['plants'].__len__()} plants)")


if __name__ == "__main__":
    main()
