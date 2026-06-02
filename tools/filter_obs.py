#!/usr/bin/env python3
"""Stream the iNat open-data observations table from stdin; keep research-grade rows
whose taxon_id is one of our targets. Reservoir-sample up to CAP per (slug, season)
so we get a time-spread sample (not just the oldest, low-res uploads).
Out cols: observation_uuid  slug  season  lat  lon  observed_on
"""
import sys, random
random.seed(13)

taxonset_path, out_path = sys.argv[1], sys.argv[2]
CAP = int(sys.argv[3]) if len(sys.argv) > 3 else 4000

tid2slug = {}
for line in open(taxonset_path):
    tid, slug = line.rstrip("\n").split("\t")
    tid2slug[tid] = slug

def season(d):
    # d = YYYY-MM-DD (assume N. hemisphere phenology)
    if not d or len(d) < 7:
        return "na"
    try:
        m = int(d[5:7])
    except ValueError:
        return "na"
    return ("winter","winter","spring","spring","spring","summer",
            "summer","summer","fall","fall","fall","winter")[m-1]

buckets = {}   # (slug,season) -> list (reservoir)
seen = {}      # (slug,season) -> count seen
TI = 5  # taxon_id col index
QG = 6  # quality_grade
OD = 7  # observed_on
LA = 2  # latitude
LO = 3  # longitude

inp = sys.stdin
inp.readline()  # header
n = 0
for line in inp:
    n += 1
    c = line.rstrip("\n").split("\t")
    if len(c) < 8:
        continue
    slug = tid2slug.get(c[TI])
    if slug is None or c[QG] != "research":
        continue
    s = season(c[OD])
    key = (slug, s)
    rec = (c[0], slug, s, c[LA], c[LO], c[OD])
    cnt = seen.get(key, 0) + 1
    seen[key] = cnt
    b = buckets.setdefault(key, [])
    if len(b) < CAP:
        b.append(rec)
    else:
        j = random.randint(0, cnt - 1)
        if j < CAP:
            b[j] = rec

with open(out_path, "w") as w:
    for key, b in buckets.items():
        for rec in b:
            w.write("\t".join(rec) + "\n")

import collections
by = collections.Counter()
for (slug, s), b in buckets.items():
    by[slug] += len(b)
sys.stderr.write(f"[obs] scanned {n} rows; kept {sum(len(b) for b in buckets.values())} obs across {len(by)} plants\n")
for slug in sorted(by):
    sys.stderr.write(f"  {by[slug]:5d}  {slug}\n")
