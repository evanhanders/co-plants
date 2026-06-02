# TODO

_Nothing outstanding — all 27 plants are now self-hosted._

## Done

- **Self-host the 3 cultivar photos.** ✅ Garden clematis ('Jackmanii'), climbing rose,
  and rambling rose now carry repo-hosted reels (close-up + structure) hand-sourced from
  Wikimedia Commons, each with a `local:` ≤400px thumbnail + `full:` ≤1500px image, a
  remote `commons` fallback, and attribution in `plant.json` + `images/credits.json`.
  Tooling added: `tools/commons_search.py`, `commons_montage.py`, `commons_finalize.py`
  (the Commons twin of the iNat pipeline). All 24/27 → **27/27** self-hosted.

## Possible future polish

- **Fuller seasonal reels:** most plants are summer close-up + structure; sparse natives
  and single-season garden flowers could grow extra-season shots as better CC candidates
  surface. The iNat candidate pool (`tools/`, rebuildable) has more options per plant.
- **Trim early batch fulls:** a few batch-1 full images were saved at q85/1500px (~0.8 MB);
  re-running them through `finalize.py` (q82) would shave a little repo weight.
