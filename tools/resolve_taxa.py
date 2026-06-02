#!/usr/bin/env python3
"""Resolve plant botanical names -> iNaturalist taxon_id sets (species + descendants).
Reads tools/species_map.json and a decompressed taxa.tsv (iNat open-data taxa table).
Writes <out>/taxonset.tsv  (taxon_id <TAB> slug)  and prints a coverage report.
"""
import json, sys, re, collections

taxa_path, map_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]

def norm(s):
    return re.sub(r"\s+", " ", s.replace("×", " ").replace("x ", " ").strip().lower()).strip()

cfg = json.load(open(map_path))
# wanted normalized name -> slug
want = {}
for p in cfg["plants"]:
    for n in p.get("names", []):
        want[norm(n)] = p["slug"]

# Pass 1: find primary species taxon_ids by exact (normalized) name; prefer active.
prim = {}     # taxon_id -> slug
rows = []      # (taxon_id, ancestry, name, active)
with open(taxa_path, encoding="utf-8") as f:
    header = f.readline().rstrip("\n").split("\t")
    ci = {c: i for i, c in enumerate(header)}
    for line in f:
        c = line.rstrip("\n").split("\t")
        if len(c) <= ci["name"]:
            continue
        tid, anc, name, active = c[ci["taxon_id"]], c[ci["ancestry"]], c[ci["name"]], c[ci["active"]]
        rows.append((tid, anc, name, active))
        nn = norm(name)
        if nn in want:
            slug = want[nn]
            # prefer active=true rows; don't overwrite an active hit with inactive
            if slug not in [s for s in prim.values()] or active == "true":
                prim[tid] = slug

# Build slug -> set(primary taxon_ids)
slug_prims = collections.defaultdict(set)
for tid, slug in prim.items():
    slug_prims[slug].add(tid)

# Pass 2: include descendants (ancestry contains /<prim>/ or ends with /<prim> ... actually
# descendants have the species tid somewhere in their ancestry path).
all_prims = set(prim)
out = {}  # taxon_id -> slug
for tid, slug in prim.items():
    out[tid] = slug
for tid, anc, name, active in rows:
    if not anc:
        continue
    parts = set(anc.split("/"))
    hit = parts & all_prims
    if hit:
        # map to the slug of the matched ancestor (pick deterministically)
        anc_tid = sorted(hit)[0]
        out.setdefault(tid, prim[anc_tid])

with open(f"{out_dir}/taxonset.tsv", "w") as w:
    for tid, slug in sorted(out.items()):
        w.write(f"{tid}\t{slug}\n")

# Report
by_slug = collections.Counter(out.values())
print(f"total taxon_ids: {len(out)}  across {len(by_slug)} plants")
for p in cfg["plants"]:
    slug = p["slug"]
    n = by_slug.get(slug, 0)
    flag = "" if n else "   <-- NO MATCH"
    print(f"  {n:4d}  {slug:34s} {','.join(p.get('names',[])) or '(none)'}{flag}")
