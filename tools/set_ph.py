#!/usr/bin/env python3
"""Apply sourced soil-pH ranges to plant.json files.

Input is a JSON map of plant slug -> pH spec:

  { "<category>/<slug>": { "min": 5.5, "ideal": 6.2, "max": 7.0, "src": [1, 2] }, ... }

- "min"/"max" (required) are the tolerated soil-pH range; "ideal" (optional) is the
  sweet spot. Values are numbers on the standard 0-14 pH scale (garden range ~4-9).
- "src" is the list of `references` index numbers ([n]) that back the pH claim; it is
  written into the plant's `fact_src.ph` so the detail page cites it (run check_refs.py
  afterward to confirm each index resolves to a real reference).

The `ph` object is inserted just before `care` (matching the card-field -> ph -> care
schema order). Files are re-dumped with json.dump(indent=2, ensure_ascii=False) plus a
trailing newline, which is byte-stable against the existing files, so diffs show only
the added keys.

Usage:
  python3 tools/set_ph.py <ph_map.json> [plants_dir]
"""
import json
import sys
import os

# keys that mark the start of the post-card-field section; `ph` is inserted before the
# first of these that appears, so it lands right after the at-a-glance card fields.
_AFTER_CARD = ('care', 'fact_src', 'edible', 'references', 'shots')


def apply(path, spec):
    if not os.path.exists(path):
        raise SystemExit(f"missing: {path}")
    with open(path) as f:
        p = json.load(f)

    ph = {'min': spec['min']}
    if spec.get('ideal') is not None:
        ph['ideal'] = spec['ideal']
    ph['max'] = spec['max']

    new = {}
    inserted = False
    for k, v in p.items():
        if k == 'ph':
            continue  # drop any existing ph; re-inserted in canonical position
        if (not inserted) and k in _AFTER_CARD:
            new['ph'] = ph
            inserted = True
        new[k] = v
    if not inserted:
        new['ph'] = ph

    fs = new.get('fact_src')
    if fs is None:
        fs = {}
        new['fact_src'] = fs
    fs['ph'] = spec['src']

    with open(path, 'w') as f:
        json.dump(new, f, indent=2, ensure_ascii=False)
        f.write('\n')


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    m = json.load(open(sys.argv[1]))
    base = sys.argv[2] if len(sys.argv) > 2 else 'plants'
    n = 0
    for slug, spec in m.items():
        apply(os.path.join(base, slug, 'plant.json'), spec)
        n += 1
    print(f"applied pH to {n} plants")


if __name__ == '__main__':
    main()
