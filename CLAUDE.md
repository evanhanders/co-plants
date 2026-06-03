# CLAUDE.md — The Front Range Herbarium

The working guide for this project: how it's built, the conventions to follow, and
the workflows to run. This is a **living document** — keep it current as the project
evolves (see "Keeping this doc current" below). `index.html` is the source of truth
for exact data shapes; read it to confirm names/shapes before editing.

## Keeping this doc current

Treat CLAUDE.md as part of the codebase, not a one-time handoff:

- **When you change the workflow, conventions, or architecture, update this file in
  the same commit.** A new step, a new rule, a new gotcha, a renamed data structure —
  it goes here as you do it, not later.
- **When the roster changes** (add/remove/rename a plant, or upgrade a single photo
  to a reel), update the "Current plant roster" section to match.
- **When an item ships,** move it out of "Open work."
- **Prune stale guidance.** If something here no longer reflects the code, fix it or
  delete it — an out-of-date instruction is worse than none. Don't leave historical
  asides; describe how things *are now*.
- Keep the tone operational and present-tense: what to do, not what was once done.

## What this is

A plant field guide for the Colorado Front Range (Boulder area). Vanilla HTML/CSS/JS,
**no build step, no dependencies, no frameworks.** Served via GitHub Pages. Plant
content lives in per-plant data files that the page fetches at runtime.

- **Live site:** https://evanhanders.github.io/co-plants/
- **Repo:** `evanhanders/co-plants` (public)
- **Entry point:** `index.html` at the repo root (GitHub Pages serves it directly)
- **Title:** "The Front Range Herbarium" (was previously "Plantarium" — don't revert)
- **`.nojekyll`** is present so Pages serves every file (incl. the `plants/` tree) verbatim.

## How deploys work

Work happens in an ephemeral remote container: the repo is cloned fresh when the
container starts and reclaimed after inactivity, so **nothing survives unless it's
committed and pushed.** Deploys are just git:

1. Edit the relevant file(s) — `index.html`, `plant.html`, `styles.css`, `reel.js`,
   `app.js`, `plant.js`, or a `plants/.../plant.json`.
2. `git add -A && git commit && git push`.
3. GitHub Pages redeploys automatically; changes go live in a minute or two.

**Preview / self-check:** because the page `fetch()`es the plant data, `file://`
won't work — serve it over HTTP and validate from inside the container with `curl`
(the user can't reach the container's `localhost`):

```
python3 -m http.server 8000   # then curl http://localhost:8000/plants/manifest.json etc.
```

**Touch / swipe test (`tests/swipe.spec.mjs`).** The card photo-strip swipe is touch-input
behaviour that `curl` can't catch, so there's a real-browser regression test (Playwright +
Chromium, the same engine as Brave) that emulates a touchscreen and dispatches genuine touch
events via CDP — it verifies a horizontal swipe steps the season photo (both directions) and
a vertical drag scrolls the page without changing it. **Gotcha it guards:** the touched reel
must be **scrolled into view** or the touch lands off-screen and the test silently no-ops (a
below-the-fold reel was a false failure once). Run it after any change to `reel.js`'s
`wireReels` or the reel's `touch-action`:

```
npm install playwright && npx playwright install chromium   # one-time (gitignored)
python3 -m http.server 8077 &
node tests/swipe.spec.mjs
```

**Citation check (`tools/check_citations.py`).** Curls every plant's `care_src` and flags
DEAD / wrong-plant (REVIEW) / OK, failing if any plant has no reachable source — run it after
any `care_src` edit and as a periodic guard on the whole guide. It's step 3 of the care
pipeline (see "Sourcing care facts"); no dependencies, just Python:

```
python3 tools/check_citations.py            # audit all 68 plants
python3 tools/check_citations.py --strict   # also fail on zero content-verified sources
python3 tools/check_citations.py plants/perennials/knautia   # one or a few dirs
```

## Architecture

The site is a few plain files plus a tree of per-plant data:

```
index.html              # encyclopedia grid shell: markup only; links styles.css + reel.js + app.js
plant.html              # standalone per-plant detail page shell; links styles.css + reel.js + plant.js
styles.css              # all styling (grid + detail page)
reel.js                 # SHARED engine: shot resolution, the seasonal reel, the zoom/swipe
                        #   lightbox, and the TRAITS predicates/badges. Loaded first on both pages.
app.js                  # grid behaviour (render cards, filters, search, add modal, loader)
plant.js                # detail-page behaviour (fetch one plant, render the "sheet", set meta)
.nojekyll               # serve everything verbatim on Pages
plants/
  manifest.json         # { "plants": ["trees/chokecherry", ...] } — the list to load
  <category>/<slug>/
    plant.json          # one plant's full record (card fields + photo "shots" + optional care)
    images/             # repo-hosted photos: <shot>.jpg full + <shot>-t.jpg thumb + credits.json
```

**Two pages, one shared engine.** `index.html`+`app.js` is the encyclopedia grid;
`plant.html`+`plant.js` is the standalone detail page. Both `<script src="reel.js">` **first**
— `reel.js` owns everything photo-related (the reel render `plateHTML`, `wireReels`, the
lightbox + `wireLightbox(root)` delegation) plus the `TRAITS` map, `flagsHTML`, and
`natBadge`, so the grid cards and the detail sheet never drift. `plant.html` lives at the
repo root like `index.html`, so all root-relative paths (`plants/…`, `styles.css`,
`reel.js`) resolve identically — no path-base juggling.

**Load flow (in `app.js`):** on startup `loadSeed()` fetches `plants/manifest.json`,
then fetches every listed `plant.json` in parallel and assigns them to the in-memory
`SEED` array (stamping each with `dir = "plants/<category>/<slug>"` so its local
images resolve). `loadUser()` (localStorage-added plants) runs alongside it, then
`render()`. `SEED` order doesn't matter — the app sorts by common name and groups by
type via `groupOf()`.

**`plant.json` schema** (confirm exact shape in any file; `index.html` / a real
`plant.json` is the source of truth):

- The card fields: `common, botanical, type, native, blurb, size, sun, water,
  spread, seasons, wildlife, deer, toxic, winter, verified`.
- `commons:'File.jpg'` — legacy primary photo (a Commons filename). May be `""`. Once a
  plant has repo-hosted `shots`, this is just dead fallback metadata; new plants don't
  need it.
- `care:{…}` *(optional)* — the **grow-and-care detail** for the per-plant detail page
  (see "Detail page" below). A flat object of prose strings keyed by aspect; the detail
  renderer reads a fixed, ordered allow-list of keys (`CARE_FIELDS` in `plant.js`) and skips
  any that are absent, so a plant can fill in as many or as few as apply. Current keys:
  `hardiness, planting, sun, soil, water, spacing, propagation, sow, stratify, depth, bloom,
  feeding, maintenance, selfsow, troubles, harvest, companions`. Two of these carry specific
  intent: **`planting`** = *when to plant outside on the Front Range, covering both in the
  ground and in pots/containers* (containers dry faster and their roots are far less
  cold-hardy, so they need their own timing/overwintering note); **`propagation`** = *how to
  propagate by seed **and** by non-seed means* (division, cuttings, layering…). Keep each
  value a short paragraph of Front-Range-specific, practical guidance. Add a new aspect by
  extending `CARE_FIELDS` (key + display label) — no other code change needed.
- `care_src:[…]` *(optional, but required whenever `care` is present)* — the **provenance
  for the care facts**, mirroring photo attribution. A list of `{ name, url }` sources the
  care prose was compiled from; the detail page renders them as a "Care notes compiled
  from …" line under the grow-and-care grid (`careSrcHTML` in `plant.js`). Cite the actual
  authorities you drew from — don't pad it. See "Sourcing care facts" below for the
  trusted-source priority and the rule against uncited claims.
- `shots:[…]` *(optional)* — an ordered seasonal reel; each entry is one photo panel.
  Fields: `{ local, full, url | commons | try:[a,b], s?, cap?, by?, lic?, link? }`.
  - `local:'images/foo-t.jpg'` — repo-hosted **card thumbnail** shown in the grid
    (resolved against the plant's `dir`). It's a **720×480 (3:2) smart-crop** so it stays
    crisp on retina/phone screens, where the card image area is 700px+ of device pixels;
    `tools/rethumb.py` generates these (see below). This is what the encyclopedia grid loads.
  - `full:'images/foo.jpg'` — repo-hosted **full-size image (≤1500px)** opened in the
    zoom lightbox when the card photo is clicked.
  - `url` / `commons` / `try:[…]` — remote fallbacks (iNat `large` URL, or a Commons
    filename via `Special:FilePath`) used only if the local file is missing.
  - `s` — `'spring'|'summer'|'fall'|'winter'` (drives the season tab icon).
  - `cap` — caption shown under the photo; bake the attribution in, e.g.
    `"Spring — flower racemes · © Jane Doe (CC-BY) / iNaturalist"`.
  - `by`/`lic`/`link` — photographer, license, and source page (attribution record).

**Image resolution** (`shotsFor` → `shotCandidates`): per shot the **card thumbnail**
tries **local → try[] → url → commons** (each Commons name via `Special:FilePath`); the
`<img onerror>` handler (`__imgnext`) walks to the next candidate, then to a
"coming soon"/"unavailable" placeholder. The **lightbox full image** (`shotFull`) uses
`full` (local) if present, else upgrades the remote candidate to a 2000px render. A
plant with no `shots` falls back to `commons`, then `photo`. **Self-hosting is
non-breaking:** the remote `url`/`commons` stays as a safety net under the local files.

### Detail page ("go into a plant")

Each plant has a full **standalone detail page** reachable from its card (the card title and
the "Grow & care details →" link both point to it). It's a **real separate page** —
`plant.html?p=<category>/<slug>` (e.g. `plant.html?p=annuals/rocky-mountain-bee-plant`) —
not a hash route, so it's its own URL with a full reload and its own `<title>`/meta. One
generic `plant.html` serves every plant: `plant.js` reads the slug from the query string,
`fetch()`es that single `plants/<slug>/plant.json` (stamping `dir` exactly like the grid
loader), and renders the sheet. **It reuses the reel + lightbox + shot-resolution code from
`reel.js` verbatim** (the hero is just a bigger `.plate`; `wireReels(detail)` +
`wireLightbox(detail)` cover it).

`renderDetail(p)` builds a masthead-style **sheet**: hero photo reel + name/botanical/
blurb/badges/trait-flags, an **"At a glance"** facts table (the same card fields), a
**"Growing & care on the Front Range"** grid built from the plant's `care` object (with a
"Care notes compiled from …" source line beneath it from `care_src`), and a
**"Photographs"** credits list (photographer · license · source per shot).
`setMeta(p)` updates `document.title` + the `og:`/`description` tags to name the plant.
The page has a slim masthead (the wordmark links home) and a "‹ Back to the herbarium"
link (`href="index.html"`) top and bottom. To extend a plant's detail page, add/extend its
`care` object — no per-plant code. (The grid's own filters live in the URL hash on
`index.html`; navigating to a detail page is a normal link, and Back returns to the grid.)

### UI features

Cards grouped by plant type (collapsible) with an A–Z toggle, a search box, a
weed-gated "add plant" form, and a per-season photo strip you flip with the season dots
(the strip is deliberately *not* finger-swipeable — see the tap-vs-swipe note). The card
shows a small thumbnail; clicking (or `Enter`/`Space` on it — the photos are keyboard-focusable)
opens the full-size image in a pinch/scroll zoom lightbox. The lightbox is a **swipeable
gallery**: it loads the whole reel, so swipe left/right, arrow keys, or the on-screen
`‹ ›` buttons step through that plant's full-size photos (with an "n / m" counter; nav
hides for single-photo plants and at the ends).
**Photos must be real CC-licensed photographs — no illustrations.** (See "Image
requirements & sourcing" below for the per-plant photo spec.)

**Filtering & state.** Three filter axes compose: **Origin** (Both/Native/Introduced),
**Type** chips (with counts), and **Trait** chips (`Winter`/`Pollinator`/`Spreads`/`Toxic`),
plus the free-text search. The trait predicates live in one place — the `TRAITS` map in
`app.js` — and are shared by *both* the card badges and the trait filter, so the two never
drift; add a new trait by extending that map (and a `passesFilters` clause). The legend
always reads "Showing N of M specimens" and shows a **Clear all** button when anything is
active. Filter/search/view state is mirrored into the **URL hash** (`#view=…&nat=…&type=…&trait=…&q=…`)
via `syncHash()`/`applyHash()`, so filtered views are shareable and survive a reload.

**Accessibility.** Photos are `role="button" tabindex="0"` with descriptive per-shot `alt`;
group-collapse chevrons are real `<button>`s with `aria-expanded`; the lightbox and add
modal are `role="dialog" aria-modal` with focus move-in, a Tab focus-trap, focus-return to
the trigger, and `Escape` to close (both also lock body scroll). There's a global
`:focus-visible` ring (rust) and a `prefers-reduced-motion` block. Inputs are 16px so iOS
doesn't force-zoom on focus. A CSS-only skeleton (`.skel`) shows while `plant.json`s fetch.

### Card photo strip = static stack (already fixed — don't regress)

The per-season strip is **not a scroll container.** All of a plant's season photos are
absolutely stacked inside `.reel`; only the active one carries `.show` (`display:block`),
the rest are `display:none` (`.reel .shot:not(.show)`). The season **dots** call
`setActive(i)`, which toggles `.show` on the figures and `.on`/`aria-pressed` on the dots —
there is **no `overflow-x`, no `scroll-snap`, no scrolling.** This is deliberate: the old
scroll-snap reel caused **scroll-chaining** on touch (a finger-drag on a photo scrolled the
strip first, then the page only at the boundary). **Don't reintroduce
`overflow-x`/`scroll-snap`/`scrollLeft`-based tab detection on `.reel`.**

**Finger-swipe IS supported — but via pointer events, not scrolling.** `wireReels` adds
`pointerdown`/`pointerup` on each `.reel`: a **horizontal-dominant** swipe past ~40px steps
the season (`setActive(cur±1)`), while a vertical drag does nothing here so the **page still
scrolls** (no capture, no `preventDefault`, no overflow → no scroll-chaining). This is the
safe way to have swipe; keep it pointer-based. **Critical:** `.reel`/`.shot img` must carry
`touch-action: pan-y` in CSS — without it a touchscreen claims the horizontal drag as a
scroll and fires `pointercancel` instead of `pointerup`, so the swipe silently never fires
(this is exactly the bug that made it "do nothing" on touch). `pan-y` reserves the horizontal
axis for the handler while still allowing vertical page scroll.

### Tap-vs-swipe gotcha (already fixed — don't regress)

Three gestures on a card photo, distinguished by movement: a **tap** (no move) opens the
lightbox; a **horizontal swipe** changes the season (above); a **vertical drag** scrolls the
page. The lightbox-open is gated on a **move-threshold** (`content` tracks `pointerdown`/
`pointermove`; the `click` handler bails if the pointer moved >10px, `tapMoved`) so a swipe
or scroll-drag that starts on a photo never flings you into the lightbox on release. (The
full-size **lightbox** is its own swipeable gallery — see UI features.)

## The plant card fields

Every plant records:

- **Mature size** (Height × Width)
- **Sun** requirement
- **Water** requirement
- **Spread / habit** (clumping vs. running/self-sowing)
- **Seasonal appearance** — including **winter** (this guide cares about winter
  interest specifically)
- **Wildlife / pollinator** value
- **Deer** note (resistant or not)
- **Toxicity** note (to people/pets/livestock)
- **Weed-verification date** — "verified non-weed as of [date]"

## Workflow: adding ("saving") a plant

When the user says "save this plant" / "add this plant," it means add it to the
hosted herbarium. The order matters:

1. **Verify it's not a noxious/invasive weed in Colorado.** Check against the CO
   Dept. of Agriculture noxious weed lists (A, B, C) **and** the Watch List. Record
   the date as "verified non-weed as of [date]." Re-verify if an existing date is a
   year+ old or before a big planting.
2. **Gather the card fields** above (size, sun, water, spread, seasons incl.
   winter, wildlife, deer, toxicity).
3. **Source repo-hosted photos** meeting the per-plant spec in "Image requirements &
   sourcing" below (close-up + structure, right species, open-licensed, upright).
4. **Show the user the image(s) and the blurb in chat for sign-off first.** Don't
   create the plant file until the visual + blurb are approved.
5. **After approval,** create `plants/<category>/<slug>/plant.json` (with a `shots`
   array if you have multiple seasonal photos), add its `"<category>/<slug>"` path to
   `plants/manifest.json`, then commit and push. Category folder follows `groupOf()`
   (trees, shrubs, subshrubs, grasses, perennials, annuals, vines); slug is the
   common name lowercased and hyphenated. No giant array to edit anymore — one new
   file plus one manifest line.

## Image requirements & sourcing

**Images are repo-hosted, not hotlinked.** The guide must not depend on a remote host
staying up, so every shot's photo lives in the plant's `images/` folder. Remote
`url`/`commons` stays only as a thin fallback.

**Per-plant photo spec** — for each plant aim for, at minimum:

1. **A close-up** showing leaves *and* flowers (the identifying detail).
2. **A wider "structure" shot** showing how the whole plant grows (habit/form).
3. **Same species** as the record — verify the photo actually shows the right plant,
   not a look-alike (check the source taxon, and eyeball it against known features).
4. **Open-licensed / OK to reuse** — CC0, CC-BY, CC-BY-SA, or (this is a non-commercial
   personal guide) CC-BY-NC / CC-BY-NC-SA. Never "All Rights Reserved", never a
   copyrighted nursery/blog photo. Always record attribution.
5. **A photograph, not a drawing/illustration.**
6. **Oriented upright, not rotated** — apply EXIF orientation when processing; reject
   sideways/upside-down shots.

**Nice-to-have:** a matching close-up + structure pair **for each season** (spring /
summer / fall / winter), so the reel tells the year-round story — especially where the
plant changes a lot (fall color, winter stems/seedheads). Don't pad the reel with
near-duplicate summer shots just to hit four tabs.

**Each image ships in two sizes:** a **720×480 (3:2) smart-cropped thumbnail**
(`local:`, what the card grid loads) and a **≤1500px full image** (`full:`, what the
zoom lightbox opens). The `finalize.py` / `commons_finalize.py` tools write the full
image plus a provisional thumb; **`tools/rethumb.py` then (re)generates every card
thumbnail** — it crops each full image to the card's 3:2 plate around the most
*interesting* region (sharpest/highest-edge band, mild center bias) and resizes to
720×480, so cards stay crisp on retina/phone screens and the subject is framed rather
than arbitrarily center-cropped. The uncropped full image is untouched. Run it after any
finalize, or `python3 tools/rethumb.py plants/<cat>/<slug>` for one plant. Keep files
lean (JPEG q≈82–85) — this is a git repo.

### Where the photos come from (this environment)

Three CC photo sources are reachable from the container (verify with a quick `curl`
if in doubt):

1. The **iNaturalist API** (`api.inaturalist.org`) — a real search endpoint. This is
   the **fast path** for sourcing: query observations by taxon + place + license and
   get photo IDs back in seconds, no bulk download. **Use this first.**
2. The **iNaturalist open-data set on S3** (`inaturalist-open-data.s3.amazonaws.com`) —
   where the full-res files actually live (`…/photos/{photo_id}/{medium|large|original}.{ext}`),
   holding only CC0 / CC-BY / CC-BY-NC photos. `finalize.py` pulls from here.
3. **Wikimedia Commons** (`*.wikimedia.org`) — its own search API, used for the
   hand-sourced cultivars (the Commons pipeline below). Wikimedia rate-limits hard:
   always send a descriptive `User-Agent`, throttle, and back off on HTTP 429.

Always send a descriptive `User-Agent` (e.g. `co-plants-herbarium/1.0 (evanhanders@gmail.com)`)
to the iNat API too. The whole pipeline lives in `tools/` and is reusable.

**iNat API path (preferred — used for most plants):** `tools/inat_montage.py` automates
steps 1–3 — `python3 tools/inat_montage.py "<cat/slug>" "<Botanical name>" [place_id]
[--global]` resolves the active taxon, pulls CC photos (Colorado `place_id=34` by default,
auto-widening to global if too few; pass `--global` up front for non-CO garden cultivars),
writes a labeled `montage.jpg` to review and appends the per-slug `shortlist.json` entry.
Set `PHOTOWORK=/tmp/<dir>` to run several in parallel without collisions.

1. **Resolve the taxon.** `GET /v1/taxa?q=<botanical name>` → the **active** taxon id —
   names drift (Rocky Mountain bee plant is now *Cleomella serrulata*; the old *Peritoma
   serrulata* taxon is inactive). Colorado's `place_id` is **34**.
2. **Pull CC candidates.** `GET /v1/observations?taxon_id=<id>&place_id=34&photo_license=cc0,cc-by,cc-by-nc&quality_grade=research&order_by=votes&per_page=60`;
   dedupe by photo id (and observer for variety).
3. **Montage + review.** Tile medium thumbs into one labeled contact-sheet, **`Read` it**,
   and pick the best close-up + structure, **checking species + orientation on each tile**.
4. **Finalize + thumbnails** (below) — hand-write `picks.json` `{i, kind, s, cap}` against
   the `shortlist.json`, then run `finalize.py` and `rethumb.py`.
5. **Verify the result (REQUIRED — "are these the right images?").** After finalize+rethumb,
   tile the **final card thumbnails** (`plants/*/images/*-t.jpg`) into one labeled contact-sheet
   and **`Read` it**, confirming every shot is the **correct species** (not a look-alike or a
   mislabeled observation), upright, and in focus — verify **both** the close-up and the habit
   shot, not just one. Re-pick and re-finalize any that are wrong, weak, or ambiguous before
   committing. (This QC caught the ice-plant + twinberry close-ups in the 16-plant batch.)

Pillow is required (`pip install Pillow` if missing). The bee-plant add ran this end-to-end.

**Finalize + thumbnails (shared tail, any source):**

| step | tool | what it does |
|------|------|--------------|
| finalize | `finalize.py <shortlist.json> <picks.json>` | for each pick downloads the largest open-data render, EXIF-orients, writes the `images/<season>-<kind>.jpg` full image (≤1400px, +a provisional `-t.jpg`), rewrites that plant's `shots[]`, and drops `images/credits.json`. `shortlist.json` is just a list per slug of `{photo_id, ext, by, lic, link, season}`; `picks.json` indexes into it with `{i, kind, s, cap}`. Both can be hand-written from the API results — you don't need `select_candidates.py`. |
| thumbnails | `rethumb.py` | (re)generates every `-t.jpg` as a 720×480 smart-crop from the full image — run it after any finalize (see "Image requirements & sourcing"). |

**Bulk fallback — streaming the open-data tables** (only if the API is unavailable or
you need a wider pool than the API surfaces): `species_map.json` + `resolve_taxa.py` map
names→taxa, then `build_index.sh` (`filter_obs.py`, `filter_photos.py`) streams
`observations.csv.gz` (12GB) + `photos.csv.gz` (18GB) from S3 to a `photos_keep.tsv` pool
in `/tmp/imgwork` (~10–15 min; run in background), `select_candidates.py` ranks it into
`shortlist.json`, and `fetch_montage.py` builds the contact sheets. Same `finalize.py` /
`rethumb.py` tail. Keep `species_map.json` current either way so this stays runnable.

**Wikimedia Commons pipeline** (used for the 3 vine cultivars — climbing & rambling
roses and 'Jackmanii' clematis, which have no clean iNat taxon — and to hand-replace
any photo that needs a better shot, e.g. wild bergamot's soft summer pair):

| step | tool | what it does |
|------|------|--------------|
| search + review | `commons_search.py <slug> "query"…` | hits the Commons API (`list=search` in the File: namespace), reads `imageinfo` (URL + size + license + artist via `extmetadata`), keeps only free licenses + raster photos, downloads review thumbs (via `iiurlwidth`, with 429 backoff), and writes `/tmp/commonswork/<slug>/candidates.json`. |
| montage | `commons_montage.py <slug>` | tiles those thumbs into one labeled contact-sheet (`montage.jpg`). **`Read` it and pick** the close-up + structure, verifying cultivar/orientation. |
| finalize | `commons_finalize.py commons_picks.json` | the Commons twin of `finalize.py`: downloads each pick's full Commons original, EXIF-orients, writes `images/<season>-<kind>.jpg` (+ provisional `-t.jpg`), rewrites `plant.json` `shots[]` (with a `commons:` remote fallback + attribution), and drops `images/credits.json`. Run `rethumb.py` afterward for the final card thumbs. **Note:** it rewrites the whole `shots[]`, so to replace only some shots of a multi-shot plant, finalize the new ones then re-add the kept shots to `plant.json` + `credits.json` by hand (as done for bergamot's winter seedhead). |

- The `shots` schema accepts `commons:`/`try:` titles resolved via `Special:FilePath`
  (app.js tries `local → try[] → url → commons`). Verify the exact `File:Name.jpg`
  resolves and prefer the **species-specific search/subcategory** to dodge look-alikes.
- **Fallback:** the user can always paste a Commons `File:Name.jpg` title (or any direct
  CC image URL) and you wire it in.

## Sourcing care facts (the detail-page `care` block)

Care facts get the **same provenance rigor as photos and weed-checks** — no uncited
horticultural claims. When you fill in a plant's `care` object, ground the specifics
(stratification weeks, sowing depth, germination temp/days, pH, spacing, bloom window)
against a trusted authority and record what you used in `care_src` so the page shows it.
**Verify reachability with a quick `curl` and always send a descriptive `User-Agent`**
(`co-plants-herbarium/1.0 (evanhanders@gmail.com)`) — several of these 403 or 301 without
one.

**Trusted care-fact sources** (prefer the most authoritative + most local; stop when the
facts are covered):

1. **Front-Range-specific first** — **CSU Extension – Yard & Garden** (`extension.colostate.edu`),
   its plant-specific **PlantTalk Colorado** (`planttalk.colostate.edu`) and **CMG GardenNotes**
   (`cmg.extension.colostate.edu`), **Plant Select** (`plantselect.org`, the CSU + Denver
   Botanic Gardens program — the authority for its own introductions like Mojave sage), and
   **Denver Urban Gardens** (`dug.org` — a Denver nonprofit; its **Companion Planting Guide**
   is the go-to for the `companions` field). These speak to how a plant performs here (alkaline
   clay, semi-arid, ~USDA 5b–6a, mid-May last frost, high-altitude sun).
2. **Species authority** — for **natives**: **USDA Forest Service / Western Forbs**
   (`westernforbs.org`), **USDA NRCS Plant Guides + PLANTS Database** (`plants.usda.gov`), the
   **USDA-FS FEIS** fire-ecology database, and the **Lady Bird Johnson Wildflower Center**
   (`wildflower.org`, needs a UA). For **garden ornamentals & cultivars** (peony, dahlia,
   clematis, roses): the **RHS** (`rhs.org.uk` — best for clematis pruning groups & rose
   pruning) and the **Missouri Botanical Garden Plant Finder** (`missouribotanicalgarden.org`).
   Other university extensions (**NC State Plant Toolbox**, **Utah State**) are solid generalists.
3. **Cross-check / last resort** — Wikipedia and reputable references, only to corroborate,
   never as the sole citation for a hard number. **Don't cite blogs or nursery product pages**
   when an authority covers the fact.

**The care pipeline** — run all four steps. At scale (a batch of plants), **fan out across
parallel agents**: one type-batch per agent (trees/shrubs, native perennials, garden
perennials, sages/lilac, annuals/vines…), each owning **distinct** `plant.json` files so there
are no write conflicts, each reporting its changes back; the parent validates every diff before
promoting. The first full rollout (27 plants) ran as 5 agents twice — once to write, once to
fact-check.

1. **Source & write.** `WebFetch` the highest-priority reachable source(s); read off
   sun/soil/pH/water/sowing/stratification/germination/spacing/bloom/pruning and write each
   `care` value as a short, practical, **Front-Range-adapted** paragraph. The local framing
   (Boulder frost dates, alkaline clay) is editorial — cite the Front-Range authority for it,
   don't over-claim a species page.
2. **Record sources honestly.** List the **actual** sources you read in `care_src` as
   `{ name, url }`. If a number came from Western Forbs, cite Western Forbs — don't list a
   source you didn't open.
3. **Citation-honesty pass — run `python3 tools/check_citations.py`.** It curls every
   `care_src` across all plants and classifies each: **DEAD** (non-200), **REVIEW** (200 but
   the page text never names the plant's genus/species — this is what catches a URL that
   resolves to the **wrong plant**, e.g. a fabricated MBG `kempercode`/RHS numeric ID serving
   boxwood or a daffodil), or **OK**. It exits non-zero if any plant has no reachable source
   (`--strict` also fails on zero content-verified sources). Act on the report: **drop dead
   links** and **blog/nursery citations** where an authority already covers the fact, **replace
   wrong-plant URLs** with a verified authority page, and make sure **every plant keeps ≥1
   reachable authoritative source**. (REVIEW is often just a JS-rendered authority — USDA
   PLANTS, LBJ Wildflower Center, RHS render plant data client-side, so the genus isn't in the
   raw HTML; open it and confirm before dropping. Real catches from this pass: ~20 MBG/RHS IDs
   that resolved to the wrong species, plus a rose page cited under a cosmos.)
4. **Fact-check / accuracy pass.** Re-verify each claim against the cited authority and
   **correct outright errors in place** (surgical edits, preserve the voice), logging each as
   `field: OLD → NEW (source)`. Scrutinize the **high-risk claim types**: hardiness USDA zone,
   bloom window, mature height × width, spacing, soil pH, stratification weeks/temp, germination
   days/temp, sowing/planting depth, **pruning group & timing & method**, division cadence,
   toxicity, and native vs introduced status. (This pass caught ~20 errors across the first 28
   — e.g. a lilac told to renewal-prune in winter, which strips the flower buds it set the prior
   summer; a Mojave sage told to skip the fall prune Plant Select actually recommends; a
   snapdragon "refrigerate the seed" claim with no support; several understated mature sizes
   and hardiness floors.)

The prototype (Rocky Mountain bee plant) was sourced this way: the hard numbers
(pH 6.0–7.6, 2–6 wk cold-moist stratification, 0.1–0.25 in sowing depth, 5–20 day
germination at ~68/50°F, 24–36 in row spacing) come from the USDA-FS Western Forbs
monograph, with CSU Extension cited for the Front-Range timing.

## Weed-verification gotchas

- **Clematis:** garden/large-flowered hybrids (e.g. 'Jackmanii', *C. viticella*) are
  fine. But ***Clematis orientalis*** (Chinese / orange-peel clematis) is a **CO List B
  noxious weed**, and that covers **all** its subspecies and cultivars, including
  'Bill MacKenzie'. Avoid the yellow orange-peel types.
- **Lupine:** native silvery lupine (*Lupinus argenteus*) is the keeper. **Avoid**
  bigleaf/Russell hybrid lupine (*Lupinus polyphyllus*) — not CO-native and invasive
  in some regions. All lupines carry toxic alkaloids.
- All **euphorbias** have toxic/irritant milky sap (gloves; caution with kids/pets).
- **Centaurea:** the noxious ones are the **knapweeds** — diffuse (*C. diffusa*), spotted
  (*C. stoebe*), yellow starthistle (*C. solstitialis*), and the *moncktonii/virgata/psammogena*
  group are all CO-listed. Garden **mountain bluet / perennial cornflower** (*C. montana*) is
  **not** listed, but it self-sows and runs by rhizome — deadhead before seed set and divide to
  contain. Don't confuse it with the knapweeds.
- **Chamomile:** the garden chamomiles are fine — **German chamomile** (*Matricaria
  chamomilla*, the tea annual) and **Roman chamomile** (*Chamaemelum nobile*). But
  ***scentless chamomile*** (*Tripleurospermum perforatum*, syn. *Matricaria perforata*) is a
  **CO List B noxious weed**, and **mayweed chamomile** (*Anthemis cotula*) is also weedy —
  both look daisy-like; don't confuse them with the herb. The tell: German chamomile is
  sweetly apple-scented with a hollow, domed/conical disc.

## Trusted resources

- **CO Dept. of Agriculture** noxious weed lists A/B/C + Watch List (weed check)
- **CSU Extension — Yard & Garden:**
  https://extension.colostate.edu/topic-areas/yard-garden/ (how plants perform on
  the Front Range) — also the lead **care-fact** source (see "Sourcing care facts")
- **Denver Urban Gardens (DUG)** — Denver nonprofit; its **Companion Planting Guide**
  (https://dug.org/gardening-resources/companion-planting/) is the go-to local source for
  the detail-page `companions` field
- **Care-fact authorities** (for the detail-page `care`/`care_src`): **Plant Select**
  (plantselect.org), **USDA Forest Service / Western Forbs** (westernforbs.org), **USDA
  NRCS / PLANTS** (plants.usda.gov), **Lady Bird Johnson Wildflower Center**
  (wildflower.org, send a UA), and **RHS** (rhs.org.uk) for garden cultivars
- **MASA Seed Foundation** (Boulder) — trusted local native seed source;
  nursery@masaseedfoundation.org
- **BBB Seed** (Colorado) and **Great Basin Seeds** (Utah) — seed backups

## Current plant roster (in the live site)

**68 specimens**, all verified non-weed in CO and all carrying a full `care` block (incl.
`planting` + `propagation`) **and a repo-hosted photo reel** (close-up + structure, seasonal
where good shots exist). Grouped by type below (the order the site uses). Photos were sourced
mostly from the iNaturalist open dataset via `tools/inat_montage.py` (note: the yellow
'Mersea Yellow' pineleaf penstemon came from *cultivated* iNat observations — pass through the
research-grade filter only by querying without `quality_grade=research`, since garden
cultivars log as "casual"); cultivars with no clean iNat taxon (the vine
roses/clematis, 'Dropmore Scarlet' & 'Rozanne', white 'Icicle' speedwell, 'Moonshine' yarrow)
were hand-sourced from Wikimedia Commons (`commons_search.py` → `commons_finalize.py`). Every
shot keeps a remote `commons`/`url` fallback; card thumbnails are 720×480 smart-crops
(`tools/rethumb.py`). (N) = CO/regional native, (I) = introduced/vetted.

**Trees**
- Chokecherry (*Prunus virginiana*) (N) — spring flowers / summer + fall fruit
- Mountain alder, ssp. *tenuifolia* (*Alnus incana*) (N) — catkins / leaves+cones / fall

**Shrubs**
- Red-twig dogwood (*Cornus sericea*) (N) — summer cymes / fall berries / winter red stems
- Wood's rose (*Rosa woodsii*) (N) — summer flower / habit / fall hips / winter hip
- Common lilac (*Syringa vulgaris*) (I) — blooming-shrub habit / panicle / foliage
- Twinberry honeysuckle (*Lonicera involucrata*) (N) — moist-site native shrub honeysuckle
- Mock orange (*Philadelphus lewisii* 'Cheyenne') (N) — fragrant native, Plant Select
- Smoke tree (*Cotinus coggygria*) (I) — purple foliage + smoky plumes
- Creeping Oregon grape (*Berberis repens*, syn. *Mahonia repens*) (N) — low evergreen native; yellow flowers, blue berries

**Subshrubs**
- Mojave sage (*Salvia pachyphylla*) (I) — flower closeup / silvery mounded shrub
- Russian sage (*Salvia yangii*, syn. *Perovskia atriplicifolia*) (I) — airy habit / flowers / fall spikes
- Lavender (*Lavandula angustifolia*) (I) — English lavender ('Munstead'/'Hidcote')
- Pineleaf penstemon (*Penstemon pinifolius* 'Mersea Yellow') (I) — yellow-flowered SW native; needle foliage, hummingbird tubular blooms

**Ornamental grasses**
- Little bluestem (*Schizachyrium scoparium*) (N) — summer clump / fall copper / winter seedheads
- Blue oat grass (*Helictotrichon sempervirens*) (I) — steel-blue evergreen fountain / oat-like sprays

**Perennials**
- Cushion spurge (*Euphorbia polychroma*) (I) — chartreuse bracts / plants in leaf
- Horned spurge (*Euphorbia brachycera*) (N) — cyathia / glaucous habit
- Silvery lupine (*Lupinus argenteus*) (N) — silvery foliage / flower spike / habit
- Garden peony (*Paeonia lactiflora*) (I) — white blooms / post-bloom foliage
- Dahlia (*Dahlia × hortensis*) (I) — double bloom / border habit; **tender, not winter-hardy**
- Oriental poppy (*Papaver orientale*) (I) — bloom / blooms+buds habit
- Colorado blue columbine (*Aquilegia coerulea*) (N) — face-on bloom / whole plant
- Shasta daisy (*Leucanthemum × superbum*) (I) — flower closeup / flowering clump
- Aspen fleabane (*Erigeron speciosus*) (N) — ray flower / clump in rock crevice
- Salvia / meadow sage (*Salvia nemorosa*) (I) — flower spike / mounded clump
- Wild bergamot (*Monarda fistulosa*) (N) — flowerhead / meadow stand / winter seedhead
- Scarlet bee balm (*Monarda didyma*) (I) — scarlet flowerhead / flowers+foliage
- Blue flax (*Linum lewisii*) (N) — xeric native, sky-blue morning flowers
- Cheddar pinks (*Dianthus gratianopolitanus*) (I) — clove-scented mat, evergreen
- Garden phlox (*Phlox paniculata*) (I) — fragrant summer panicles; mildew-aware
- Red valerian (*Centranthus ruber*) (I) — Jupiter's beard; lean-soil self-sower
- Brunnera (*Brunnera macrophylla*) (I) — **shade + moisture**; forget-me-not blue
- Scabiosa / pincushion flower (*Scabiosa columbaria*) (I) — very long bloom
- Garden lupine (*Lupinus polyphyllus*, Russell) (I) — showy but **toxic alkaloids + invasive elsewhere**; deadhead before seed set
- Candytuft (*Iberis sempervirens*) (I) — evergreen white-flowered spring mound
- Evening primrose (*Oenothera macrocarpa*) (I) — big lemon-yellow cups; sprawling xeric
- Spike speedwell (*Veronica spicata*, white 'Icicle' lead) (I) — upright white flower spikes
- Garden verbena (*Glandularia canadensis*) (I) — rose-purple trailing mat; butterfly magnet
- Coreopsis (*Coreopsis grandiflora* 'Early Sunrise') (I) — golden daisies, long bloom
- Blanket flower (*Gaillardia aristata*) (N) — red-and-gold native daisy
- Knautia (*Knautia macedonica*) (I) — wine-red pincushions on wiry stems
- Yellow yarrow (*Achillea* 'Moonshine') (I) — soft-gold flat heads over silver foliage
- Hardy cranesbill (*Geranium* 'Rozanne') (I) — violet-blue saucers, summer to frost
- Pasque flower (*Pulsatilla patens*) (N) — early-spring lavender cups + plumed seedheads; **toxic**
- Japanese anemone (*Anemone × hybrida*) (I) — fall pink/white flowers; **part shade + moisture**
- Grecian windflower (*Anemone blanda*) (I) — low spring-blooming blue tuber
- Western wallflower (*Erysimum capitatum*) (N) — fragrant orange-yellow native; reseeds
- Bloody cranesbill (*Geranium sanguineum*) (I) — magenta saucers + red fall foliage
- White heath aster (*Symphyotrichum ericoides*) (N) — fall clouds of tiny white daisies
- White prairie aster (*Symphyotrichum falcatum*) (N) — low xeric native fall aster
- Panicled aster (*Symphyotrichum lanceolatum*) (N) — tall willow-leaved fall aster; colonizes
- Mountain bluet (*Centaurea montana*) (I) — fringed blue cornflower; **self-sows — not the noxious knapweeds**

**Annuals**
- Snow-on-the-mountain (*Euphorbia marginata*) (N) — white-margined bracts / whole plant / field stand
- Cosmos (*Cosmos bipinnatus*) (I) — ray-flower closeup / airy foliage habit
- California poppy (*Eschscholzia californica*) (I) — flowers+foliage / whole plant
- Snapdragon (*Antirrhinum majus*) (I) — bicolor spike / clump of spikes
- Rocky Mountain bee plant (*Cleomella serrulata*, syn. *Cleome serrulata*) (N) — flower closeup / prairie stand / seed pods
- Larkspur (*Consolida ajacis*) (I) — cool-season spires; **all parts toxic**; direct-sow
- German chamomile (*Matricaria chamomilla*) (I) — apple-scented tea daisy; self-sows (NOT noxious scentless chamomile)

**Groundcovers**
- Snow-in-summer (*Cerastium tomentosum*) (I) — silver mat, white flowers; lean-soil to behave
- Hardy ice plant (*Delosperma cooperi*) (I) — Plant Select succulent mat, magenta bloom
- Kinnikinnick (*Arctostaphylos uva-ursi*) (N) — evergreen native mat; pink urns, red berries
- Turkish creeping speedwell (*Veronica liwanensis*) (I) — Plant Select flat blue-flowered mat

**Vines** *(cultivars — hand-sourced from Wikimedia Commons)*
- Garden clematis (*Clematis × jackmanii*, large-flowered hybrids) (I) — violet bloom closeup / sheets on a trellis
- Climbing rose (*Rosa*, climbing cultivars) (I) — blooms on a brick wall / wall-trained habit
- Rambling rose (*Rosa*, rambling cultivars) (I) — clustered blooms / rambler over a pergola arch (Paul's Himalayan Musk)
- Trumpet honeysuckle (*Lonicera sempervirens*) (I) — non-invasive native vine, hummingbird red
- 'Dropmore Scarlet' honeysuckle (*Lonicera × brownii*) (I) — hardy non-invasive climber

**Dropped from the keep-list (do not re-add):** coyote willow (*Salix exigua*) and
Turkish cliff sage (*Salvia recognita*). Mojave sage is preferred over Turkish cliff
sage.

## Open work

The current backlog. Move items out of this section as they ship.

- **Fuller seasonal reels:** the sparse natives (horned spurge) and a few single-season
  garden flowers could still grow extra-season shots as better candidates surface. The
  iNat API has far more CC photos per plant than were picked — re-query it (the fast
  path above) to find spring/fall/winter shots. (`/tmp/*` is ephemeral; nothing is
  cached between containers — re-query rather than expecting a saved shortlist.)
- **Trim the batch-1 fulls:** a few early full images (e.g. dogwood `wi-stems.jpg`,
  little-bluestem) were saved at q85/1500px (~0.8 MB); later batches use q82/1400px.
  Re-running those through `finalize.py` would shave repo weight if it matters.
- **Thumbnail weight:** the 720×480 card thumbs total ~6.3 MB (up from ~2 MB at 400px).
  Fine for now; if repo weight matters, `rethumb.py` can drop to 640px or lower JPEG
  quality — a small sharpness-for-size trade on high-DPI screens.

## Quick conventions recap

- Real CC-licensed photos only (repo-hosted; iNat open data or verified Commons titles),
  no illustrations, no copyrighted hotlinks. Record attribution.
- **Verify every sourced image is the right species** — after finalize+rethumb, `Read` a
  contact-sheet of the final thumbnails (close-up *and* habit) and re-pick anything wrong,
  look-alike, or ambiguous before committing (see "iNat API path" step 5).
- Weed-check every new plant against CO lists A/B/C + Watch before it goes in.
- `care` facts are sourced like photos: ground them in a trusted authority, list the real
  sources in `care_src`, then run the citation-honesty + fact-check passes (see "Sourcing
  care facts"). No uncited hard numbers; no dead/blog citations. **Run
  `python3 tools/check_citations.py` after any `care_src` change** — it catches dead links and
  URLs that resolve to the wrong plant, and fails if a plant has no reachable source.
- Show image + blurb for sign-off **before** creating the plant file.
- A new plant = one `plant.json` + one `manifest.json` line (not a big array edit).
- After any `finalize.py`/`commons_finalize.py`, run `rethumb.py` so the card thumbs are
  720×480 smart-crops, not the provisional 400px ones.
- Vanilla HTML/CSS/JS, no build, no deps — keep it that way unless the user asks otherwise.
- Preview locally over `http.server` (fetch won't work from `file://`).
