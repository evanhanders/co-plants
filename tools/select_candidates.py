#!/usr/bin/env python3
"""Rank the photo candidate pool (photos_keep.tsv) and pick a shortlist per plant for
visual review. Scores by resolution, Colorado/North-America locality, photo position,
and license permissiveness; spreads picks across seasons and distinct observations.
Writes <out>/shortlist.json : { slug: [ {photo_id,ext,lic,w,h,season,by,score,...} ] }
"""
import sys, json, collections, gzip

photos_path, observers_gz, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
PER_SLUG = int(sys.argv[4]) if len(sys.argv) > 4 else 16
PER_SEASON_MIN = 2

# observer_id -> display name
obs_name = {}
with gzip.open(observers_gz, "rt", encoding="utf-8") as f:
    f.readline()
    for line in f:
        c = line.rstrip("\n").split("\t")
        if len(c) >= 3:
            obs_name[c[0]] = c[2] or c[1]
        elif len(c) == 2:
            obs_name[c[0]] = c[1]

LIC_RANK = {"CC0": 3, "CC-BY": 3, "CC-BY-SA": 2, "CC-BY-NC": 1, "CC-BY-NC-SA": 1}

def num(x):
    try: return float(x)
    except: return None

def geo_bonus(lat, lon):
    if lat is None or lon is None: return 0
    if 36.5 <= lat <= 41.2 and -109.2 <= lon <= -101.8: return 600   # Colorado
    if 15 <= lat <= 72 and -170 <= lon <= -50: return 180            # North America
    return 0

# cols: photo_id ext license width height position observer_id slug season lat lon observed_on
rows = collections.defaultdict(list)
with open(photos_path) as f:
    for line in f:
        c = line.rstrip("\n").split("\t")
        if len(c) < 12: continue
        pid, ext, lic, w, h, pos, oid, slug, season, lat, lon, od = c[:12]
        w, h = num(w), num(h)
        if not w or not h or w < 600 or h < 600:   # need enough px for a 400 thumb + zoom
            continue
        latf, lonf = num(lat), num(lon)
        score = 0
        score += min(w*h, 6_000_000) / 30000            # resolution (capped)
        score += geo_bonus(latf, lonf)
        score += 40 if pos == "0" else 0                # lead photo often representative
        score += LIC_RANK.get(lic, 0) * 25
        rows[slug].append({
            "photo_id": pid, "ext": ext, "lic": lic, "w": int(w), "h": int(h),
            "pos": pos, "season": season, "by": obs_name.get(oid, "unknown"),
            "lat": latf, "lon": lonf, "observed_on": od, "score": round(score, 1),
            "link": f"https://www.inaturalist.org/photos/{pid}",
        })

shortlist = {}
for slug, cand in rows.items():
    cand.sort(key=lambda r: -r["score"])
    by_season = collections.defaultdict(list)
    for r in cand:
        by_season[r["season"]].append(r)
    picked, seen_obs = [], set()
    # round 1: guarantee a couple per season (distinct-ish), best first
    for s in ["spring", "summer", "fall", "winter", "na"]:
        for r in by_season.get(s, [])[:PER_SEASON_MIN]:
            picked.append(r)
    # round 2: fill remaining slots with the global best not already picked
    ids = {r["photo_id"] for r in picked}
    for r in cand:
        if len(picked) >= PER_SLUG: break
        if r["photo_id"] not in ids:
            picked.append(r); ids.add(r["photo_id"])
    picked.sort(key=lambda r: (["spring","summer","fall","winter","na"].index(r["season"]), -r["score"]))
    shortlist[slug] = picked[:PER_SLUG]

json.dump(shortlist, open(f"{out_dir}/shortlist.json", "w"), indent=1)
tot = sum(len(v) for v in shortlist.values())
print(f"shortlisted {tot} photos across {len(shortlist)} plants")
for slug in sorted(shortlist):
    seas = collections.Counter(r["season"] for r in shortlist[slug])
    print(f"  {len(shortlist[slug]):2d}  {slug:34s} " + " ".join(f"{k}:{v}" for k,v in seas.items()))
