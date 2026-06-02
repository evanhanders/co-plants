#!/usr/bin/env python3
"""Stream the iNat open-data photos table from stdin; keep rows whose observation_uuid
is in our kept-observations set (from filter_obs.py). Attribution-OK licenses only.
Out cols: photo_id ext license width height position observer_id slug season lat lon observed_on
"""
import sys

obs_path, out_path = sys.argv[1], sys.argv[2]
OK_LIC = {"CC0", "CC-BY", "CC-BY-SA", "CC-BY-NC", "CC-BY-NC-SA"}

meta = {}  # observation_uuid -> (slug, season, lat, lon, observed_on)
for line in open(obs_path):
    c = line.rstrip("\n").split("\t")
    if len(c) >= 6:
        meta[c[0]] = (c[1], c[2], c[3], c[4], c[5])

# photos cols: photo_uuid photo_id observation_uuid observer_id extension license width height position
PI, OU, EX, LI, WI, HE, PO = 1, 2, 4, 5, 6, 7, 8
inp = sys.stdin
inp.readline()
n = kept = 0
with open(out_path, "w") as w:
    for line in inp:
        n += 1
        c = line.rstrip("\n").split("\t")
        if len(c) < 9:
            continue
        m = meta.get(c[OU])
        if m is None or c[LI] not in OK_LIC:
            continue
        slug, season, lat, lon, od = m
        w.write("\t".join([c[PI], c[EX], c[LI], c[WI], c[HE], c[PO], c[3],
                           slug, season, lat, lon, od]) + "\n")
        kept += 1
sys.stderr.write(f"[photos] scanned {n} rows; kept {kept} photo candidates\n")
