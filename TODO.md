# TODO

_Nothing outstanding — all 27 plants are self-hosted with crisp, smart-cropped cards._

## Done

- **Crisp card thumbnails (high-DPI fix).** ✅ Cards render at 700px+ of device pixels on
  retina/phone screens, but thumbnails were capped at 400px and full-frame resized → they
  upscaled ~1.7–3× (soft) and portrait shots got an arbitrary center-crop. Added
  `tools/rethumb.py`, which rebuilds every `-t.jpg` from the sharp full image as a
  **720×480 (3:2) smart-crop** centered on the most interesting (sharpest) region. All 65
  thumbnails regenerated. Full images (lightbox) untouched.
- **Re-source soft photos.** ✅ Audited all 65 source images for genuine softness; only
  wild bergamot was actually soft. Replaced both its summer shots with crisp,
  filename-verified *Monarda fistulosa* photos from Wikimedia Commons (close-up ©
  Sixflashphoto, meadow stand © Hardyplants); winter seedhead kept.
- **Self-host the 3 cultivar photos.** ✅ Garden clematis ('Jackmanii'), climbing rose,
  and rambling rose carry repo-hosted reels (close-up + structure) hand-sourced from
  Wikimedia Commons, each with a `local:` thumbnail + `full:` ≤1500px image, a remote
  `commons` fallback, and attribution in `plant.json` + `images/credits.json`. Tooling
  added: `tools/commons_search.py`, `commons_montage.py`, `commons_finalize.py` (the
  Commons twin of the iNat pipeline). **27/27** self-hosted.

## Possible future polish

- **Fuller seasonal reels:** most plants are summer close-up + structure; sparse natives
  and single-season garden flowers could grow extra-season shots as better CC candidates
  surface. The iNat candidate pool (`tools/`, rebuildable) has more options per plant.
- **Thumbnail weight:** the 720×480 card thumbs total ~6.3 MB (up from ~2 MB at 400px).
  Fine for now; `rethumb.py` can drop to 640px or lower JPEG quality if repo weight ever
  matters — a small sharpness-for-size trade on high-DPI screens.
- **Trim early batch fulls:** a few batch-1 full images were saved at q85/1500px (~0.8 MB);
  re-running them through `finalize.py` (q82) would shave a little repo weight.
