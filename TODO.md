# TODO

_149 plants, all self-hosted with smart-cropped cards, cited care/edible blocks, and
provenance on non-natives._

## Backlog — expand the thin sections

A distribution audit (June 2026) found several browse sections under-stocked relative to what
the Front Range supports. Add, in priority order, each through the full pipeline (CO weed-check →
card fields → iNat-sourced reel → cited care + edible + provenance). `(N)` native, `(I)` introduced.

- [x] **Ornamental grasses — biggest gap (was 2: blue oat grass, little bluestem).** DONE (June
  2026): added **blue grama**, **prairie dropseed**, **switchgrass**, **sideoats grama**, **Indian
  ricegrass**, and **feather reed grass 'Karl Foerster'** — section now 8. All weed-checked, photo
  reels sourced + QC'd, fully cited care/edible blocks. *(Mexican feather grass deliberately skipped
  — self-sows invasively in the West.)*
- [x] **Vines (7) — and zero were native.** DONE (June 2026): added **Rocky Mountain clematis**
  (*Clematis columbiana*), **western virgin's bower** (*Clematis ligusticifolia*), **riverbank
  grape** (*Vitis riparia*, edible), and **woodbine** (*Parthenocissus vitacea*, fall color) —
  section now 11, the guide's first native vines. All weed-checked, photo reels QC'd, fully cited
  care/edible blocks (grape carries the toxic-moonseed look-alike warning; woodbine flagged toxic).
- [x] **Fall forbs (5).** DONE (June 2026): added **showy goldenrod** (*Solidago speciosa*, the
  clumping keystone-pollinator goldenrod the guide lacked), **Maximilian sunflower** (*Helianthus
  maximiliani*, edible seeds+tubers), **showy goldeneye** (*Heliomeris multiflora*), and **aromatic
  aster** (*Symphyotrichum oblongifolium*, folded into the Asters family card) — section now 9. All
  weed-checked, photo reels QC'd, fully cited care/edible blocks.
- [x] **Shade plants (was only 3 of 163 tolerating real shade).** DONE (June 2026): added the
  drought-tolerant dry-shade set **bigroot geranium** (*G. macrorrhizum*), **coral bells**
  (*Heuchera sanguinea*), **epimedium/barrenwort** (*Epimedium grandiflorum*), **bergenia/pigsqueak**
  (*Bergenia cordifolia*), and the CO-native **starry false Solomon's seal** (*Maianthemum stellatum*) —
  the Shade filter now reads 8 (Part shade 89). All weed-checked, photo reels QC'd, fully cited
  care/edible blocks (Solomon's seal flagged edible-with-caution).

**All four thin-section backlog items above are now complete (June 2026).**

- [x] **Keystone-plant audit (June 2026).** Cross-referenced all guide genera against the NWF/Tallamy
  Great Plains – Ecoregion 9 keystone list (caterpillar hosts + specialist-bee plants). Coverage was
  already strong; added the genuine gaps (minus *Populus*/aspen — unhappy at Front-Range elevation):
  **showy & butterfly milkweed** (*Asclepias* — the monarch hosts), **purple prairie clover** (*Dalea*,
  N-fixer + bee keystone), **hairy golden aster** (*Heterotheca*), **false sunflower** (*Heliopsis*),
  **tansyaster** (*Dieteria*), **river hawthorn** (*Crataegus* — caterpillar keystone tree), and
  **curlycup gumweed** (*Grindelia* — #2 specialist-bee plant). All CO native, weed-checked, photo
  reels QC'd (incl. a monarch on showy milkweed), fully cited care/edible blocks.

_(Not gaps — intentional: high-water plants (6) are deprioritized in a semi-arid guide; winter
bloom (11) was just topped up with the winter-pollinator batch.)_

## Done

### Web QA / UX polish pass (bugs · a11y · sleekness · QOL)

- **Bug fixes.** ✅ (1) Tap-vs-swipe: a horizontal reel swipe no longer launches the
  lightbox on touch (10px move-threshold on the open; reel `touch-action` — see the
  reel/lightbox follow-ups below for its final `pan-x pan-y` value).
  (2) iOS no longer force-zooms on input focus (inputs bumped to 16px). (3) Adding a plant
  whose botanical duplicates a seed plant is now rejected with a message instead of silently
  overriding the card with no remove button. (4) Collapsing a group while a search is active
  no longer corrupts collapse state after clearing. (5) `winter` auto-detect now also reads
  the blurb; `isNative` uses a word-boundary test instead of a brittle substring.
- **Accessibility.** ✅ Photos keyboard-openable (`role=button`, `tabindex`, Enter/Space) with
  descriptive per-shot `alt`; group chevrons are real `<button>`s with `aria-expanded`;
  lightbox + add modal are `role=dialog aria-modal` with focus-in / Tab-trap / focus-return /
  Escape / body-scroll-lock; global `:focus-visible` ring; `prefers-reduced-motion`;
  season-tab `aria-label`/`aria-pressed`; label `for=` associations on the add form.
- **Sleek polish.** ✅ CSS-only loading skeleton; inline-SVG favicon + meta description +
  Open Graph/Twitter + theme-color; larger tap targets (season tabs 25→30px, lightbox
  controls 44px); lightbox top/side safe-area insets; deeper photo-strip scrim for contrast.
- **QOL features.** ✅ Trait filter chips (Winter/Pollinator/Spreads/Toxic) sharing one
  `TRAITS` map with the badges; per-filter counts on type/trait chips; always-on
  "Showing N of M" legend + **Clear all** button; shareable/reload-safe URL-hash state.

### Reel & lightbox follow-ups

- **Season tab mis-highlight.** ✅ A 4-panel plant's *fall* photo could light the *winter*
  tab. `curIdx()` now selects the panel whose actual `offsetLeft` is nearest `scrollLeft`
  instead of `Math.round(scrollLeft/clientWidth)` (which mis-rounded with fractional widths).
- **Static card photo strip (no scroll-chaining).** ✅ The season strip was a horizontal
  scroll-snap container, so a finger-drag scrolled the *strip* first and the page only at the
  boundary. It's now a **static stack**: all season photos are absolutely stacked and only the
  active one is shown (`.show`), swapped by the season dots (`setActive` toggles a class) — no
  `overflow-x`/`scroll-snap`/`scrollLeft` at all. The thumbnail is just the full image, and a
  drag scrolls the page immediately. (The full-size lightbox keeps its swipe.)
- **Swipeable lightbox gallery.** ✅ Enlarging a photo loads the whole reel; swipe
  left/right, arrow keys, or on-screen `‹ ›` buttons step through the full-size images with
  an "n / m" counter (nav hides for single-photo plants and at the ends; drag-follow with
  edge resistance; gated on not-zoomed so it doesn't fight pinch/pan).

## Earlier — self-hosting & thumbnails

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
