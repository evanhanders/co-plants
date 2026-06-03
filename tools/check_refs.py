#!/usr/bin/env python3
"""Validate inline citation integrity on the plant detail pages.

Every claim on plant.html is cited with a [n] marker that must resolve to an entry in
that plant's `references` array (the page bibliography). This tool scans each plant.json
and checks that the citations and the bibliography line up. It is the structural companion
to check_citations.py (which checks that the cited URLs are reachable + on-topic).

For each plant it collects every citation number used in:
  - care.*      prose strings   (inline [n] / [n,m] markers)
  - edible.*    prose strings   (inline [n] / [n,m] markers)
  - fact_src.*  arrays          (the at-a-glance facts table citations)
and compares them against len(references):

  UNDEFINED  a [n] points past the end of `references` (or n<1)  -> hard error, exits 1
  ORPHAN     a references[] entry is never cited anywhere        -> warning
  UNCITED    plant has `care`/`edible` but no `references` at all -> warning (not yet migrated)
  NO-FACTSRC plant has a facts table but no `fact_src` map        -> warning

Usage:
  python3 tools/check_refs.py                       # all plants in the manifest
  python3 tools/check_refs.py plants/trees/chokecherry ...   # one or more dirs
"""
import json, os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")

def nums_in(text):
    out = []
    for m in MARK.finditer(text or ""):
        out += [int(x) for x in m.group(1).split(",")]
    return out

def plant_paths(args):
    if args:
        return [os.path.join(REPO, a, "plant.json") if not a.endswith(".json")
                else os.path.join(REPO, a) for a in args]
    man = json.load(open(os.path.join(REPO, "plants", "manifest.json")))
    return [os.path.join(REPO, "plants", p, "plant.json") for p in man["plants"]]

def audit(path):
    d = json.load(open(path))
    slug = os.path.dirname(path).replace(REPO + "/plants/", "").replace(REPO + "/", "")
    refs = d.get("references", [])
    used = set()
    for v in (d.get("care") or {}).values():
        used.update(nums_in(v))
    for v in (d.get("edible") or {}).values():
        if isinstance(v, str):
            used.update(nums_in(v))
    for v in (d.get("fact_src") or {}).values():
        used.update(int(x) for x in v)
    errors, warns = [], []
    if not refs and (d.get("care") or d.get("edible")):
        warns.append("UNCITED: has care/edible but no `references` bibliography")
    if d.get("care") and "fact_src" not in d:
        warns.append("NO-FACTSRC: has care but no `fact_src` for the facts table")
    for n in sorted(used):
        if n < 1 or n > len(refs):
            errors.append("UNDEFINED: [%d] but only %d reference(s)" % (n, len(refs)))
    for i in range(1, len(refs) + 1):
        if i not in used:
            warns.append("ORPHAN: references[%d] is never cited" % i)
    return slug, errors, warns

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    paths = plant_paths(args)
    n_err = n_warn = 0
    for p in paths:
        if not os.path.exists(p):
            print("MISSING %s" % p); n_err += 1; continue
        slug, errors, warns = audit(p)
        if errors or warns:
            print("\n%s" % slug)
            for e in errors:
                print("  \033[31m✗ %s\033[0m" % e); n_err += 1
            for w in warns:
                print("  \033[33m· %s\033[0m" % w); n_warn += 1
    print("\n" + "=" * 60)
    print("%d plant(s) | %d error(s), %d warning(s)" % (len(paths), n_err, n_warn))
    print("RESULT: " + ("FAIL" if n_err else "PASS"))
    sys.exit(1 if n_err else 0)
