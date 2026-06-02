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

1. Edit the relevant file(s) — `index.html`, `styles.css`, `app.js`, or a
   `plants/.../plant.json`.
2. `git add -A && git commit && git push`.
3. GitHub Pages redeploys automatically; changes go live in a minute or two.

**Preview / self-check:** because the page `fetch()`es the plant data, `file://`
won't work — serve it over HTTP and validate from inside the container with `curl`
(the user can't reach the container's `localhost`):

```
python3 -m http.server 8000   # then curl http://localhost:8000/plants/manifest.json etc.
```

## Architecture

The site is a few plain files plus a tree of per-plant data:

```
index.html              # thin shell: markup only; links styles.css + app.js
styles.css              # all styling
app.js                  # all behaviour (render, reels, filters, modal, lightbox, loader)
.nojekyll               # serve everything verbatim on Pages
plants/
  manifest.json         # { "plants": ["trees/chokecherry", ...] } — the list to load
  <category>/<slug>/
    plant.json          # one plant's full record (card fields + photo "shots")
    images/             # repo-hosted photos: <shot>.jpg full + <shot>-t.jpg thumb + credits.json
```

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

### UI features

Cards grouped by plant type (collapsible) with an A–Z toggle, a search box, a
weed-gated "add plant" form, and a swipeable per-season photo strip. The card shows a
small thumbnail; clicking (or `Enter`/`Space` on it — the photos are keyboard-focusable)
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

### Known reel gotcha (already fixed — don't regress)

The per-season tab is derived from the reel's scroll position. `curIdx()` picks the panel
whose actual **`offsetLeft` is nearest `scrollLeft`** — *not* `Math.round(scrollLeft/clientWidth)`,
which mis-rounded with fractional panel widths and lit the wrong season (e.g. a 4-panel
plant's *fall* panel highlighting the *winter* tab). It still needs the recompute ~150ms
after scroll settles **plus** a `scrollend` listener so the tab doesn't deselect on the
last panel or mis-highlight mid-swipe.

### Tap-vs-swipe gotcha (already fixed — don't regress)

Tapping a card photo opens the lightbox, but the strip is also a horizontal swiper. The
open is gated on a **move-threshold**: `content` tracks `pointerdown`/`pointermove` and the
`click` handler bails if the pointer moved >10px (`tapMoved`). The reel uses
`touch-action:pan-x pan-y` — `pan-x` keeps the horizontal season-swipe crisp, and `pan-y`
is required so a finger that lands on a photo can still scroll the page vertically (plain
`pan-x` blocks vertical panning and traps page scroll). The move-threshold (not
`touch-action`) is what stops a season-swipe from flinging you into the lightbox.

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

**iNat API path (preferred — used for most plants):**

1. **Resolve the taxon.** `GET /v1/taxa?q=<botanical name>` and take the **active**
   taxon id — names drift (e.g. Rocky Mountain bee plant is now *Cleomella serrulata*,
   id `1415100`; the old *Peritoma serrulata* taxon `78444` is inactive and returns
   nothing). Colorado's `place_id` is **34**.
2. **Pull CC candidates.** `GET /v1/observations?taxon_id=<id>&place_id=34&photo_license=cc0,cc-by,cc-by-nc&quality_grade=research&order_by=votes&per_page=60`.
   Extract each photo's `square` url, swap `square→medium` for review thumbs, dedupe by
   photo id (and by observer for variety), prefer Front Range / Boulder-county localities.
3. **Montage + review.** Tile the medium thumbs into one labeled contact-sheet, **`Read`
   it**, and pick the best close-up + structure (per season), checking species/orientation.
4. **Finalize + thumbnails** (below) — hand-write `shortlist.json` + `picks.json` from
   the picks, then run `finalize.py` and `rethumb.py`.

The bee-plant add did exactly this end-to-end in a couple minutes (see git history).

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

## Weed-verification gotchas

- **Clematis:** garden/large-flowered hybrids (e.g. 'Jackmanii', *C. viticella*) are
  fine. But ***Clematis orientalis*** (Chinese / orange-peel clematis) is a **CO List B
  noxious weed**, and that covers **all** its subspecies and cultivars, including
  'Bill MacKenzie'. Avoid the yellow orange-peel types.
- **Lupine:** native silvery lupine (*Lupinus argenteus*) is the keeper. **Avoid**
  bigleaf/Russell hybrid lupine (*Lupinus polyphyllus*) — not CO-native and invasive
  in some regions. All lupines carry toxic alkaloids.
- All **euphorbias** have toxic/irritant milky sap (gloves; caution with kids/pets).

## Trusted resources

- **CO Dept. of Agriculture** noxious weed lists A/B/C + Watch List (weed check)
- **CSU Extension — Yard & Garden:**
  https://extension.colostate.edu/topic-areas/yard-garden/ (how plants perform on
  the Front Range)
- **MASA Seed Foundation** (Boulder) — trusted local native seed source;
  nursery@masaseedfoundation.org
- **BBB Seed** (Colorado) and **Great Basin Seeds** (Utah) — seed backups

## Current plant roster (in the live site)

**28 specimens**, all verified non-weed in CO. Grouped by type below (the order the
site uses). **All 28 now carry repo-hosted photo reels** (close-up + structure,
seasonal where good shots exist); each plant's exact shots live in its `plant.json`.
most were sourced from the iNaturalist open dataset; the **3 vine cultivars** (garden
clematis, climbing & rambling rose — no clean iNat taxon) and **wild bergamot's summer
shots** were hand-sourced from Wikimedia Commons (see `tools/commons_search.py` +
`commons_finalize.py`). Every shot keeps a remote `commons`/`url` fallback. Card
thumbnails are 720×480 smart-crops (`tools/rethumb.py`). (N) = CO/regional native,
(I) = introduced/vetted.

**Trees**
- Chokecherry (*Prunus virginiana*) (N) — reel: spring flowers / summer + fall fruit
- Mountain alder, ssp. *tenuifolia* (*Alnus incana*) (N) — reel: catkins / leaves+cones / fall

**Shrubs**
- Red-twig dogwood (*Cornus sericea*) (N) — reel: summer cymes / fall berries / winter red stems
- Wood's rose (*Rosa woodsii*) (N) — reel: summer flower / habit / fall hips / winter hip
- Common lilac (*Syringa vulgaris*) (I) — reel: blooming-shrub habit / panicle / foliage

**Subshrubs**
- Mojave sage (*Salvia pachyphylla*) (I) — reel: flower closeup / silvery mounded shrub
- Russian sage (*Salvia yangii*, syn. *Perovskia atriplicifolia*) (I) — reel: airy habit / flowers / fall spikes

**Ornamental grasses**
- Little bluestem (*Schizachyrium scoparium*) (N) — reel: summer clump / fall copper / winter seedheads

**Perennials**
- Cushion spurge (*Euphorbia polychroma*) (I) — reel: chartreuse bracts / plants in leaf
- Horned spurge (*Euphorbia brachycera*) (N) — reel: cyathia / glaucous habit
- Silvery lupine (*Lupinus argenteus*) (N) — reel: silvery foliage / flower spike / habit
- Garden peony (*Paeonia lactiflora*) (I) — reel: white blooms / post-bloom foliage
- Dahlia (*Dahlia × hortensis*) (I) — reel: double bloom / border habit; **tender, not winter-hardy**
- Oriental poppy (*Papaver orientale*) (I) — reel: bloom / blooms+buds habit
- Colorado blue columbine (*Aquilegia coerulea*) (N) — reel: face-on bloom / whole plant
- Shasta daisy (*Leucanthemum × superbum*) (I) — reel: flower closeup / flowering clump
- Aspen fleabane (*Erigeron speciosus*) (N) — reel: ray flower / clump in rock crevice
- Salvia / meadow sage (*Salvia nemorosa*) (I) — reel: flower spike / mounded clump
- Wild bergamot (*Monarda fistulosa*) (N) — reel: flowerhead / meadow stand / winter seedhead
- Scarlet bee balm (*Monarda didyma*) (I) — reel: scarlet flowerhead / flowers+foliage

**Annuals**
- Snow-on-the-mountain (*Euphorbia marginata*) (N) — reel: white-margined bracts / whole plant / field stand
- Cosmos (*Cosmos bipinnatus*) (I) — reel: ray-flower closeup / airy foliage habit
- California poppy (*Eschscholzia californica*) (I) — reel: flowers+foliage / whole plant
- Snapdragon (*Antirrhinum majus*) (I) — reel: bicolor spike / clump of spikes
- Rocky Mountain bee plant (*Cleomella serrulata*, syn. *Cleome serrulata*) (N) — reel: flower closeup / prairie stand / whole plant + seed pods

**Vines** *(cultivars — hand-sourced from Wikimedia Commons)*
- Garden clematis (*Clematis × jackmanii*, large-flowered hybrids) (I) — reel: violet bloom closeup / sheets on a trellis
- Climbing rose (*Rosa*, climbing cultivars) (I) — reel: blooms on a brick wall / wall-trained habit
- Rambling rose (*Rosa*, rambling cultivars) (I) — reel: clustered blooms / rambler over a pergola arch (Paul's Himalayan Musk)

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
- Weed-check every new plant against CO lists A/B/C + Watch before it goes in.
- Show image + blurb for sign-off **before** creating the plant file.
- A new plant = one `plant.json` + one `manifest.json` line (not a big array edit).
- After any `finalize.py`/`commons_finalize.py`, run `rethumb.py` so the card thumbs are
  720×480 smart-crops, not the provisional 400px ones.
- Vanilla HTML/CSS/JS, no build, no deps — keep it that way unless the user asks otherwise.
- Preview locally over `http.server` (fetch won't work from `file://`).
