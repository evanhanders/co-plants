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

**Fonts are self-hosted (`fonts/`), NOT loaded from Google Fonts — don't re-add the CDN `<link>`.**
The page used to pull Fraunces via a render-blocking `<link rel="stylesheet">` to
`fonts.googleapis.com`; **Brave (and other privacy browsers) block that CDN by default**, so the
render-blocking request stalled first paint by **~10+ seconds on Brave**. Fixed by self-hosting the
Fraunces `.woff2` subsets in `fonts/`, declaring them via `@font-face{…font-display:swap}` at the top
of `styles.css` (same-origin → not blocked; `swap` → paints immediately in the `Georgia,serif`
fallback, then swaps in). First paint dropped from ~13 s to ~0.2 s even with the Google CDN blocked.
The CSS keeps `'Fraunces',Georgia,serif` fallbacks throughout, so a missing font never breaks layout.

The **optional accounts layer** (sign in + favourite plants) is the one exception to "no
dependencies": it lazy-imports the Supabase JS client from a CDN **only when configured**, so
the core guide stays dependency-free and works untouched without it. See "Accounts & favourites
(Supabase)" below.

- **Live site:** https://evanhanders.github.io/co-plants/
- **Repo:** `evanhanders/co-plants` (public)
- **Entry point:** `index.html` at the repo root (GitHub Pages serves it directly)
- **Title:** "The Front Range Herbarium" (was previously "Plantarium" — don't revert)
- **`.nojekyll`** is present so Pages serves every file (incl. the `plants/` tree) verbatim.
- **`LICENSE`** — MIT for the code (site + `tools/`); the written care text is CC-BY-4.0; each
  **photo keeps its own** CC0/CC-BY/CC-BY-SA/CC-BY-NC license (recorded per shot + in
  `credits.json`). Because some photos are CC-BY-NC, the photo set as a whole is
  non-commercial; reuse each photo under its own terms, with attribution.

## How deploys work

Work happens in an ephemeral remote container: the repo is cloned fresh when the
container starts and reclaimed after inactivity, so **nothing survives unless it's
committed and pushed.** Deploys are just git:

1. Edit the relevant file(s) — `index.html`, `plant.html`, `styles.css`, `reel.js`,
   `app.js`, `plant.js`, or a `plants/.../plant.json`.
2. `git add -A && git commit && git push` (to the working feature branch).
3. **Merge to `main` to ship — this is the standard end-of-task step.** When a unit of
   work is complete, validated (`tools/check_refs.py` + `tools/check_citations.py` pass,
   and any visual change rendered in Chromium), and pushed, open a PR into `main` and
   **squash-merge** it. **GitHub Pages deploys from `main`**, so work isn't live until it's
   merged — **don't leave finished work parked on a feature branch.** Sync the branch to the
   merged `main` afterward (`git fetch origin main && git reset --hard origin/main`).
   - **"Unverified" merge commits are expected and fine — don't try to "fix" them.** Merging
     through the GitHub API means GitHub authors the squash/merge commit (committer
     `noreply@github.com`), so it shows as **Unverified** and the git stop-hook will flag the
     branch tip. That's cosmetic; **never rewrite/force-push `main` to re-sign it.**
4. GitHub Pages redeploys from `main` automatically; changes go live in a minute or two.

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

**Visual / CSS / UX changes — rendering in Chromium is a CRITICAL step, not optional.** For any
change to *how the page looks or behaves* (CSS, layout, an icon, a control, mobile sizing), reading
the stylesheet and reasoning about it is **not enough and has been wrong twice** — `curl` returns
markup, never computed style, so it can't see a cascade override, a UA form-control default, or an
overlap. **Before claiming a visual fix works, render it in Playwright + Chromium (the same one-time
install above), emulate the target device — `chromium.launch()` → `newContext({ ...devices['Pixel 5'] })`
for Android, since the guide is phone-first — type/interact as a user would, then (a) read back the
**computed style + geometry** with `getComputedStyle()`/`getBoundingClientRect()` to prove the rule
actually applied, and (b) `locator(sel).screenshot()` and `Read` the PNG to see it.** Example caught
this way: the search field's magnifier overlapped the text because a later equal-specificity
`input[type=search]{padding:9px 11px}` reset was silently overriding `.search input`'s `padding-left`
— invisible in the source, obvious the instant `getComputedStyle().paddingLeft` read `11px` instead
of `40px`. Reason from the *computed* value, fix, then re-render to confirm.

**Citation check (`tools/check_citations.py`).** Curls every plant's `references` (falls back to
legacy `care_src`) and flags DEAD / wrong-plant (REVIEW) / OK, failing if any plant has no
reachable source — run it after any `references` edit and as a periodic guard on the whole guide.
It's step 3 of the care pipeline (see "Sourcing care facts"); no dependencies, just Python:

```
python3 tools/check_citations.py            # audit all 68 plants
python3 tools/check_citations.py --strict   # also fail on zero content-verified sources
python3 tools/check_citations.py plants/perennials/knautia   # one or a few dirs
```

**Reference-integrity check (`tools/check_refs.py`).** The structural companion: scans each
plant's inline `[n]` markers (in `care`, `edible`, and the `fact_src` map) and verifies every one
resolves to an entry in that plant's `references` bibliography. **UNDEFINED** (a `[n]` past the end
of `references`) fails the run; **ORPHAN** (a never-cited reference), **UNCITED** (has care/edible
but no `references`), and **NO-FACTSRC** are warnings. Run it after any citation edit:

```
python3 tools/check_refs.py                       # all plants
python3 tools/check_refs.py plants/trees/chokecherry   # one or a few dirs
```

**Soil-pH setter (`tools/set_ph.py`).** Applies sourced soil-pH ranges to plant.json files from a
JSON map (`{ "<cat/slug>": {"min","ideal","max","src":[refs]} }`): it inserts the `ph` object before
`care` and writes `fact_src.ph`, re-dumping JSON byte-stably so diffs show only the added keys. Use it
to add/update a plant's `ph` field; `src` must reference numbers that already exist in that plant's
`references`, then run `check_refs.py`. See the `ph` schema field above.

```
python3 tools/set_ph.py ph_map.json               # apply pH to the listed plants
```

**Grid data bundle (`tools/build_bundle.py`).** Procedurally concatenates every per-plant `plant.json`
(the source of truth) named in `manifest.json`, plus `collections.json`, into a single
**`plants/bundle.json`** that the grid + Favourites page load in **one request** (instead of 250+
individual fetches — the fix for slow first paint as the roster grew). It strips the detail-page-only
fields the grid never reads (`care`, `references`, `fact_src`, `care_src`) so the bundle stays lean
(~1.2 MB / ~280 KB gzipped), and stamps each record's `dir`. **Run it after ANY `plant.json` /
`manifest.json` / `collections.json` edit and commit the refreshed `bundle.json` in the same commit**
(the pages fall back to per-file loading if it's absent, but a *stale* bundle shows stale data). No deps.

```
python3 tools/build_bundle.py            # (re)write plants/bundle.json
python3 tools/build_bundle.py --check    # guard: nonzero exit if bundle.json is stale vs the plant files
```

## Architecture

The site is a few plain files plus a tree of per-plant data:

```
index.html              # encyclopedia grid shell: markup only; links styles.css + reel.js + config.js + auth.js + nav.js + app.js
plant.html              # standalone per-plant detail page shell; links the same chain + plant.js
privacy.html            # standalone privacy page (what accounts collect + a "delete my data" button)
signin.html / signin.js # standalone Sign-in page (magic-link form via window.Account.signIn)
favorites.html / favorites.js # standalone Favourites page (renders the user's saved plants as cards)
styles.css              # all styling (grid + detail page + accounts) + the self-hosted Fraunces @font-face rules
fonts/                  # self-hosted Fraunces .woff2 subsets (latin + latin-ext, weights 400/600 + italic)
reel.js                 # SHARED engine: shot resolution, the seasonal reel, the zoom/swipe lightbox,
                        #   the TRAITS predicates/badges, AND the shared cardHTML renderer. Loaded first everywhere.
config.js               # the TWO Supabase values (URL + publishable key); holds the live values (placeholders = off)
auth.js                 # accounts + favourites: the ONLY file that talks to Supabase; exposes window.Account
nav.js                  # shared hamburger side-drawer (Home/Favourites/Privacy + account); gated on Account.configured
app.js                  # grid behaviour (render cards, filters, search, loader)
plant.js                # detail-page behaviour (fetch one plant, render the "sheet", set meta)
.nojekyll               # serve everything verbatim on Pages
plants/
  manifest.json         # { "plants": ["trees/chokecherry", ...] } — the list to load
  collections.json      # { "collections": { "<id>": {name, group, lead, blurb} } } — family-card metadata
  bundle.json           # GENERATED (tools/build_bundle.py) — all plant records in one file for a single-request grid load; NOT hand-edited
  <category>/<slug>/
    plant.json          # one plant's full record (card fields + photo "shots" + optional care) — the SOURCE OF TRUTH
    images/             # repo-hosted photos: <shot>.jpg full + <shot>-t.jpg thumb + credits.json
```

**Two pages, one shared engine.** `index.html`+`app.js` is the encyclopedia grid;
`plant.html`+`plant.js` is the standalone detail page. Both `<script src="reel.js">` **first**
— `reel.js` owns everything photo-related (the reel render `plateHTML`, `wireReels`, the
lightbox + `wireLightbox(root)` delegation) plus the `TRAITS` map, `flagsHTML`, and
`natBadge`, so the grid cards and the detail sheet never drift. `plant.html` lives at the
repo root like `index.html`, so all root-relative paths (`plants/…`, `styles.css`,
`reel.js`) resolve identically — no path-base juggling.

**Load flow (in `app.js`):** on startup `loadSeed()` fetches **`plants/bundle.json`** — a single
generated file holding every plant's record plus the `collections` map — and assigns the records to
the in-memory `SEED` array (each already carries its `dir = "plants/<category>/<slug>"` so local
images resolve), then `render()`. This is **one request instead of 250+** (the grid used to fetch
every `plant.json` individually and block first paint on `Promise.all` of all of them — which got
slow as the roster grew). If `bundle.json` is missing/unreadable, `loadSeed` **falls back** to the
old per-file path (`loadSeedFiles()`: manifest → one fetch per plant). `favorites.js` loads the same
way. **The per-plant `plant.json` files remain the source of truth**; `bundle.json` is *derived* from
them by `tools/build_bundle.py` (see below) and carries only the fields the grid reads — the heavy
detail-page-only fields (`care`, `references`, `fact_src`) are stripped, so the bundle stays small
(~280 KB gzipped). The **detail page** (`plant.js`) still fetches the individual `plant.json` for its
full record (care prose + bibliography), so it's unaffected by the stripping.
`SEED` order doesn't matter — the app sorts by botanical name and groups by
**morphology** via `groupOf(p)` (growth form; forbs split by `bloom_season`). The on-disk
`plants/<category>/` folder is just a storage path (and the `dir` for image resolution) — it
is **NOT** the grouping. A file can live in `plants/perennials/` yet be a `Groundcover` or
`Forb`; don't move files to re-group (it'd break `dir`/manifest), just set `type`.

**`plant.json` schema** (confirm exact shape in any file; `index.html` / a real
`plant.json` is the source of truth):

- The card fields: `common, botanical, type, lifecycle, native, blurb, size, sun, water,
  spread, seasons, wildlife, deer, toxic, winter, verified` (+ `bloom_season` for forbs;
  + `origin` and `habitat` on **non-native** plants).
- **`native`** is a **two-value** field, rendered verbatim as the corner badge: use exactly
  **`"CO native"`** (green badge, Front-Range native) or **`"Non-native"`** (gold badge,
  everything introduced — including US/regional natives that aren't local, like witch hazel or
  black-eyed Susan). Don't write `"Introduced"` or other variants — the term was normalized to
  `Non-native` so the badge and the Origin filter chip read the same. `isNative(p)` keys off the
  word `native` not preceded by `non-`, so both values classify correctly.
- **`origin` + `habitat`** *(non-native plants only)* — the plant's **provenance**: `origin`
  = a short phrase naming where it's **from** (its native region/countries, or for a
  cultivar/garden hybrid the wild ancestor species' range, stated honestly); `habitat` = a
  short phrase describing its **natural growing conditions in the wild** (terrain, soil,
  moisture, elevation, plant community). Both render as blue **Native to** / **Wild habitat**
  rows in the card facts list and the detail page's "At a glance" table — gated on
  `!isNative(p)`, so native plants never show them. Keep each a **card-fact phrase** (~3–12
  words), not a sentence. Like the other shared card fields, they're rendered **raw** by the
  grid, so **bake NO inline `[n]` markers into them** — the detail-page citation goes in
  `fact_src` (`origin`/`habitat` keys). Source the native-range claim like any fact (prefer an
  authority already in `references` — MBG/RHS/USDA all state native range).
- **`type` is MORPHOLOGY (growth form), not lifecycle:** one of `Tree, Shrub, Subshrub,
  Grass, Vine, Groundcover, Forb`. This is what the grid groups by (`groupOf(p)` in `app.js`).
- **`lifecycle`** is a **tag, not a grouping category**: `Perennial | Annual | Biennial |
  Tender perennial`. It renders as a flag on the card/sheet (`flagsHTML`) and is its own
  filter axis (the "Lifecycle" chips). Set it on every plant (woody things are `Perennial`).
- **`bloom_season`** (`Spring | Summer | Fall`) is **required on `Forb`s** and drives their
  grouping — forbs are split into "Spring/Summer/Fall forbs" sections (most things are forbs,
  so one flat "forbs" list would be huge; bloom season breaks it up and is garden-useful).
  Pick the plant's *primary/peak* bloom. Non-forbs omit it.
- **`flower_color`** *(array, all plants)* — the plant's genuine **bloom colour(s)** from a fixed
  palette: `white, yellow, orange, red, pink, purple, blue, green`. **Multiple** are expected for
  bicolors, mixes, and cultivar ranges (garden tulip → `["white","yellow","orange","red","pink","purple"]`).
  Map shades to the palette (lavender/violet→`purple`, magenta/rose→`pink`/`red`, gold/cream→`yellow`,
  greenish/insignificant→`green`). Grown-for-foliage plants (ornamental grasses) use `[]`. Drives the
  **Flower colour** filter group; not shown on the card.
- **`bloom`** *(array, all flowering plants)* — the **season(s) it blooms** on the Front Range from
  `spring, summer, fall, winter` (multiple for long bloomers; winter/early bloomers include `winter`).
  This is the **filter** field and spans *all* growth forms — distinct from `bloom_season` (a single
  primary value that only `Forb`s carry, used for grid grouping). Foliage/grasses with no bloom use `[]`.
  Drives the **Bloom** filter group.
- **`ph`** *(object, all plants)* — the plant's **preferred soil-acidity range**:
  `{ "min": <num>, "ideal": <num>, "max": <num> }` on the standard pH scale (garden range ~4.0–9.0;
  acid-lovers like witch hazel / winter heath ~4.5–6.0, most Front-Range plants ~6.0–7.5, xeric
  alkaline-clay natives up to ~8.0–8.5). `min`/`max` are the tolerated range; `ideal` (optional but
  set on essentially every plant) is the sweet-spot marker. `phBarHTML(p)` in `reel.js` renders it as
  a horizontal acidic→alkaline gradient bar — the tolerated band bracketed, a rust diamond at the
  ideal — shown both as a **Soil pH** row in the grid card's facts list **and** in the detail page's
  "At a glance" table. Like every fact, the pH claim is **sourced + cited via `fact_src.ph`** (NOT a
  marker baked into the field — the grid renders it raw). Source it like any care fact: prefer the pH
  already stated in the plant's cited `care.soil`/`care.hardiness` text (cite the same `[n]`), else
  assign the species' established range and cite an existing authority in `references`. **Apply with
  `tools/set_ph.py`** (see below), then run `check_refs.py`.
- **`collection`** *(optional string id)* — folds this plant into a **family card** with its
  cultivar/genus siblings (e.g. `"collection":"apples"`). The id must exist in
  `plants/collections.json`. Membership is the *only* thing that lives on the plant; the family's
  display name, home section, lead photo and blurb live in `collections.json`. See "Collections
  (family cards)" below. Omit it for standalone plants.
- **`aka`** *(optional string array)* — **alternate names that route to this entry in search**: alt
  common names, synonyms, or named **cultivars** the user owns whose care is identical to this species
  (e.g. Lavender carries `["'Munstead' lavender"]`; Blue flax carries `["Prairie flax","Lewis flax"]`).
  It's the lightweight alternative to a near-duplicate page: each string is folded into the grid's
  search string (`matchesQuery` in `app.js`), so searching the cultivar/synonym surfaces the parent
  card, and it renders as a subtle **"Also: …"** line under the botanical name on both the card
  (`cardHTML` in `reel.js`) and the detail page (`plant.js`), styled by `.aka` in `styles.css`. Use it
  when a requested cultivar is genuinely covered by an existing species entry rather than spinning up a
  duplicate; omit it otherwise.
- `commons:'File.jpg'` — legacy primary photo (a Commons filename). May be `""`. Once a
  plant has repo-hosted `shots`, this is just dead fallback metadata; new plants don't
  need it.
- `care:{…}` *(optional)* — the **grow-and-care detail** for the per-plant detail page
  (see "Detail page" below). A flat object of prose strings keyed by aspect; the detail
  renderer reads a fixed, ordered allow-list of keys (`CARE_FIELDS` in `plant.js`) and skips
  any that are absent, so a plant can fill in as many or as few as apply. Current keys:
  `hardiness, planting, sun, soil, water, spacing, propagation, sow, stratify, depth, bloom,
  feeding, pruning, maintenance, selfsow, troubles, harvest, companions`. Three of these carry
  specific intent: **`planting`** = *when to plant outside on the Front Range, covering both in
  the ground and in pots/containers* (containers dry faster and their roots are far less
  cold-hardy, so they need their own timing/overwintering note); **`propagation`** = *how to
  propagate by seed **and** by non-seed means* (division, cuttings, layering…); **`pruning`** =
  *when to prune on the Front Range, the technique/what to cut, and what can go wrong* (bloom
  buds removed by mistimed cuts, sap bleeding, disease-entry timing, fire-blight tool
  sanitation, over-shearing, cutting an evergreen/lavender into bare old wood that won't
  resprout). **Every woody plant carries `pruning`** — every `Tree`, `Shrub`, `Subshrub`, and
  the woody/perennial `Vine`s (roses, clematis, honeysuckles, grape, woodbine); herbaceous
  forbs/grasses/annual vines don't. Keep pruning guidance in this field, not buried in
  `maintenance` (which is for the other upkeep — deadheading, mulch, staking, winter cover). Keep each
  value a short paragraph of Front-Range-specific, practical guidance. Add a new aspect by
  extending `CARE_FIELDS` (key + display label) — no other code change needed. **Every care
  value carries inline `[n]` citation markers** (e.g. `…pH 5.0–8.0.[1][2]`) keyed to the
  plant's `references` bibliography; `cite()` in `plant.js` turns them into superscript links.
- `references:[…]` *(required whenever `care`/`edible` is present)* — the **page bibliography**:
  an **ordered** list of `{ name, url }` sources, numbered `[1], [2], …` in array order. This is
  the single source-of-record every inline `[n]` marker (in `care`, `edible`, and `fact_src`)
  resolves to; `plant.js` renders it as a numbered **References** section at the foot of the
  detail page (`bibHTML`). It **replaces the old flat `care_src`** (legacy plants still fall back
  to the "Care notes compiled from …" line until migrated). Cite the actual authorities you drew
  from — don't pad it. See "Sourcing care facts" for the trusted-source priority + uncited-claim
  rule, and run **`tools/check_refs.py`** (marker↔bibliography integrity) + **`check_citations.py`**
  (URL reachability) after editing.
- `fact_src:{…}` *(optional but expected with `references`)* — **detail-page-only** citations for
  the "At a glance" facts table: a map of card-field → array of reference numbers, e.g.
  `{"size":[1,2],"toxic":[1,3]}`. Keys: `size, sun, water, spread, seasons, wildlife, deer, toxic, ph`
  (+ `origin, habitat` on non-native plants).
  `factsDL` in `plant.js` appends the superscript cites. **Do NOT bake `[n]` into the shared card
  fields themselves** (`size`, `sun`, …) — `app.js`'s grid renders those raw, so markers would leak
  onto the encyclopedia cards; the citations live only in `fact_src`, which the grid ignores.
- `edible:{…}` *(optional)* — the **"Edible parts" section** on the detail page (safety-critical;
  `edibleHTML` + `EDIBLE_FIELDS` in `plant.js`). Fields: **`level`** (`edible | caution | toxic |
  inedible` — drives the banner colour/label), **`summary`** (one-line banner verdict), and the
  prose cells **`parts`**, **`preparation`**, **`caution`** (the cautions cell renders full-width +
  tinted). For **`toxic`/`inedible`** plants the renderer shows **only the banner + `caution`** (the
  "no part is edible / no prep makes it safe" cells are noise next to a DO-NOT-EAT banner), so those
  two levels need just `summary` + `caution`. Add **`food: true`** when the plant has a part people
  actually eat — set it on the `edible` plants and the genuinely-edible `caution` ones (chokecherry,
  Oregon grape, Wood's rose, kinnikinnick, blue flax, columbine, dahlia, yarrow), but NOT the
  "don't eat" cautions.
  When `food:true`, also add **`kinds`** — a JSON array naming which **parts** are eaten, from a fixed
  set: `fruit, flowers, leaves, stems, seeds, roots` (multiple where several parts are eaten; rose =
  `["fruit","flowers"]` = hips + petals; dahlia = `["roots","flowers"]` = tubers + petals; bulbs →
  `roots`). This is the data behind the **Edibility** filter group + the granular card/sheet badges
  (`fruit`/`eflower`/`eleaf`/`estem`/`eseed`/`eroot` predicates in `reel.js`'s `TRAITS`); the two
  toxicity facets are derived from `level` (`caution` → **Toxic parts**, `toxic` → **Fully toxic**),
  so no extra field. Also add **`card`** — a *short, citation-free* phrase naming the edible part(s)
  (e.g. `"Ripe fruit, cooked (jelly, syrup)"`); the encyclopedia grid renders it as a green **Edible**
  row in the card's facts list (the grid is uncited, so keep `card` free of `[n]` markers — the cited
  detail goes in `summary`/`parts`). All prose carries inline `[n]` markers into `references`. Source
  it like care, but with extra rigor — see "Sourcing edibility facts".
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
**"Growing & care on the Front Range"** grid built from the plant's `care` object, a
warning-styled **"Edible parts"** section from the `edible` object, a **"Photographs"** credits
list (photographer · license · source per shot), and a numbered **"References"** bibliography
(the `references` array) that every inline `[n]` cite on the page links into. All claims on the
detail page — the facts table (via `fact_src`), the care prose, and the edibility prose — carry
inline `[n]` superscript citations; the encyclopedia grid (`index.html`) stays uncited.
`setMeta(p)` updates `document.title` + the `og:`/`description` tags to name the plant.
The page has a slim masthead (the wordmark links home) and a "‹ Back to the herbarium"
link (`href="index.html"`) top and bottom. To extend a plant's detail page, add/extend its
`care` object — no per-plant code. (The grid's own filters live in the URL hash on
`index.html`; navigating to a detail page is a normal link, and Back returns to the grid.)

### UI features

Cards are **sorted by botanical (scientific) name** within each group (`allPlants()`), and
**both** the common and botanical names are searchable (the search string includes both).
Each section header carries a one-line plain-language gloss of that growth form (the
`GROUP_DESC` map in `app.js`, rendered as `.group-desc`; it hides when the group is collapsed).
Cards are grouped by morphology (collapsible) by default, with a **Sort dropdown** (`#sortby`
in the toolbar), a search box, and a per-season photo strip you flip with the season dots
(the strip is deliberately *not* finger-swipeable — see the tap-vs-swipe note). The card
shows a small thumbnail; clicking (or `Enter`/`Space` on it — the photos are keyboard-focusable)
opens the full-size image in a pinch/scroll zoom lightbox. The lightbox is a **swipeable
gallery**: it loads the whole reel, so swipe left/right, arrow keys, or the on-screen
`‹ ›` buttons step through that plant's full-size photos (with an "n / m" counter; nav
hides for single-photo plants and at the ends).
**Photos must be real CC-licensed photographs — no illustrations.** (See "Image
requirements & sourcing" below for the per-plant photo spec.)

**Sort / grouping (`#sortby`).** The toolbar's **Sort** dropdown chooses how the grid is laid
out. Two bespoke modes: **Type** (the default — morphology sections with `GROUP_DESC` glosses,
collection family cards, and collapse) and **A–Z** (one flat botanical-sorted list, no sections).
Every *other* option groups the flat cards into collapsible sections **by a filter dimension** —
**Flower colour, Bloom season, Lifecycle, Sun, Water, Soil pH, Origin, Traits, Edibility** — routed through
`genericGroupedHTML(list, key, q)`, which buckets cards using **that same `GROUPS` entry's
`opts[].test` predicates**, so sort and filter can't drift. Multi-valued dimensions (colour, bloom,
traits, edibility) place a plant in **every** matching section; whatever matches no option falls
into a trailing catch-all bucket (`OTHER_LABEL`). Section markup + collapse wiring are shared with
the Type view via `sectionHTML()` + `wireGroupHeads()`. The non-Type/A–Z modes deliberately **skip
family cards** (they'd fight a non-morphology grouping). The selection round-trips through the URL
hash as `view=<key>` (legacy `type`/`alpha` values still parse). To add a sort dimension, just add
an `<option>` to `#sortby` whose value is a `GROUPS` key (and an `OTHER_LABEL`/`SORT_LABEL` entry).

**Filtering & state.** Filters are a **data-driven set of groups** — the `GROUPS` array in
`app.js`. Each group is `{ key, label, mode, opts:[{v,label,test(p)}] }`; current groups are
**Form** (morphology), **Flower colour** (from `flower_color`), **Bloom** (from `bloom`),
**Lifecycle** (`lifecycle` tag), **Sun** (derived from the `sun` field by `sunOf()`), **Water**
(derived from the `water` directive by `waterOf()`), **Soil pH** (Acidic/Neutral/Alkaline, derived
from `ph.ideal` by `phClassOf()` — Acidic <6.5, Neutral 6.5–7.5, Alkaline ≥7.5, one bucket per plant
matching where the bar's diamond sits), **Origin** (`isNative`), **Traits** (Winter/
Pollinator/Spreads) and **Edibility** — plus the free-text search. **`mode:'or'`** = a plant matches
*any* selected chip in the group; **`mode:'and'`** = it must match *all* (only Traits is `and`, so
Winter AND Pollinator composes; Edibility is `or`). Two UX behaviours fall out of one renderer
(`renderFilters()`), recomputed on every `render()`:
- **Selected chips jump to the front of their group** (active-first sort), the rest keep natural order.
- **Faceted counts:** each chip shows how many plants remain given the **other** groups' active
  filters **and** the search (its own group is excluded from its base via `passesFilters(p, exceptKey)`).
  A chip whose count drops to 0 (and isn't active) is dimmed + disabled (`.chip.off`).

**Edibility** is its own granular group: **Fruit · Edible flowers · Edible leaves · Edible stems ·
Edible seeds · Edible roots** (from each plant's `edible.kinds`) plus **Toxic parts** (`level ===
'caution'`) and **Fully toxic** (`level === 'toxic'`). The same predicates drive the granular **card
+ sheet badges** (`flagsHTML` in `reel.js` iterates `FLAG_ORDER`): green ❧ part badges, an amber
⚠ Toxic-parts badge, and a red ☠ Fully-toxic badge — so e.g. chokecherry reads `❧ Fruit` + `⚠ Toxic
parts`. (The coarse old `Edible`/`Toxic` traits were replaced by these.)

**Collapsible on mobile.** A `#filterToggle` button (hidden on desktop, shown ≤560px) collapses the
whole `#filters` bar; tapping toggles `.filters.open` + its `aria-expanded`, and its count chip
(`#ftCount`) shows the number of active filter selections so applied filters are visible while collapsed.

Add a filter dimension by adding one entry to `GROUPS` (and, if it reads new data, populating that
field on the plants); the delegated click handler, faceted counts, selected-first ordering, URL-hash
round-trip and Clear-all all work off the group automatically. The legend always reads "Showing N of M
plants" and shows a **Clear all** button when anything is active. Each group's selection is mirrored
into the **URL hash** under its `key`
(`#view=…&type=…&color=…&bloom=…&life=…&sun=…&water=…&ph=…&nat=…&trait=…&edible=…&q=…`) via
`syncHash()`/`applyHash()`, so filtered views are shareable and survive a reload.

### Adding a trait

A "trait" is a single boolean fact about a plant (Winter / Pollinator / Spreads, plus the granular
Edibility facets) that shows as a **card+sheet badge** *and* a **filter chip with a count** — both
driven off one predicate so they can't drift. To add one (e.g. `Fragrant`):

1. **Add one entry to the `TRAITS` map in `reel.js`** — `key:{ label, icon, test:function(p){…} }`.
   The `test(p)` predicate is the whole definition of who qualifies; base it on existing data
   (regex a field, e.g. `/fragran|scent/i.test(p.blurb||'')`) or on an explicit per-plant marker
   (like the edibility facets' `edible.kinds`/`edible.level`). Prefer an explicit marker when "who
   qualifies" is a judgment call rather than something cleanly derivable from a field.
2. **Wire the badge in `reel.js`** — add the key to **`FLAG_ORDER`** (render order) and **`FLAG_CLASS`**
   (its `.flag.CLASS`); `flagsHTML` iterates those and emits `<span class="flag CLASS">ICON Label</span>`
   from the map's `icon`/`label`. No per-trait `if` to add.
3. **Add a `.flag.CLASS` colour rule in `styles.css`** next to the other `.flag.*` rules.
4. **Add the key to the right group in `GROUPS` (`app.js`)** — `trait` (Winter/Pollinator/Spreads,
   `mode:'and'`) or `edible` (the Edibility facets, `mode:'or'`); each group lists its keys explicitly
   and maps them to `TRAITS`. `passesFilters()` tests `TRAITS[t].test(p)`, and the per-group URL-hash
   round-trip + faceted counts + Clear-all then cover it automatically.
5. **If the predicate reads a new data field, populate it** on the qualifying `plant.json`s (and
   document the field in the "`plant.json` schema" list). Then sanity-check the count.

### Collections (family cards)

Cultivar/genus clusters (apples, plums, tart cherries, currants, pelargoniums, wallflowers,
asters, irises, tulips, climbing/rambling roses, hardy geraniums, crocuses, penstemons, maples,
milkweeds, alliums, sunflowers, bee-balms, lupines, dogwoods, clematis, mulleins, columbines,
scabious, prairie-coneflowers, pinks, coreopsis, sumacs, primulas, ornamental-oreganos, marigolds,
bugleweeds, pasqueflowers, coral-bells, elderberries — **35 in all**) collapse
into a **single expandable family card** so the grid isn't buried under near-duplicate cards. It's
an **inline accordion**, not a separate page — each member keeps its own detail page untouched.
The bar for a collection is "would a gardener read these as one kind of plant in different
varieties." Genus clusters intentionally **left ungrouped** because they fail that bar (same genus
but too unlike in form/role to read as one family — don't re-group them): *Salvia* (culinary
rosemary + the diverse ornamental sages), *Lonicera* honeysuckles (a fruit bush + a native shrub +
ornamental vines, spanning shrubs and vines), *Veronica* speedwells (upright spike vs flat creeping
mat), *Amaranthus* (draping love-lies-bleeding vs upright grain amaranth — too unlike in form),
*Euphorbia* spurges (cushion subshrub + native forb + variegated annual), *Bouteloua* grama
grasses (only 2 of a small section), *Centaurea* (annual cornflower vs perennial bluet) and
*Anemone* (spring windflower vs fall Japanese anemone) — unlike + different bloom seasons; and
*Rubus* (ornamental Boulder raspberry vs the fruit raspberry — different intent).

**Data model (two parts):**
- **Membership** is one field on the member's `plant.json`: `"collection":"<id>"`. That's all a
  plant declares.
- **Display metadata** lives in **`plants/collections.json`** — `{ "collections": { "<id>":
  {name, group, lead, blurb} } }`. `name` = the family card title; `group` = which morphology
  **section** the one family card sits in (a `GROUP_ORDER` value); `lead` = the **slug tail** of the
  member whose photo reel is the cover; `blurb` = the sub-line. `app.js` fetches it in `loadSeed()`
  into `COLLECTIONS`.

**How it renders (type view only — A–Z stays a flat list of every plant).** In `render()` the
filtered `list` is folded into **items** bucketed by section: standalone plants are normal cards;
a collection with **≥2 visible members** becomes one `familyCardHTML` item placed in its home
`group`; a collection with **exactly 1 visible member** falls back to a plain card in that member's
own section (so a lone match — or a filter that narrows a family to one — never hides behind a
pointless wrapper). Collapsed, the family is a normal grid cell whose cover reuses the lead's
`plateHTML` reel. **Open**, it stays in its cell and reveals a **looping carousel** of the member
cards (verbatim `cardHTML`): a `.fc-track` of `[clone(last), …members…, clone(first)]` translated
one card per view, with ‹ › arrows, a dot per member, and an `n / m` counter. The carousel is
**built lazily** on first expand (`buildCarousel` → `carouselHTML` + `wireReels` + `wireCarousel`),
so nothing renders until asked; it opens on the **lead** member for continuity with the cover, and
loops seamlessly (on `transitionend` past a clone it jumps to the matching real slide with the
transition off). The expander toggles `.open` **in place** (no full re-render → keeps scroll);
`famOpen` remembers which are open. A search or any active filter **force-opens** every family
(carousels built at render); the section header tally and the "Showing N of M plants" legend count
**plants**, not cards.

**Two horizontal swipes, routed by where you grab.** Inside an open carousel both gestures work and
never fight, because `wireCarousel` decides at `pointerdown`: a swipe that **starts on the photo**
(`.reel`) is left to the reel's own season-swipe (change the season), while a swipe that **starts
anywhere else** on the card (facts body, flags, gaps) drives the **carousel** (change the variety).
A vertical drag does neither — the page scrolls (`.fc-viewport` carries `touch-action:pan-y`, like
the reels). The carousel swallows the click that follows a real drag so a link/photo under the
finger doesn't fire. `reel.js` is untouched by this. **Test swipe routing with real touch (CDP), not
mouse drags — the reel swipe only responds to touch input** (mouse drags silently no-op, which once
looked like a routing bug but wasn't).

**Mixed-morphology collections** (penstemons span Subshrub + Forb; pelargoniums, wallflowers also
mix) keep each member's honest `type` — the family is simply *placed* in its declared home `group`.
Known minor wart: with a **Form** filter active, a family whose matching member's form differs from
its home `group` still shows in its home section (e.g. filtering `Subshrubs` can surface the
`Summer forbs`-homed Penstemons card). Acceptable and rare; don't try to duplicate the card across
sections to "fix" it.

**To add/extend a collection:** add (or reuse) an id in `collections.json`, then set
`"collection":"<id>"` on each member `plant.json`. Two members minimum to get a family card. No
`app.js` change needed.

**Section collapse + scroll (`wireGroupHeads`).** Group headers are `position:sticky;top:0`, so
they collapse in place (no re-render → scroll/sibling state kept). When you collapse a section
you've **scrolled past** (its sticky header is stuck at the top), the vanished cards would otherwise
drop you at an arbitrary spot, so the handler snaps that header to the viewport top
(`window.scrollTo(0, sectionDocTop)` when `sectionTop < pageYOffset`) — the next section then sits
right below it. Collapsing a header that's still in view doesn't scroll.

**Accessibility.** Photos are `role="button" tabindex="0"` with descriptive per-shot `alt`;
group-collapse chevrons are real `<button>`s with `aria-expanded`; the lightbox is a
`role="dialog" aria-modal` with focus move-in, a Tab focus-trap, focus-return to
the trigger, and `Escape` to close (it also locks body scroll). There's a global
`:focus-visible` ring (rust) and a `prefers-reduced-motion` block. The search input is 16px so
iOS doesn't force-zoom on focus. A CSS-only skeleton (`.skel`) shows while `plant.json`s fetch.

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

## Accounts & favourites (Supabase)

Visitors can **create an account and favourite plants**; favourites sync to any device they sign
in on. It's the one feature that reaches beyond static files — but it's built to **degrade to
nothing** when unconfigured, so the guide is byte-for-byte unchanged until it's switched on.

Navigation lives in a **floating menu button** (bottom-right) that opens a **side-drawer** (from
the right); **Sign in** and **Favourites** are **their own pages** (not a modal / not a grid
toggle). The per-plant ♥ on cards + detail sheets is how you save; the Favourites page just lists
what you saved. (The button is a bottom-right FAB rather than a top corner so it never overlaps the
back-links / kicker / sticky section headers.)

**The pieces:**
- **`config.js`** — just two globals, `window.SUPABASE_URL` + `window.SUPABASE_ANON_KEY`. **Both
  are safe to commit** (the publishable/anon key is *public*; security comes from the database's
  Row-Level Security rules, not from hiding it — **never** put the `service_role`/`sb_secret_…`
  key here). Currently holds the live project's values; with `YOUR_...` placeholders the whole
  feature stays off. (New Supabase projects issue `sb_publishable_…` keys — the successor to the
  old `anon` `eyJ…` JWT; either works in the `SUPABASE_ANON_KEY` slot.)
- **`auth.js`** — the **only** file that talks to Supabase. Loaded after `config.js` + `reel.js`,
  before `nav.js`/`app.js`/`plant.js`. Exposes a small, backend-agnostic **`window.Account`** API
  and keeps Supabase out of the page code (so the backend can be swapped/extended without touching
  the pages). Sign-in is **passwordless magic-link email** (`signInWithOtp`). It **lazy-imports**
  the Supabase client (`import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')`)
  **only when configured** — unconfigured, it installs a no-op `Account` stub, renders no UI, and
  never even fetches the library.
- **`nav.js`** — the shared nav **drawer**, loaded on every page after `auth.js`. **Gated on
  `Account.configured`** (nothing injected at all when accounts are off). Builds a floating
  bottom-right menu button + an off-canvas `<nav>` (slides in from the right) with links **Home ·
  Favourites · Privacy** and a `<div id="account">` that `auth.js` renders into. Esc / backdrop /
  link-tap close it; basic Tab focus-trap.
- **`signin.html` + `signin.js`** — the standalone **Sign-in page** (replaces the old modal):
  magic-link form → `Account.signIn(email)`; shows a "signed in as …" panel with Sign out when
  already signed in.
- **`favorites.html` + `favorites.js`** — the standalone **Favourites page**: loads the plant data
  and renders the user's saved plants with the **same shared `cardHTML`/reel** as the grid (both
  live in `reel.js`). Signed out → a sign-in prompt; unfavouriting (tap a ♥) drops the card live.
- **`privacy.html`** — plain-language privacy page (collects only email + favourites), linked from
  footers; self-serve **"delete my favourites & sign out"** button → `Account.deleteAllData()`.
- **Supabase** — a free hosted Postgres + Auth project. One table, `favorites (user_id, plant_slug,
  created_at)`, with RLS so each user reads/writes only their own rows. **Full setup (SQL +
  click-by-click) lives in `SETUP_ACCOUNTS.md`.**

**`window.Account` API** (what the pages call — never Supabase directly): `configured`, `ready()`
(resolves once the session + favourites have loaded — **await it before first paint**),
`isSignedIn()`, `user()`, `isFavorite(slug)`, `count()`, `toggleFavorite(slug)` (routes to the
sign-in page if signed out; optimistic, rolls back on error), `signIn(email)`, `signOut()`,
`openLogin()` (just navigates to `signin.html`), `onChange(cb)→unsub` (fires on any auth/favourite
change), `favButtonHTML(slug, labeled?)`, `syncButtons()`, `deleteAllData()`. A **`slug`** is the
plant's `dir` minus the `plants/` prefix (e.g. `trees/chokecherry`).

**Shared card renderer.** `cardHTML` + `slugOf`/`slugTail`/`detailHref`/`favBtnFor` live in
**`reel.js`** (moved out of `app.js`) so the grid, the family carousels, and the favourites page
render identical cards. The ♥ comes from `favBtnFor(p)` → `Account.favButtonHTML` (''. when accounts
are off). A single **delegated** `.fav-btn` click handler in `auth.js` covers every heart anywhere;
on toggle, `Account.syncButtons()` updates all hearts in place (so the grid needs no re-render).

**Boot ordering gotcha.** `app.js` (and `favorites.js`) `await Account.ready()` before first
paint — both for correct initial heart state **and** so `app.js` doesn't write its filter-state URL
hash until Supabase (`detectSessionInUrl`) has consumed any magic-link tokens from the URL. The
magic-link `emailRedirectTo` is `index.html`; the session is shared across all pages on the origin.

**Gotchas / conventions:**
- **Don't import Supabase or read `config.js` from the pages** — go through `window.Account`.
- All account UI stays **gated on `Account.configured`** so the un-set-up site is unchanged.
- The magic-link redirect (`emailRedirectTo`) must be in Supabase's **allowed Redirect URLs**, and
  users should open the link in the **same browser** they requested it from.
- **Test:** `tests/accounts.spec.mjs` (Playwright + Chromium) **stubs Supabase** by intercepting
  `config.js` + the CDN module with an in-memory fake, so it runs **fully offline** and exercises
  the real paths (unconfigured-hidden, the drawer, the sign-in page, the favourites page, heart
  toggling, sign out). Note it routes `config.js` to placeholders for the unconfigured case (since
  the shipped `config.js` now holds live values). The drawer slides off-screen via `transform`, so
  assert open/closed via the `nav-open` body class / `aria-hidden`, not `isHidden()`. Run after any
  `auth.js`/`nav.js`/account-wiring change:
  ```
  python3 -m http.server 8077 &
  node tests/accounts.spec.mjs
  ```

## The plant card fields

Every plant records:

- **Growth form** (`type`: tree / shrub / subshrub / grass / vine / groundcover / forb) and,
  for forbs, **primary bloom season** (`bloom_season`) — these set the grid grouping.
- **Lifecycle** tag (`lifecycle`: perennial / annual / biennial / tender perennial)
- **Mature size** (Height × Width)
- **Sun** requirement
- **Water** requirement — on the card the `water` field is a short **practical directive**, not
  a bare class (e.g. *"Low; xeric once established"*, *"Moderate; deep weekly soak in summer"*; for
  thirsty/riparian plants say it plainly — *"High — moist/wet soil, not for dry zones"*). The
  detailed version goes in `care.water`. In our semi-arid climate **water demand is a first-class
  "is it happy here?" check** — audit it and flag the genuine water-hogs (riparian alder, dogwood,
  twinberry, black currant…) so they don't land in a dry zone.
- **Spread / habit** (clumping vs. running/self-sowing)
- **Seasonal appearance** — including **winter** (this guide cares about winter
  interest specifically)
- **Wildlife / pollinator** value
- **Deer** note (resistant or not)
- **Toxicity** note (to people/pets/livestock)
- **Provenance** *(non-native plants only)* — where it's **from** (`origin`) and its **natural
  growing conditions in the wild** (`habitat`); shown as blue "Native to" / "Wild habitat"
  card rows
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
4. **Build a picks-only preview as your own QC gate.** Download just the *chosen* photos (by iNat
   photo id; probe S3 for the ext), tile them captioned, and **`Read` it yourself** — this is where
   bad picks get caught (see Pick QC below). It's far clearer than the full montage. (User sign-off
   is **not** required before creating the file; just make sure the picks are right.)
5. **Create** `plants/<category>/<slug>/plant.json` (with a `shots`
   array if you have multiple seasonal photos), add its `"<category>/<slug>"` path to
   `plants/manifest.json`, then commit and push. The `<category>` folder is just a storage
   path (`trees, shrubs, subshrubs, grasses, groundcovers, vines, perennials, annuals` all
   exist) — it does **not** set the grouping; the `type` (morphology) + `bloom_season` do.
   Pick whatever folder is closest; don't sweat it. Slug is the common name lowercased and
   hyphenated. Set `type` (growth form), `lifecycle`, and `bloom_season` (forbs). No giant array to edit anymore — one new
   file plus one manifest line.

## Image requirements & sourcing

**Images are repo-hosted, not hotlinked.** The guide must not depend on a remote host
staying up, so every shot's photo lives in the plant's `images/` folder. Remote
`url`/`commons` stays only as a thin fallback.

**Per-plant photo goal — the reel should let a viewer *understand the plant*. AIM FOR 6–9
SHOTS** (more is good; the navigator scales). Cover these **shot types**, using the close-up
*and* far/in-context shots together, because a single flower close-up + one habit shot isn't
enough to know a plant. Hit every type for which an open-licensed shot exists — a clean
**foliage** close-up, **flower** face-on, **seed/pod/berry/seedhead**, a **near** whole-plant
and a **far** plant-in-context (different backgrounds), and **each season** the plant actually
has (spring emergence, fall colour, winter structure). To fill the types that top-voted iNat
results miss (which skew to flowers), target them: `--phenology no_evidence` for clean foliage,
`--phenology fruiting` for seeds/pods, `--month 9,10,11`/`12,1,2` for fall/winter, default votes
for habit — then **`gbif_add.py` APPENDS** the new shots without rebuilding the reel. The shot
types:

1. **Whole plant / habit** — its overall form, size and how it grows.
2. **Foliage** — a shot where you can actually read the leaves (shape, texture, colour),
   not just blurred greenery behind a flower.
3. **Flowers, shown FACE-ON (from the front, not the back/side)** — in clear detail. Several
   front-facing flowers in one frame is great; a shot looking at the *back* of the bloom is not.
4. **The whole plant IN BLOOM** for anything that flowers heavily — a mass/drift of flowers
   showing how it reads in the garden, **in addition to** the single-flower close-up. Want
   **both**, not just a zoom on one flower.
5. **Seed pods / seedheads / hips / berries** wherever they're a notable feature (asters,
   larkspur, bee plant, columbine, pasque plumes, rose hips, dogwood berries, milkweed pods…).
6. **Same species** (verify against the taxon + known features — no look-alikes), **open-licensed**
   (CC0/CC-BY/CC-BY-SA, or CC-BY-NC/-NC-SA for this non-commercial guide — never ARR; record
   attribution), **a photograph not an illustration**, and **upright** (apply EXIF orientation).
7. **Framed for the thumbnail:** the interesting feature must be **centered and clearly visible
   in the 720×480 card thumbnail without expanding** — not cut off at an edge, not a speck in the
   corner, not mostly hand/soil/sky/background.

**Image quality rubric (used by the audit; score each axis 0–2, or NA).** Score the plant's
*current* reel — a low score flags a shot type to add or replace:

| axis | 0 | 1 | 2 |
|------|---|---|---|
| **whole_plant** | no habit shot | habit cropped/cluttered | clear whole-plant form |
| **foliage** | can't tell leaf shape | leaves visible but secondary/blurred | leaf shape & texture readable |
| **flowers** | none/unclear (or not in bloom) | small or partial | crisp, detailed flowers |
| **front_facing** | bloom shown from behind/side | mixed/angled | face-on | *(NA if no flowers)* |
| **bloom_in_context** | neither mass nor close-up | only one of the two | both a flowering-mass shot **and** a close-up | *(NA if not a heavy bloomer)* |
| **seed_pods** | notable pods/seedheads/hips missing | partial | shown well | *(NA if not a notable feature)* |
| **thumb_framing** | feature cut off / lost in the thumbnail | off-centre or small | centered & legible in the 720×480 thumb |
| **seasonal** | single season only though the plant changes across the year | two seasons, missing one it clearly has | each season of interest covered (e.g. spring bloom + fall colour/seedheads + winter stems) | *(NA only if the plant truly has one season of interest — e.g. a frost-tender summer annual or a spring ephemeral)* |

**Overall verdict — push every plant to `excellent`.**
- **excellent** = *every applicable (non-NA) axis scores 2.* This is the bar we hold every plant to; if any axis is below 2, the reel isn't done — re-source the shot that's lacking.
- **good** = covers the plant well (no axis at 0, most at 2) — close, but still has a 1 to lift.
- **fair** = usable but missing shot types (several 1s/0s).
- **poor** = doesn't convey the plant (multiple 0s).

A plant that genuinely can't reach `excellent` because no open-licensed photo of a needed
shot exists (a rare cultivar's fall colour, say) should say so explicitly in its `gaps` note —
"capped at good: no CC winter shot exists" — so it's a known limit, not an oversight.

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
4. **GBIF** (`api.gbif.org`) — aggregates iNaturalist **plus observation.org and many
   other datasets** with license metadata, so it surfaces openly-licensed photos (and shot
   types — ripe berries, fall colour) that iNat's vote-sorted top results bury. **Use it to
   fill gaps the first three miss.** `tools/gbif_montage.py "<cat/slug>" "<Sci name>" [--us]
   [--month 9,10,11]` pulls StillImage media under open licenses (CC0/BY/BY-SA/BY-NC, never
   -ND) and tiles a montage; the **`--month` filter is the trick for seasonal shots** (autumn
   months → berries & fall colour). `tools/gbif_add.py <picks.json>` then **APPENDS** the
   chosen photo(s) to a plant's `shots[]` (unlike finalize.py/commons_finalize.py, which
   rewrite the whole reel) — exactly what you want to add one missing shot type; run
   `rethumb.py` after. (Filled kinnikinnick & trumpet-honeysuckle berries, cushion-spurge
   fall colour, and a blue-green summer little-bluestem.) GBIF also rate-limits (429) — the
   tool backs off.
5. **Openverse** (`api.openverse.org`) — aggregates CC-licensed media from **Flickr**, museums,
   and Wikimedia, no API key needed (anonymous `page_size` max **20**). This is the **last-resort
   path for named cultivars** that have NO clean iNat taxon and nothing on Commons/GBIF — many
   home growers post cultivar-labeled fruit/flower series to Flickr under CC. Query
   `GET /v1/images/?q=<cultivar>&license_type=all-cc&page_size=20`; each result carries `url`
   (direct `live.staticflickr.com` image), `license`/`license_version`, `creator`, and
   `foreign_landing_url`. **Skip any `-nd` (NoDerivatives) license**; CC-BY-NC-SA is fine for this
   non-commercial guide. There's no dedicated tool yet — download the picks, then build the
   `shots[]` + `credits.json` the same way `commons_finalize.py` does (`url` as the remote
   fallback, baked attribution `© <creator> (<license>) / Flickr`) and run `rethumb.py`. (Found
   the real **Toka plum** blossom/fruit series and the **Reliance peach** fruit shots this way —
   both had zero Commons/iNat cultivar photos.) **Watch the noise:** "GoldRush"/"Reliance"/
   "Summercrisp" are also a Chaplin film, a steamship, and a chocolate bar — always Read a montage
   to verify the subject before finalizing.

Always send a descriptive `User-Agent` (e.g. `co-plants-herbarium/1.0 (evanhanders@gmail.com)`)
to the iNat API too. The whole pipeline lives in `tools/` and is reusable.

**iNat API path (preferred — used for most plants):** `tools/inat_montage.py` automates
steps 1–3 — `python3 tools/inat_montage.py "<cat/slug>" "<Botanical name>" [place_id]
[--global]` resolves the active taxon, pulls CC photos (Colorado `place_id=34` by default,
auto-widening to global if too few; pass `--global` up front for non-CO garden cultivars),
writes a labeled `montage.jpg` to review and appends the per-slug `shortlist.json` entry.
Set `PHOTOWORK=/tmp/<dir>` to run several in parallel without collisions. Add `--anygrade`
to include cultivated/casual observations (needed for garden cultivars like 'Mersea Yellow'
pineleaf penstemon that log as "casual" and are otherwise filtered out by research-grade).
**To target a shot type, filter the query:** `--month 9,10,11` (seasonal — fall colour,
berries) and especially `--phenology fruiting|flowering|budding|no_evidence` (iNat's
human-applied Plant Phenology annotation — the precise way to surface seed-pods/berries vs
blooms, and `no_evidence` [no flowers] is the way to surface clean **foliage**/out-of-bloom
shots for a foliage or off-season gap). These beat
GBIF for this since iNat's annotations are cleaner; reach for GBIF only when you need
**non-iNat** datasets (observation.org etc.).

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

**Pick QC — auto-reject (do this on the *picked* shots, not just the montage).** The **parent**, not
only a sourcing sub-agent, must `Read` the chosen shots and toss any that are: a **pressed/dried
herbarium specimen**, a **hand-dominated** cut-twig shot (a hand fills the frame), an **indoor / wall
/ AC-unit** background, a **pavement-crack / litter / weedy** setting (cigarette butts, trash), or
the subject **lost in grass / a tiny speck**. These slip past taxon-keyword montage sourcing and were
each caught *only* by eyeballing the picks (a pressed-specimen pussy-willow "habit", hand-held
foliage twigs, a cigarette-butt alyssum). When re-sourcing, hand the sub-agent this reject list
explicitly. Sub-agents also mislabel (a distant habitat shot tagged "flower close-up", flowers shown
from behind) — trust the pixels you `Read`, not the agent's caption.

**Finalizing from bare photo ids.** When picks span several montage passes (whose `shortlist.json`
gets overwritten), don't fight the scattered files — hand-build finalize's inputs directly from a list
of `{photo_id, kind, s, by, lic, cap}`: probe `inaturalist-open-data.s3.amazonaws.com/photos/<id>/
medium.{jpeg,jpg,png}` (HEAD) to learn each `ext`, then emit `shortlist.json` + `picks.json` yourself
and run `finalize.py`. (CC0/CC-BY/CC-BY-NC are all in the open-data bucket, so this works for every
license we accept.) **`finalize.py` requires the `plant.json` to already exist** — it only injects
`shots[]` — so write the (shots-less) record first, then finalize, then `rethumb.py`.

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

## Inline citations & the page bibliography

Every claim on a plant's **detail page** is cited; the encyclopedia grid stays clean. The
mechanism (all in `plant.js` + the `references`/`fact_src` schema):

- **`references`** is the per-plant **bibliography** — an ordered `{name,url}` array numbered
  `[1], [2], …` in order. It is the single source-of-record; it **replaces `care_src`**.
- **Inline `[n]` / `[n,m]` markers** go at the **end of the claim** they support inside every
  `care.*` and `edible.*` prose value (e.g. `…USDA zones 4–8.[1][3]`). `cite()` escapes the text
  then renders each marker as a superscript link into the bibliography.
- **The facts table** is cited via the **`fact_src`** map (field → `[refs]`), NOT by editing the
  shared card fields — markers in `size`/`sun`/… would leak onto the grid cards.
- **Number every claim against the source it actually came from** (same honesty rule as care):
  a Front-Range-timing claim → the extension source; a hard botanical number → the species
  authority. Don't cite a source you didn't read; don't leave a hard number uncited.
- **Validate** with `tools/check_refs.py` (markers ↔ bibliography) and `tools/check_citations.py`
  (URLs reachable + on-topic) — both must pass before committing.

## Sourcing edibility facts (the detail-page `edible` block)

Edibility is **safety-critical** — people may eat based on it — so it gets *more* rigor than care,
not less. Be conservative, be **part-specific** (which part is edible vs. which is poisonous), and
ground every statement in an authority cited in `references`.

- **Set `level` honestly:** `edible` (parts safely eaten with ordinary prep), `caution` (some
  parts edible but others toxic, or specific prep required for safety — e.g. chokecherry: fruit
  flesh edible, leaves/twigs/seed pits cyanogenic), `toxic` (poisonous, do not eat — e.g. all
  euphorbias), `inedible` (no known edible use but not notably poisonous). When in doubt, escalate
  toward caution/toxic, never the reverse.
- **Always write the `caution` cell** — name the poisonous parts, the toxic compound if known
  (cyanogenic glycosides → HCN; euphorbia diterpene-ester latex), look-alike/ID risks, and
  raw-vs-cooked danger. This is the most important field; never omit it even for "edible" plants.
- **Trusted edibility/toxicity sources** (prefer authoritative + reachable; send the descriptive
  `User-Agent`): USDA **NRCS plant guides/fact sheets** & **PLANTS**, **USDA-FS** incl. the **FEIS**
  fire-ecology database (excellent on toxic compounds + livestock hazard), **university extensions**
  (CSU, NC State Plant Toolbox, USU…), the **Native American Ethnobotany Database** (naeb.brit.org —
  documented traditional food use), the **Lady Bird Johnson Wildflower Center**, and for toxicity
  **poison-control / veterinary** sources (National Capital Poison Center poison.org, **ASPCA**).
  **PFAF (pfaf.org) only as corroboration, never the sole source** for a safety claim; no foraging
  blogs or nursery pages. Verify each URL is reachable before citing.

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

**293 specimens** (`plants/manifest.json` is the source of truth for the exact count), all verified
non-weed in CO and all carrying a full `care` block (incl.
`planting` + `propagation`) **and a repo-hosted photo reel** (close-up + structure, seasonal
where good shots exist). Every plant's detail page is **fully cited** — a numbered
`references` bibliography with inline `[n]` markers on the facts table (`fact_src`), the care
prose, and a safety-reviewed **`edible` block** (split roughly inedible · caution · edible · toxic;
the exact per-category tallies predate the most recent batches). Every **non-native** plant (the
majority) also carries **provenance** —
`origin` (where it's from) + `habitat` (its wild growing conditions) — shown as blue "Native
to" / "Wild habitat" rows on its card and detail page, cited via `fact_src`. Grouped by type
below (the order the site uses); the per-section bullet lists below are illustrative, not exhaustive —
the manifest is authoritative. Photos were sourced
mostly from the iNaturalist open dataset via `tools/inat_montage.py` (note: the yellow
'Mersea Yellow' pineleaf penstemon came from *cultivated* iNat observations — pass through the
research-grade filter only by querying without `quality_grade=research`, since garden
cultivars log as "casual"); cultivars with no clean iNat taxon (the vine
roses/clematis, 'Dropmore Scarlet' & 'Rozanne', white 'Icicle' speedwell, 'Moonshine' yarrow)
were hand-sourced from Wikimedia Commons (`commons_search.py` → `commons_finalize.py`). The 8
**fruit-tree cultivars** (Honeycrisp/GoldRush apples, Evans Bali/Montmorency cherries,
Stanley/Toka plums, Reliance peach, Summercrisp pear) used Commons for the cultivar-labeled
shots, **Openverse/Flickr** (`api.openverse.org` → CC-licensed Flickr photos) for the Toka and
Reliance cultivar shots that Commons lacked, and honestly-captioned **species-representative**
shots where no cultivar photo exists at all (Summercrisp pear — see its `gaps` note; the
*Pyrus communis* shots match the cultivar's described look). Every shot keeps a remote
`commons`/`url` fallback; card thumbnails are 720×480 smart-crops (`tools/rethumb.py`).
Nine **garden ornamentals** followed (Acanthus, three wallflowers, nasturtium, four
pelargoniums): photos came from iNat at the species/type level (fine for these), Commons for
the 'Bowles's Mauve' wallflower cultivar, and honestly-captioned **species-representative**
*Erysimum* for the 'Apricot Twist' wallflower (no CC cultivar photo exists — see its `gaps`).
Several are **frost-tender** on the Front Range (Acanthus is borderline ~zone 7; the
pelargoniums are killed by frost and grown as annuals or overwintered indoors) — the `care`
blocks say so plainly rather than overselling hardiness.
Most recently, **twelve winter/early-spring pollinator plants** were added to bridge the Feb–March
forage gap (nothing else on the roster blooms before April): the early bulbs/tubers **snow crocus,
snowdrops, winter aconite, dwarf iris**; the true winter bloomers **Christmas rose** (*Helleborus
niger*) and **winter heath** (*Erica carnea*); the late-winter shrubs **witch hazel** (*Hamamelis
vernalis*), **Cornelian cherry** (*Cornus mas*) and **pussy willow** (*Salix discolor*); and the
potted/cool-season **rosemary, sweet alyssum, pansy** — things you can keep in bloom in a pot and set
outside on warm winter days for foraging bees. Honesty calls baked into their `care`: **winter heath
is NOT ground-hardy here and needs an acid-mix pot** (Boulder's alkaline clay would kill it); **witch
hazel** and **pussy willow** are North-American natives but **not** Front-Range natives (marked
`Non-native` with honest `origin`); **pussy willow is dioecious** (buy a named *male* for the
pollen-bearing catkins) and a **high-water wetland shrub**; **sweet alyssum** is left `caution`/not-
food (no authority documents it as culinary). Photos via `tools/inat_montage.py` (iNat open data).
Most recently, a **20-plant cut-flower/bulb batch** was added: the cottage/cut-flower annuals **marigold,
nigella, bachelor's button, sweet pea (a Vine), amaranth, celosia, strawflower, calendula**; the
spring-bulb/corm garden classics **garden tulip, species tulip, daffodil, Dutch crocus, bearded iris,
ornamental allium, gladiolus**; and the natives **sunflower (CO-native annual), Rocky Mountain iris,
nodding onion**, plus **black-eyed Susan** and **desert marigold**. Honesty calls: **gladiolus** is a
`Tender perennial` (corms not winter-hardy here — lift & store each fall like dahlia); **garden hybrid
tulips run short-lived** on the dry Front Range (species tulips perennialize far better); **black-eyed
Susan** and **desert marigold** are North-American/SW-US natives but **not** Front-Range natives (marked
`Non-native` with honest `origin`, per the witch-hazel/pussy-willow convention); **sweet pea is toxic**
(lathyrism — not the edible pea) and **nigella is the ornamental *N. damascena*, not culinary *N.
sativa*** (left `caution`/not-food); **nodding onion is edible but has a deadly death-camas look-alike**
(eat only if it smells of onion). **Ranunculus was evaluated and ruled out** (too marginal here — see
"Ruled out"). Strawflower's reel is the yellow species form only (no CC cultivar shots — logged in its
`gaps`). All photos via `tools/inat_montage.py` (iNat open data); 720×480 smart-crop thumbs.
Most recently, a **21-plant Colorado-native batch** was added from CSU Extension's native-plant
recommendations (fact sheets 7.421/7.422/7.242): the **3 native penstemons** (Rocky Mountain, scarlet
bugler, bluemist — these activated the Penstemons family card alongside pineleaf); **7 xeric prairie
forbs** (dotted gayfeather, prairie coneflower, prairie smoke, sulphur flower buckwheat, golden banner,
scarlet globemallow, prairie zinnia); **7 native shrubs** (Apache plume, Boulder raspberry, three-leaf
sumac, shrubby cinquefoil, rabbitbrush, leadplant, waxflower); and **4 small native trees** (bigtooth
maple, Gambel oak, piñon pine, Rocky Mountain maple). Honesty calls: **golden banner is toxic**
(quinolizidine alkaloids); **three-leaf sumac** (tart lemonade berries) and **Boulder raspberry** (dry,
bland fruit) and **piñon** (pine nuts) are edible, and **Gambel oak acorns** are `caution`/edible-only-
after-leaching-tannins; **Rocky Mountain maple is the one non-xeric** of the trees (montane streamside —
wants supplemental water + afternoon shade). Care sourced via parallel agents from CSU/USU Extension,
Plant Select, USDA NRCS plant guides, USDA-FS FEIS, LBJ Wildflower Center, MBG, and NC State; photos via
`tools/inat_montage.py`.
(N) = CO/regional native, (I) = introduced/vetted.

**Reel enrichment (June 2026):** **every plant now carries 6–9 photos** — the whole guide was
backfilled against the shot-type checklist via phenology/month-targeted montages + `gbif_add.py`
(foliage, seeds/pods/berries, near + far/in-context habit, fall colour, winter structure). The
Gambel-oak acorn and three-leaf-sumac fall-colour gaps are now filled. The navigator shows season-icon
dots and every reel is ordered by season (the curated lead stays the card thumbnail). Guide-wide avg
is **~6.8 photos/plant (1,198 images); 0 plants below 6.** Garden cultivars with thin CC supply (the
pelargoniums, wallflower/yarrow/Rozanne cultivars, fruit cultivars) use honestly-captioned
**species-representative** shots where no cultivar-specific photo of a needed type exists — matching the
guide's existing convention. New entries should hit 6–9 the same way.

**Winter-shot pass (June 2026):** went back through the whole roster specifically for **winter
interest** (snow-laden evergreens, bare-stem/persistent-fruit architecture, dried seedheads & seed
plumes, semi-evergreen basal rosettes, and snowmelt bloomers like crocus/dwarf-iris) and added a
genuine Northern-Hemisphere winter photo wherever one exists — **winter coverage 41 → 114 of 176
(65%)**. The remaining 62 are honest, principled skips, not gaps: **19 annuals** and **7 tender
perennials** (frost-killed / corms lifted — no winter presence), plus **36** dormant-bulb
(tulip/daffodil/grecian-windflower), full-dieback (peony, phlox, columbine, nodding onion), or
genuinely no-open-licensed-winter-shot cases (river-hawthorn, jostaberry, blue-oat-grass,
russian-sage, the *Veronica liwanensis* look-alike, the vine cultivars). **Watch the Southern-
Hemisphere-summer trap:** `inat_montage.py --month 12,1,2` returns Dec–Feb *globally*, so it
surfaces lush SH-summer blooms — every winter pick must be eyeballed for real NH-winter context
(snow/frost/dormancy) before it's appended. Forcing a misleading growing-season shot onto a plant
that's bare ground in January is worse than an honest skip.

**Cottage/kitchen-garden batch (June 2026):** added **seven** plants from a user request — the
cottage-spire **hollyhock** (*Alcea rosea*, a Forb biennial, mallow-family edible flowers/young
leaves; hollyhock rust is its signature care issue); the **littleleaf linden** (*Tilia cordata*, a
large non-native shade/street tree and a major bee-nectar tree — flowers are the classic *tilleul*
tea, young spring leaves edible); two **edible cool-season crops**, **arugula** (*Eruca vesicaria*,
peppery salad green; flea beetles the #1 pest) and **garden pea** (*Pisum sativum*, a climbing Vine
— shelled peas, edible pods & shoots, flagged distinct from the **toxic** sweet pea *Lathyrus* already
in the guide); the South-African **red hot poker** (*Kniphofia uvaria*, a hummingbird/bee nectar Forb,
borderline-hardy — sharp drainage + tie foliage over the crown for winter); the silver-foliage
groundcover **lamb's ear** (*Stachys byzantina*, xeric — overhead water rots the wool); and the
**foxglove beardtongue** (*Penstemon digitalis*, an eastern/central-US prairie native — marked
`Non-native` per the witch-hazel convention — which **joins the penstemons family card**, and is far
more clay/moisture-tolerant than the xeric Western penstemons). Honesty calls baked in: linden is
**NOT xeric** (leaf-scorch/aphid-honeydew tree); red hot poker is **zone-borderline**; arugula & peas
are **frost-killed annuals** (no winter presence). All seven are **Non-native** with honest
`origin`/`habitat`. Photos via `tools/inat_montage.py` (iNat open data), 720×480 smart-crop thumbs.

**Mulleins family (June 2026):** added **four** ornamental *Verbascum* on a user request, folded into a
new **Mulleins** family card (id `mulleins`, homed in Summer forbs, lead = purple mullein) — the
**purple mullein** (*V. phoeniceum*, hardy xeric perennial, purple/rose/white saucer spires),
**nettle-leaved mullein** (*V. chaixii*, the sturdiest/longest-lived, yellow-or-white flowers with
purple-wool stamens), **giant silver mullein** (*V. bombyciferum*, an architectural monocarpic biennial:
a white-felted silver rosette → a 5–6 ft yellow candelabra) and the pastel **garden hybrid mullein**
(*V.* 'Southern Charm' & kin, Commons-sourced — no clean iNat taxon). **Weed-check call:** the two
familiar mulleins — **common mullein (*V. thapsus*, CO List C)** and **moth mullein (*V. blattaria*, CO
List B)** — are Colorado noxious weeds and were **deliberately excluded**; only the non-listed garden
species/hybrids were added (verified 2026-06-11). All four are **Non-native**, xeric, sharp-drainage-
demanding (crown rot in wet clay is the #1 killer), with honest self-sowing-management notes (deadhead
spikes at the base). Photos via `tools/inat_montage.py`; the hybrid via the Wikimedia Commons pipeline.

**Succulents & cacti batch (June 2026):** added **five** drought-proof succulents/cacti on a user request —
the CO-native **soapweed yucca** (*Yucca glauca*, a Shrub: evergreen sword-leaf clump, creamy flower spikes,
obligate yucca-moth mutualism; flowers/young fruit/seeds edible cooked, roots saponin-toxic), the two
CO-native cacti **plains prickly pear** (*Opuntia polyacantha*, a Subshrub: low spiny pad mat, yellow/pink
blooms; tunas & nopales edible once de-glochided) and **claret cup cactus** (*Echinocereus triglochidiatus*,
a Subshrub and **Colorado's official state cactus** since 2014: scarlet hummingbird cups on ribbed mounds),
plus two mat-forming groundcovers — the non-native **hens and chicks** (*Sempervivum tectorum*, monocarpic
rosettes that pup "chicks") and the CO-native **spearleaf stonecrop** (*Sedum lanceolatum*, yellow-flowered
mat, *Parnassius smintheus* larval host). All five are `caution`-level edibility (yucca/prickly-pear/claret-
cup are genuine foods with careful prep; hens-and-chicks & stonecrop are non-toxic but not documented foods).
Honesty calls: yucca **roots are saponin-toxic** (soap, not food); prickly-pear **glochids** are the real
hazard (not chemical toxicity); claret cup demands **sharp drainage** (cold+wet = rot); hens-and-chicks is the
one **Non-native** (origin: European Alps/Pyrenees). Photos via `tools/inat_montage.py` (iNat open data),
720×480 smart-crop thumbs; care/edibility sourced from LBJ Wildflower Center, USDA-FS FEIS, NC State, ASPCA,
Wikipedia & PFAF.

**Nursery-haul batch (June 2026):** added **20** plants from a user's nursery trip. Three penstemons joined
the **Penstemons** family card — the garden hybrids **Prairie Jewel** and **Pikes Peak Purple** (*P. ×mexicali*,
Plant Select) plus the real Sonoran-desert **Desert beardtongue** (*P. pseudospectabilis*). Two monardas joined
**Bee balms** — the CO-native **Mintleaf bee balm** (*M. fistulosa* var. *menthifolia*, the gray drought-tolerant
western form) and the annual **Lemon bee balm** (*M. citriodora*). New family cards: **Sweet scabious** (*Scabiosa
atropurpurea* + its deep-red **'Firecracker'**) and **Columbines** (folding the existing Colorado blue columbine
together with the new golden **Denver Gold columbine**, *Aquilegia chrysantha*, Plant Select). New standalones:
**Hummingbird mint** (*Agastache cana*), **Redbirds in a tree** (*Scrophularia macrantha*, NM Plant Select figwort),
CO-native **Desert four o'clock** (*Mirabilis multiflora*), **Sunny Border Blue speedwell** (upright *Veronica*
hybrid), **Jasmine pink** (*Dianthus* hybrid), **Moonbeam threadleaf coreopsis** (*C. verticillata*), CO-native
**Smooth aster** (*Symphyotrichum laeve*, → Asters card), CO-native **Red prairie coneflower** (*Ratibida
columnifera* f. *pulcherrima*, the mahogany-red Mexican hat — distinct from the existing yellow one), **Copperhead
amaranth** (*A. cruentus* grain cultivar), **Mexican ageratum** (*Ageratum houstonianum*), **Lesser calamint**
(*Calamintha/Clinopodium nepeta*) and the statuesque tallgrass-prairie **Compass plant** (*Silphium laciniatum*).
Honesty calls baked in: **Ageratum is toxic** (hepatotoxic pyrrolizidine alkaloids — not food); **Mirabilis** roots
are bioactive/not-food; **Desert beardtongue, Denver Gold columbine, Agastache, Mexican ageratum, Compass plant,
Lemon bee balm, Smooth-aster's** garden kin are all honestly classed `Non-native` where they aren't Front-Range
natives (per the witch-hazel convention); the garden hybrids (the two hybrid penstemons, Sunny Border Blue, Jasmine
pink, 'Moonbeam', 'Firecracker', 'Denver Gold') use honestly-captioned **species-representative** photos with a
`gaps` note where no open-licensed cultivar shot exists. Edible calls: mintleaf & lemon bee balm and calamint are
culinary mints (`food:true`, leaf/flower tea); copperhead amaranth is a grain+greens crop; the rest range
inedible→caution→toxic. Photos via `tools/inat_montage.py` (+ GBIF/Commons for the thin-supply cultivars).

This batch also introduced the **`aka` cultivar-alias field** (see the schema list): six plants the user bought
were cultivars/synonyms of species already in the guide — **Munstead lavender**, **Black Prince snapdragon**,
**Rustic Colors** (Rudbeckia hirta), **Prairie/Lewis flax** (Linum lewisii), **Rocky Mountain columbine** (Aquilegia
coerulea = the existing blue columbine), and the already-present *Sphaeralcea coccinea*. Rather than spin up
near-duplicate pages with identical care, their alternate names were folded into the parent entry's `aka` array so
searching the cultivar surfaces the parent (with a subtle "Also: …" line on the card/sheet).

**Hedge cotoneaster + guide-wide pruning field (July 2026):** added **hedge cotoneaster** (*Cotoneaster
lucidus*) from a user request — the dense upright Asian shrub that is *the* classic tall Front-Range privacy hedge
(glossy leaves, small black cyanogenic berries, scarlet fall color; a `Non-native`, fire-blight-prone rose relative,
verified non-weed 2026-07-01 — not on CO's A/B/C or Watch lists). Photos via `tools/inat_montage.py` (8-shot reel:
spring flowers → summer foliage/habit/screen → fall berries + scarlet color → berries-in-snow winter). The same
request added a **new `pruning` care field** (`CARE_FIELDS` in `plant.js`, rendered between Feeding and Maintenance)
and **backfilled it across every woody plant in the guide** — all Trees, Shrubs, Subshrubs, and the woody/perennial
Vines (~80 plants) — each a cited paragraph covering *when to prune here · technique/what to cut · what can go
wrong*. Sourced via parallel agents (RHS for clematis pruning-groups & rose types, CSU/USU/UMN extension, MBG, NC
State, USDA/USFS, LBJ), reusing each plant's existing bibliography where possible (a handful of new UMN/CSU/RHS
pruning refs appended + verified 200). Pruning prose was moved **out** of `maintenance` into `pruning` to de-duplicate.
Species-specific care baked in: spring bloomers on old wood (lilac, mock orange, witch hazel, rhododendron/azalea)
prune **after** flowering; maples/grape bleed if cut late-winter (prune in summer / fully-dormant respectively); oaks
only in dormant winter (borer/disease); conifers won't resprout from bare old wood; lavender/sages never cut into
leafless old wood; clematis by RHS pruning group (jackmanii = Group 3 hard cut, native *C. columbiana* = Group 1
minimal); fire-blight-prone Rosaceae (apple, pear, hawthorn, cotoneaster) get dry-weather cuts + tool sterilization.

**Walk-sighting batch (July 2026):** identified **eight** plants a user photographed on a walk and added the **six** that weren't already in the guide (coreopsis and blanket flower were already covered → skipped). Verified non-weed vs CO lists A/B/C 2026-07-06; sourced via parallel agents (one per plant): **pink skullcap** (*Scutellaria suffrutescens*, a `Non-native` Subshrub — borderline ~zone 7, honestly framed as a warm-microclimate/overwintered-pot plant, not ground-hardy here); **bluebeard / blue mist spirea** (*Caryopteris × clandonensis*, Subshrub — cut hard each spring, blooms on new wood, a top late-season bee plant); **oriental fountain grass** (*Pennisetum orientale* syn. *Cenchrus orientalis*, a Grass — its `care` explicitly distinguishes this hardy, self-sowing-but-manageable species from the truly invasive tender *P. setaceum*, which is not hardy here); **four o'clock** (*Mirabilis jalapa*, a Forb `Tender perennial` — slug `annuals/four-oclock`, kept distinct from the existing CO-native `desert-four-oclock` = *M. multiflora*; `edible` set **toxic** — poisonous black seeds + tuberous root, trigonelline; dig-and-store the tuber like dahlia); **trumpet vine** (*Campsis radicans*, a woody Vine — `Non-native` per the SE-US-but-not-Front-Range convention, hummingbird magnet, `edible` **toxic** for cow-itch contact dermatitis; aggressive root-suckering/self-seeding + aerial-rootlet structural damage baked into `spread`/`maintenance`); and **hawthorn** (*Crataegus sp.*, a Tree — a deliberate **genus-level** entry: the user's tree was IDed from photos only to genus (glossy unlobed leaves + round red star-calyx haws best match a cockspur-type), so the blurb/care/edible state the species-uncertainty honestly and the reel uses honestly-captioned representative *Crataegus* shots; `edible` caution — haw flesh cooked, spit the cyanogenic seeds). Reels are 7–9 CC shots each via `tools/inat_montage.py` (iNat open data), 720×480 smart-crop thumbs; every entry fully cited (`check_refs` + `check_citations` pass) with provenance.

**Sumacs & milkweeds batch (July 2026):** on a user request ("do we have sumacs and milkweeds?"),
added **four** relatives of the existing three-leaf sumac and showy/butterfly milkweeds, and created a
new **Sumacs** family card (id `sumacs`, homed in Shrubs, lead = three-leaf-sumac) folding in the two
new sumacs + the existing three-leaf sumac. Verified non-weed vs CO lists A/B/C/Watch 2026-07-13; care
sourced via four parallel agents (one per plant, distinct files). The sumacs: **smooth sumac**
(*Rhus glabra*, a Shrub — CO-native, **dioecious** so only female plants bear the crimson berry cones,
brilliant scarlet fall color, edible red berries for "sumac-ade") and **fragrant sumac** (*Rhus
aromatica* — marked **Non-native**: three authorities confirm *R. aromatica* sensu stricto does **not**
reach Colorado, whose Front-Range vicariant is the already-listed *R. trilobata*; low mounding shrub,
aromatic trilobed leaves, blooms on old wood so prune after flowering; edible red berries). The
milkweeds: **swamp milkweed** (*Asclepias incarnata*, a Forb — CO-native, the one **moisture-loving**
milkweed for wet/moist ground (NOT xeric), a well-behaved single-crown clump; `edible` **caution**/
`food:false` — historical cooked use noted but not advertised, NRCS frames internal use as a medicinal
emetic) and **whorled milkweed** (*Asclepias verticillata*, a Forb — marked **Non-native**: USFWS
confirms *A. verticillata* is **absent from Colorado**, whose native whorled milkweed is the distinct
*A. subverticillata*; fine threadlike whorled foliage, xeric, blooms late; `edible` **toxic** — one of
the most livestock-toxic milkweeds). Photos via `tools/inat_montage.py` (iNat open data; 8–9 CC shots
each), 720×480 smart-crop thumbs; every entry fully cited (`check_refs` guide-wide + `check_citations`
pass).

**Primulas batch (July 2026):** on a user request ("add primulas"), added **five** *Primula* as a new
**Primulas** family card (id `primulas`, homed in Spring forbs, lead = polyanthus): the woodland
**English primrose** (*P. vulgaris*, pale-yellow single flowers), the multicolor garden **polyanthus**
(*P. × polyantha*, a *P. vulgaris* × *P. veris* hybrid), the meadow **cowslip** (*P. veris*, golden
nodding umbels), the Himalayan **drumstick primrose** (*P. denticulata*, spherical flower globes), and
the CO-native alpine **Parry's primrose** (*P. parryi*). Verified non-weed vs CO lists A/B/C/Watch
2026-07-14 (no *Primula* is listed); care sourced via five parallel agents (RHS, MBG, NC State,
Southwest Colorado Wildflowers, USDA-FS/NRCS, American Primrose Society, CSU PlantTalk). Honesty calls
baked in: **four are Non-native** (English/cowslip = European, drumstick = Himalayan, polyanthus = garden
hybrid) with cited `origin`/`habitat`; **Parry's is CO-native but a true high-alpine bog specialist**
(10,000–12,000 ft snowmelt streamsides) that is very hard to grow in Boulder's lowland heat — framed
honestly like the guide's Himalayan-blue-poppy/winter-heath calls, and **famously skunky-scented**. Most
primulas want cool, moist, humus-rich shade (the opposite of our hot, dry, alkaline clay) and are often
short-lived cool-season plants here; **cowslip is the exception** — a lime-tolerant meadow plant, the one
most likely to thrive. Edibility: **cowslip** `edible` (flowers + young leaves — cowslip wine/salads);
**English primrose** & **polyanthus** `caution`/`food` (edible flowers, but Primula sap carries **primin**
contact-dermatitis allergen; polyanthus bedding plants often pesticide-treated); **drumstick** `caution`/
not-food; **Parry's** `inedible` (+ an ethical note not to forage alpine natives). Photos via
`tools/inat_montage.py` (iNat open data; English/cowslip/drumstick/polyanthus `--global`, Parry's from
Colorado records), 8 shots each, 720×480 smart-crop thumbs.

**St. John's wort + ornamental oreganos batch (July 2026):** on a user request, added **three** plants.
The shrub **Shrubby St. John's wort** (*Hypericum prolificum*, a `Non-native` mounded shrub with golden
powder-puff summer flowers + persistent rusty winter seed capsules; a native-bee magnet). **Weed-check
call:** *H. prolificum* is not CO-listed, but its relative **common St. Johnswort / Klamath weed (*H.
perforatum*) is a CO List C noxious weed** and was deliberately kept separate; the edibility is `toxic`
(hypericin photosensitization). Plus **two flowering ornamental oreganos** folded into a new **Ornamental
oreganos** family card (id `ornamental-oregano`, homed in Subshrubs, lead = 'Kent Beauty'): the hardy
xeric **'Herrenhausen'** (*Origanum laevigatum*, rose-purple flowers over dark bracts, a top late-season
bee plant; `edible` but milder than culinary oregano) and the marginal jewel-box **'Kent Beauty'**
(*Origanum* hybrid, cascading green→rose-pink hop-like bracts; ~zone 5b–6, sharp-drainage trough/potted —
`edible` level but not documented as culinary, so no `food`). All three are **Non-native** with honest
`origin`/`habitat`; both oreganos are aromatic/deer-resistant Subshrubs carrying `pruning`. Photos:
Hypericum via `tools/inat_montage.py` (iNat open data, 7 shots incl. fall + winter capsules); the two
oreganos via a mix of iNat + the **Wikimedia Commons** cultivar pipeline (`commons_search.py` →
`commons_finalize.py`), hand-merged. 'Kent Beauty' uses two honestly-captioned **parent-species**
(*O. rotundifolium*, near-identical) shots where no CC cultivar shot of that type exists (logged in its
`gaps`); 'Herrenhausen''s reel is species-level *O. laevigatum* representing the selection. Every entry
fully cited (`check_refs` guide-wide + `check_citations` pass).

**Marigolds family + Mongolian Gold clematis batch (July 2026):** on a user request to "expand the tagetes
family beyond the classic marigold and make it a reel," added **three** more *Tagetes* and folded them
together with the existing French marigold into a new **Marigolds** family card (id `marigolds`, homed in
Summer forbs, lead = the existing `marigold`): **African marigold** (*T. erecta*, the tall big-pompom /
Día-de-los-Muertos flower; edible saffron-substitute petals), **Signet marigold** (*T. tenuifolia*,
lacy-leaved mound of small single flowers — the best-flavoured culinary marigold; `aka` 'Lemon Gem'/'Tangerine
Gem'), and **Mexican mint marigold** (*T. lucida*, the anise-scented "Texas/Spanish tarragon" — a `Tender
perennial` grown as an annual here, blooms Fall; `aka` Texas/Spanish/Mexican tarragon, sweet mace). All three
are **Non-native** (Mexico/Central America) with cited `origin`/`habitat`; all `edible`/`food:true` with the
Tagetes phototoxic-thiophene + Asteraceae-allergy cautions. The same request also added **Mongolian Gold
clematis** (*Clematis fruticosa* 'Mongolian Gold') — a **Subshrub** (not a vine): a xeric, cold-hardy
Mongolian-steppe **shrub** clematis with nodding yellow lantern flowers + silvery seed plumes. **Weed-check
call:** verified it is the distinct shrubby species *C. fruticosa*, **NOT** the vining ***C. orientalis***
(Chinese/orange-peel clematis, a CO **List B** noxious weed whose listing covers all its cultivars) — the
diagnostic tell is shrub-vs-vine, stated plainly in the blurb; `edible` **toxic** (protoanemonin). It carries
`pruning` as **Group 3** (hard spring cutback, blooms on new wood); kept standalone (not in the vine `clematis`
collection) since its growth form differs. Photos: marigolds via `tools/inat_montage.py` (iNat open data,
6 shots each); the clematis is species-representative *C. fruticosa* iNat shots (5 shots — CC imagery of the
cultivar/species is scarce; logged in its `gaps`). Every entry fully cited (`check_refs` guide-wide +
`check_citations` pass).

**California fuchsia (July 2026):** added **California fuchsia / hummingbird trumpet** (*Epilobium canum*,
syn. *Zauschneria*) after a user photographed one a hummingbird was working — a low xeric `Groundcover`
mat that erupts in scarlet-orange tubular trumpets late summer into fall; a premier hummingbird plant,
grown on the Front Range as the cold-hardy Rocky Mountain **'Orange Carpet'** (*garrettii*) Plant Select
form. **Non-native** per the witch-hazel convention (a SW/interior-western-US native — UT/ID/WY/AZ — that
isn't Front-Range-local; cited `origin`/`habitat`); `edible` **inedible** (no documented food use, not a
true *Fuchsia*); `spread` honestly notes it runs by rhizome (the SPREADS trait is correct here, unlike a
false match). Weed-checked vs CO A/B/C/Watch 2026-07-18. `aka` carries the *Zauschneria* synonyms +
"Hummingbird trumpet" / "'Orange Carpet' hummingbird trumpet" for search. 8-shot iNat reel (flower, bloom
mass, low mat + grey foliage, cluster, wild habit, silvery seed plumes). Care sourced from Plant Select,
MBG, LBJ Wildflower Center, USDA NRCS plant guide, RHS; `check_refs` guide-wide + `check_citations` pass.

**Nursery walk-through batch (July 2026):** identified **~50** plants a user photographed at a Front-Range
nursery (label shots) and added the **41** not already covered (roster 252 → **293**). Weed-checked vs CO
A/B/C/Watch 2026-07-18 — all clear (notable calls: **Prunus padus** mayday tree is invasive in Alaska only,
NOT CO-listed, and is a Colorado Tree Coalition recommended tree; **Lysimachia nummularia** creeping Jenny
& **L. punctata** variegated loosestrife are NOT listed but their relative *L. vulgaris* IS on the CO
**Watch List** and purple loosestrife *Lythrum salicaria* is CO **List A** — both distinctions are called
out in those entries). Built by **8 parallel type-batched agents** (native woody · ornamental woody · Ribes
& Sambucus · bugleweeds & Lysimachia · cranesbills & mats · xeric sun · spring forbs · summer/shade forbs
& vine), each owning distinct files; the parent integrated manifest/collections/bundle and ran the QC +
citation passes. **Four new family cards** (`bugleweeds` = 4 Ajuga reptans; `pasqueflowers` = native
*Pulsatilla patens* + European *P. vulgaris* + 'Rubra'; `coral-bells` = *Heuchera sanguinea* + micrantha
'Palace Purple'; `elderberries` = *Sambucus nigra* 'Mikl's' + 'Marge'); the rest fold into existing cards
(4 currants/gooseberries → **currants**, 3 cranesbills → **hardy-geraniums**, Tiger Eyes → **sumacs**,
American plum → **plums**). **Four `aka` merges instead of duplicate pages:** 'May Night'→meadow sage,
'Furman's Red'→autumn sage, 'Purpleicious'→spike speedwell, 'Starfire'→garden phlox. Honesty calls baked in:
**golden chain tree** (*Laburnum alpinum*), **Saskatoon boxwood**, and the two **pasqueflowers** are `edible`
**toxic**; **western river birch** is riparian/**not xeric**; **blue wild indigo**, **woodland phlox**,
**lady's mantle**, **Palace Purple coral bells**, **Tiger Eyes staghorn sumac** and most cultivars are
`Non-native` (regional-but-not-Front-Range or garden origin) per the witch-hazel convention; aggressive
spreaders (pink evening primrose, false indigo, creeping Jenny, hardy plumbago, golden hops, the Ajugas)
carry explicit containment notes. Photos via `tools/inat_montage.py` (iNat open data; 6–8 shots each,
720×480 smart-crop thumbs); the many named cultivars with no clean CC taxon use honestly-captioned
species-representative shots with a `gaps` note, per the guide's convention. `check_refs` guide-wide PASS;
`check_citations` on the 41 PASS (every plant ≥1 reachable authority).

**Trees**
- River hawthorn (*Crataegus rivularis*) (N) — Thorny native small tree; white spring flowers, dark edible haws, superb wildlife cover. A caterpillar keystone (~90 Lepidoptera). *(Riparian — wants more water; edible haws, spit the cyanogenic seeds.)*
- Chokecherry (*Prunus virginiana*) (N) — Wildlife powerhouse: fragrant white flower racemes, dark…
- Mountain alder (*Alnus incana ssp. tenuifolia*) (N) — Multi-stem riparian tree with smooth grey bark and early…
- Honeycrisp apple (*Malus domestica 'Honeycrisp'*) (I) — Explosively crisp, honey-sweet apple; the Front Range's most dependable tree fruit.
- GoldRush apple (*Malus domestica 'GoldRush'*) (I) — A spicy-tart keeper apple that stores till spring; fire-blight-resistant.
- Evans Bali cherry (*Prunus cerasus 'Evans'*) (I) — Zone-3-hardy tart cherry, self-fertile and sweet enough to eat fresh or bake.
- Montmorency cherry (*Prunus cerasus 'Montmorency'*) (I) — The classic bright-red pie cherry — the Front Range's bulletproof tart cherry.
- Stanley plum (*Prunus domestica 'Stanley'*) (I) — Self-fertile European prune plum: sweet blue fruit fresh, dried, or canned.
- Toka plum (*Prunus 'Toka'*) (I) — The "bubblegum plum" — spicy-sweet, hardy to -40°F, the orchard's best pollinizer.
- Reliance peach (*Prunus persica 'Reliance'*) (I) — The hardiest peach and one of the last to bloom — the best shot at homegrown peaches.
- Summercrisp pear (*Pyrus communis 'Summercrisp'*) (I) — Cold-hardy, fire-blight-resistant pear, picked crisp and sweet in mid-summer. *(photos species-representative — see `gaps`)*
- Bigtooth maple (*Acer grandidentatum*) (N) — Small Western maple with brilliant scarlet-orange fall color; the Rockies' answer to sugar maple.
- Gambel oak (*Quercus gambelii*) (N) — Iconic foothills scrub oak; lobed leaves, gold-russet fall, acorns that feed everything. *(Acorns edible once leached of tannins.)*
- Piñon pine (*Pinus edulis*) (N) — Slow, drought-proof rounded evergreen; sweet edible pine nuts in good years. *(Edible seeds.)*
- Rocky Mountain maple (*Acer glabrum*) (N) — Graceful small canyon maple, clear-yellow fall, red samaras. *(The one non-xeric tree — montane streamside; wants moisture + afternoon shade.)*
- Littleleaf linden (*Tilia cordata*) (I) — Large pyramidal shade/street tree; heart-shaped leaves, fragrant pale-yellow summer flowers bees mob, clear-yellow fall. *(NOT xeric — wants moisture; flowers make tilleul tea, young leaves edible.)*

**Shrubs**
- Common lilac (*Syringa vulgaris*) (I) — Old-fashioned dooryard shrub prized for plumes of intensely…
- Creeping Oregon grape (*Berberis repens*) (N) — A low, stoloniferous native evergreen with holly-like leaves…
- Mock orange (*Philadelphus lewisii*) (N) — One of the most powerfully fragrant native shrubs on the…
- Red-twig dogwood (*Cornus sericea*) (N) — The classic winter shrub
- Smoke tree (*Cotinus coggygria*) (I) — A large, dramatic shrub famed for billowing clouds of…
- Twinberry honeysuckle (*Lonicera involucrata*) (N) — A bold native riparian shrub
- Wood's rose (*Rosa woodsii*) (N) — Fragrant pink wild rose with red hips that hang on all winter.
- Saskatoon serviceberry (*Amelanchier alnifolia 'Smoky'*) (N) — Bulletproof native fruiting shrub; sweet blueberry-like pomes for pies. *(Edible + Toxic: foliage/seeds cyanogenic)*
- Golden currant (*Ribes aureum*) (N) — Thornless native currant; clove-scented golden spring trumpets, sweet amber-to-black berries.
- Nanking cherry (*Prunus tomentosa*) (I) — Iron-hardy Asian bush cherry (−40°F); sweet-tart scarlet cherries. *(Edible + Toxic: pits/foliage cyanogenic)*
- Red currant (*Ribes rubrum 'Red Lake'*) (I) — CSU's go-to red currant; translucent ruby strigs for jewel-bright jelly.
- Black currant (*Ribes nigrum 'Ben Sarek'*) (I) — Aromatic compact bush; matte-black berries for deep musky jam/cordial. (Strongest white-pine-blister-rust host; 'Ben Sarek' rust-resistant.)
- Gooseberry (*Ribes uva-crispa 'Hinnomäki Red'*) (I) — Finnish dessert gooseberry; tart-skinned, sweet-fleshed dark-red berries.
- Raspberry (*Rubus idaeus 'Caroline'*) (I) — Fall-bearing red raspberry; mow to the ground each spring, crop late summer to frost.
- Jostaberry (*Ribes × nidigrolaria*) (I) — Thornless black-currant × gooseberry hybrid; vigorous, big tart-sweet near-black berries.
- Honeyberry / haskap (*Lonicera caerulea*) (I) — The true Front-Range blueberry alternative; alkaline-clay & −40°F tolerant, earliest fruit. (Needs two varieties to fruit.)
- Black chokeberry / aronia (*Aronia melanocarpa*) (I) — Ultra-hardy; red fall foliage + glossy black antioxidant berries (cooked/juiced). *(Not xeric — wants supplemental water.)*
- Sea buckthorn (*Hippophae rhamnoides*) (I) — Suckering silver-leaved, thorny shrub; intensely tart vitamin-C orange berries. *(Dioecious — needs male+female; suckering Elaeagnaceae, contain away from waterways.)*
- Witch hazel (*Hamamelis vernalis*) (I) — Spidery yellow-orange ribbons on bare branches in late winter — the rare woody winter bloomer. *(US (Ozark) native, not CO; wants moisture + acid-ish soil.)*
- Cornelian cherry (*Cornus mas*) (I) — Earliest-spring clouds of yellow flowers on bare twigs, then edible tart-red fruit; tough in alkaline clay.
- Pussy willow (*Salix discolor*) (I) — Silvery late-winter catkins — premier early bee pollen. *(US native, not CO; dioecious — buy a male; high-water wetland shrub.)*
- Apache plume (*Fallugia paradoxa*) (N) — White roses all summer, then feathery pink seedhead plumes; drought-proof and deer-resistant.
- Boulder raspberry (*Rubus deliciosus*) (N) — Boulder's namesake; thornless arching shrub with big white rose-like flowers over maple leaves. *(Fruit edible but dry/bland.)*
- Three-leaf sumac (*Rhus trilobata*) (N) — Trifoliate leaves blazing orange-red in fall; tart red "lemonade" berries. *(Sumacs family card; Edible berries — NOT poison sumac.)*
- Smooth sumac (*Rhus glabra*) (N) — The largest, smoothest native sumac; scarlet fall color and erect crimson berry cones standing through winter. *(Sumacs family card; dioecious — only females fruit; edible red berries for sumac-ade.)*
- Fragrant sumac (*Rhus aromatica*) (I) — Low mounding shrub; aromatic trilobed leaves reddening in fall, yellow twig-flowers before the leaves, fuzzy red berries. *(Sumacs family card; E/central-US native, NOT Front-Range — R. trilobata is our vicariant; edible red berries.)*
- Shrubby cinquefoil (*Dasiphora fruticosa*) (N) — Indestructible mound smothered in buttercup-yellow flowers June to frost.
- Rabbitbrush (*Ericameria nauseosa*) (N) — Silver-stemmed shrub erupting in golden fall bloom; a critical late-season pollinator plant.
- Leadplant (*Amorpha canescens*) (N) — Silvery ferny foliage and purple-and-orange flower spikes; a nitrogen-fixing prairie legume.
- Waxflower (*Jamesia americana*) (N) — Foothills cliffbush; fragrant waxy white flowers over veined leaves that redden in fall.
- Soapweed yucca (*Yucca glauca*) (N) — Evergreen blue-green sword-leaf clump throwing tall spikes of creamy bell flowers; pollinated solely by the yucca moth. *(Flowers, young fruit & seeds edible cooked; roots saponin-toxic.)*
- Hedge cotoneaster (*Cotoneaster lucidus*) (I) — The Front Range's classic tall privacy hedge: dense upright Asian shrub, glossy leaves, small black berries, fiery scarlet fall color; shears beautifully. *(Berries mildly poisonous — cyanogenic, bird-spread; fire-blight-prone rose relative.)*
- Shrubby St. John's wort (*Hypericum prolificum*) (I) — Tough, adaptable little mound smothered in bright golden powder-puff flowers all summer, then rusty seed capsules that persist through winter; a native-bee magnet. *(E/central-US native, NOT Front-Range; blooms on new wood — prune late winter. Toxic — hypericin photosensitization; NOT the weedy H. perforatum.)*

**Subshrubs**
- Mongolian Gold clematis (*Clematis fruticosa 'Mongolian Gold'*) (I) — A non-vining SHRUB clematis from the Mongolian steppe: nodding bright-yellow lantern flowers in late summer over a tidy woody clump, then silvery seed plumes; bone-dry xeric, iron cold-hardy. *(A true shrub, NOT the vining CO List-B weed C. orientalis; Pruning Group 3 — hard spring cutback; toxic — protoanemonin. Photos species-representative — see `gaps`.)*
- Ornamental oregano 'Herrenhausen' (*Origanum laevigatum 'Herrenhausen'*) (I) — Hardy xeric ornamental oregano; rose-purple flowers over dark bracts swarm with bees/butterflies late summer, foliage reddens in fall. *(Ornamental oreganos family card; edible but milder than culinary oregano.)*
- Ornamental oregano 'Kent Beauty' (*Origanum 'Kent Beauty'*) (I) — Jewel-box rock-garden hybrid grown for cascading hop-like bracts shading green to rose-pink; marginal here (~zone 5b–6, sharp drainage / trough / potted). *(Ornamental oreganos family card; photos partly parent-species-representative — see `gaps`.)*
- Apricot wallflower (*Erysimum 'Apricot Twist'*) (I) — Long-blooming perennial wallflower; flowers open apricot and age to mauve. *(photos species-representative — see `gaps`)*
- Bowles's Mauve wallflower (*Erysimum 'Bowles's Mauve'*) (I) — A grey-leaved mound smothered in fragrant mauve racemes; top early-bee plant. Short-lived (~zone 6b).
- Candytuft (*Iberis sempervirens*) (I) — A woody-based evergreen mat smothered in crisp white flower…
- Cushion spurge (*Euphorbia polychroma*) (I) — A tidy chartreuse dome that blazes red-orange in autumn.
- Lavender (*Lavandula angustifolia*) (I) — The quintessential fragrant subshrub
- Mojave sage (*Salvia pachyphylla*) (I) — Silvery aromatic mound crowned with violet flowers and…
- Pineleaf penstemon (*Penstemon pinifolius 'Mersea Yellow'*) (I) — A Southwest US native (AZ/NM) celebrated for its fine,…
- Regal geranium (*Pelargonium × domesticum*) (I) · **Tender perennial** — The showiest pelargonium: big ruffled, dark-blotched cool-season blooms.
- Russian sage (*Salvia yangii*) (I) — An airy haze of lavender-blue over silver stems
- Scented-leaf geranium (*Pelargonium graveolens*) (I) · **Tender perennial** — Grown for rose/lemon/mint-scented foliage (lovely in baking).
- Zonal geranium (*Pelargonium × hortorum*) (I) · **Tender perennial** — The classic bedding 'geranium' — bold flower balls over zoned leaves.
- Rosemary (*Salvia rosmarinus*) (I) · **Tender perennial** — Aromatic culinary evergreen; tiny blue winter flowers bees work — pot it and overwinter indoors.
- Winter heath (*Erica carnea*) (I) — Low evergreen mat sheeted in pink bells from late winter — a true cold-season bloomer. *(Not ground-hardy here; grow in an acid-mix pot.)*
- Sulphur flower buckwheat (*Eriogonum umbellatum*) (N) — Evergreen mat crowned with sulphur-yellow umbels aging to rust; a Plant Select pollinator favorite for hot, lean ground.
- Plains prickly pear (*Opuntia polyacantha*) (N) — Colorado's toughest native cactus; a low mat of flat spiny pads with silky yellow/pink blooms, shriveling purple in winter cold. *(Tunas & young pads edible once de-glochided; glochids the real hazard.)*
- Claret cup cactus (*Echinocereus triglochidiatus*) (N) — Colorado's official state cactus; a ribbed hedgehog mound erupting in scarlet hummingbird cups. *(Ripe fruit edible, despine first; demands sharp drainage — cold+wet rots it.)*

**Ornamental grasses**
- Blue oat grass (*Helictotrichon sempervirens*) (I) — A tidy steel-blue fountain of fine, arching foliage
- Little bluestem (*Schizachyrium scoparium*) (N) — Prairie bunchgrass turning mahogany-copper with fluffy…
- Blue grama (*Bouteloua gracilis*) (N) — Iconic shortgrass-prairie native with one-sided 'eyebrow' comb seedheads.
- Sideoats grama (*Bouteloua curtipendula*) (N) — Oat-like seeds dangling along one side of arching stems; orange anthers at bloom.
- Switchgrass (*Panicum virgatum*) (N) — Tall upright prairie grass; airy pink panicles, gold-to-burgundy fall, winter structure. *(Livestock photosensitization hazard — not for grazing animals.)*
- Prairie dropseed (*Sporobolus heterolepis*) (N) — Emerald fountain with coriander-scented seedheads and apricot-gold fall. *(Seeds a minor, historic grain.)*
- Indian ricegrass (*Eriocoma hymenoides*) (N) — Airy see-through seed cloud on a fine xeric clump; a staple Indigenous grain. *(Edible seeds; cool-season, needs sharp drainage.)*
- Feather reed grass (*Calamagrostis × acutiflora 'Karl Foerster'*) (I) — The classic vertical accent; sterile (never self-sows), wheat-gold plumes standing all winter.

**Groundcovers**
- Bigroot geranium (*Geranium macrorrhizum*) (I) — Aromatic semi-evergreen dry-shade groundcover; weed-proof mat, magenta spring flowers, red fall foliage. *(Drought-tolerant dry shade.)*
- Epimedium / barrenwort (*Epimedium grandiflorum*) (I) — The dry-shade champion; spurred spring 'bishop's hat' flowers over heart-shaped leaflets. *(Drought-tolerant once established.)*
- Bergenia / pigsqueak (*Bergenia cordifolia*) (I) — Bold leathery evergreen leaves bronzing in winter; early-spring pink flowers. *(Dry shade; tannin leaves a historic 'badan' tea, not a food.)*
- Bloody cranesbill (*Geranium sanguineum*) (I) — Tough, mounding hardy geranium with vivid magenta-to-crimson…
- Cheddar pinks (*Dianthus gratianopolitanus*) (I) — Intensely clove-scented, fringed pink flowers hover above a…
- Evening primrose (*Oenothera macrocarpa*) (I) — A sprawling Great Plains xeric perennial (native to…
- Garden verbena (*Glandularia canadensis 'Homestead Purple'*) (I) · **Tender perennial** — A heat-loving, drought-tolerant trailing mat that carpets…
- Hardy cranesbill (*Geranium 'Rozanne'*) (I) — The famous long-blooming hardy cranesbill
- Hardy ice plant (*Delosperma cooperi*) (I) — A Plant Select staple from South Africa
- Ivy-leaved geranium (*Pelargonium peltatum*) (I) · **Tender perennial** — The window-box spiller: glossy ivy leaves and cascading flower clusters.
- Kinnikinnick (*Arctostaphylos uva-ursi*) (N) — A tough native evergreen mat-former
- Snow-in-summer (*Cerastium tomentosum*) (I) — A silver-gray mat of woolly foliage that erupts into a froth…
- Lamb's ear (*Stachys byzantina*) (I) — Soft silver-woolly mat grown for its fuzzy tongue-shaped leaves; woolly summer spikes of pink-purple flowers. *(Xeric — overhead water/humidity rots the wool; wool carder bees harvest the fuzz.)*
- Turkish speedwell (*Veronica liwanensis*) (I) — A Plant Select standout
- Hens and chicks (*Sempervivum tectorum*) (I) — Bulletproof evergreen succulent; tight rosette "hens" pup rings of "chicks" into a mat, with a monocarpic summer flower stalk. *(Non-toxic but not a documented food; European native.)*
- Spearleaf stonecrop (*Sedum lanceolatum*) (N) — CO-native succulent mat of fleshy lance leaves that flush fire-red in drought/cold, then bright yellow star-flowers; *Parnassius smintheus* larval host. *(Caution — alkaloids/sarmentosin; not a tested food.)*
- Mexican fleabane (*Erigeron karvinskianus*) (I) — The marathon-blooming "wall daisy"; a wiry sprawling mat frothing with tiny daisies that open white and age pink-to-purple, early summer to frost. *(Borderline-hardy ~zone 6 — frost-tender here, carries on by self-sowing; xeric/sharp drainage; self-seeds prolifically and is invasive in mild climates, so deadhead & site away from wild areas.)*
- California fuchsia (*Epilobium canum*) (I) — Low grey-green xeric mat that erupts in scarlet-orange tubular trumpets late summer into fall; a premier hummingbird plant. Grown here as the cold-hardy Rocky Mountain 'Orange Carpet' form. *(SW/interior-western-US native, not Front-Range — marked Non-native; syn. Zauschneria; spreads by rhizome. Not a Fuchsia, not a food.)*

**Vines**
- 'Dropmore Scarlet' honeysuckle (*Lonicera × brownii 'Dropmore Scarlet'*) (I) — A Canadian-bred cold-hardy twining vine that puts on a…
- Climbing rose (*Rosa (climbing cultivars)*) (I) — Stiff-caned roses trained upright on a wall or trellis, many…
- Garden clematis (*Clematis × jackmanii*) (I) — Classic large-flowered climber
- Nasturtium (*Tropaeolum majus*) (I) · **Annual** — Easy peppery-edible annual; round leaves and spurred flowers that trail or climb.
- Rambling rose (*Rosa (rambling cultivars)*) (I) — Vigorous, flexible-caned roses that 'wander' over fences &…
- Trumpet honeysuckle (*Lonicera sempervirens*) (I) — A well-behaved twining climber with clusters of long…
- Sweet pea (*Lathyrus odoratus*) (I) · **Annual** — The most fragrant climbing annual; ruffled jewel-toned blooms on cool spring air. *(Toxic — seeds/pods, lathyrism; not the edible pea.)*
- Rocky Mountain clematis (*Clematis columbiana*) (N) — Native climbing clematis; nodding lavender-blue bells in spring, then silky seed plumes. *(Toxic — protoanemonin; NOT the List-B orange-peel C. orientalis.)*
- Western virgin's bower (*Clematis ligusticifolia*) (N) — Vigorous native climber; frothy white late-summer flowers then silvery 'old man's beard' seed plumes. *(Dioecious; toxic — protoanemonin.)*
- Riverbank grape (*Vitis riparia*) (N) — Tough native wild grape; lobed leaves, tart blue-black fruit for jelly, clear-yellow fall. *(Edible fruit & young leaves — beware the toxic moonseed look-alike.)*
- Woodbine (*Parthenocissus vitacea*) (N) — Native non-clinging creeper; scarlet fall color over blue berries on coral-red stalks. *(Toxic berries — oxalates; the grape look-alike that isn't edible.)*
- Garden pea (*Pisum sativum*) (I) · **Annual** — Cool-season climbing vine with white/purple flowers and fat green pods; a nitrogen-fixing kitchen-garden staple. *(Edible — shelled peas, pods & shoots; NOT the toxic sweet pea, Lathyrus.)*

**Spring forbs**
- Coral bells (*Heuchera sanguinea*) (I) — Evergreen mound of scalloped leaves under airy wands of coral-red bells; a Southwest native for dry/part shade. *(Hummingbird favorite.)*
- Starry false Solomon's seal (*Maianthemum stellatum*) (N) — Native dappled-shade groundcover; arching leafy stems, white spring stars, striped berries ripening red. *(Edible with caution — shoots cooked & a few ripe berries; berries laxative in quantity.)*
- Brunnera (*Brunnera macrophylla*) (I) — Clouds of tiny forget-me-not-blue flowers drift above…
- English primrose (*Primula vulgaris*) (I) — The classic woodland primrose; pale-yellow flowers borne singly in a crinkled-leaf rosette, one of the first blooms of spring. *(Primulas family card; wants cool moist shade — hard in our heat; edible flowers/young leaves, primin skin note.)*
- Polyanthus (*Primula × polyantha*) (I) — Bright bedding primrose; flat yellow-eyed flowers in every color, clustered on a stout stalk. *(Primulas family card; garden hybrid; cool-season, often short-lived here; edible flowers if unsprayed.)*
- Cowslip (*Primula veris*) (I) — Nodding clusters of golden, orange-flecked bells on slender stalks; the most sun-, drought- and lime-tolerant primula — the best bet here. *(Primulas family card; edible flowers & young leaves — cowslip wine/salads.)*
- Drumstick primrose (*Primula denticulata*) (I) — Spherical globes of lilac/purple/pink/white flowers on stout stalks over paddle leaves; among the earliest primulas. *(Primulas family card; Himalayan; wants cool moist humus — hard in dry alkaline clay; caution — not a food.)*
- Colorado blue columbine (*Aquilegia coerulea*) (N) — Colorado's state flower
- English wallflower (*Erysimum cheiri*) (I) · **Biennial** — The classic fragrant cottage-garden wallflower in jewel-toned spring spires.
- Garden peony (*Paeonia lactiflora*) (I) — Lavish, fragrant late-spring blooms on a clump that can…
- Grecian windflower (*Anemone blanda*) (I) — A low spring-blooming tuber that carpets the ground with…
- Horned spurge (*Euphorbia brachycera*) (N) — A low Rocky Mountain native forming spreading yellow-green mats.
- Mountain bluet (*Centaurea montana*) (I) — Fringed, almost spidery blue cornflowers on silver-felted…
- Oriental poppy (*Papaver orientale*) (I) — Enormous crepe-paper blooms with inky centers
- Pasque flower (*Pulsatilla patens*) (N) — One of the very first wildflowers of spring
- Western wallflower (*Erysimum capitatum*) (N) · **Biennial** — A tough native short-lived perennial or biennial that covers…
- Snow crocus (*Crocus tommasinianus*) (I) — The earliest, most reliable crocus; lilac cups that naturalize and feed the first bees. *(Inedible — autumn-crocus look-alike is deadly.)*
- Snowdrops (*Galanthus nivalis*) (I) — Nodding white bells through late-winter snow; among the first nectar of the year. *(Toxic.)*
- Winter aconite (*Eranthis hyemalis*) (I) — Bright yellow buttercup cups on green ruffs in late winter — one of the earliest pollen sources. *(Toxic.)*
- Dwarf iris (*Iris reticulata*) (I) — Jewel-blue dwarf bulb iris that flowers at snowmelt; thrives on our dry-summer dormancy. *(Toxic.)*
- Christmas rose (*Helleborus niger*) (I) — Leathery evergreen perennial whose white cups open in the dead of winter — rare midwinter bee forage. *(Toxic; sap irritant.)*
- Sweet alyssum (*Lobularia maritima*) (I) · **Annual** — Low honey-scented carpet from spring to frost; a magnet for bees, hoverflies & beneficials.
- Pansy (*Viola × wittrockiana*) (I) · **Annual** — Cheerful cool-season faces that bloom through frost; edible flowers, easy potted colour for warm-day bees.
- Rocky Mountain iris (*Iris missouriensis*) (N) — Colorado's wild blue flag; lavender, purple-veined irises from grassy fans in wet mountain meadows. *(Toxic rhizome; wants spring moisture.)*
- Bearded iris (*Iris × germanica*) (I) — The classic dooryard iris; ruffled bearded blooms over sword foliage, thriving on heat, sun & lean clay. *(Toxic rhizome; plant rhizome at the surface.)*
- Garden tulip (*Tulipa gesneriana*) (I) — Bold goblets in every colour; spectacular year one, but big hybrids often run short-lived on the dry Front Range. *(Toxic bulb.)*
- Species tulip (*Tulipa tarda*) (I) — Little wild tulips that actually come back; starry yellow-and-white flowers that naturalize in our dry-summer climate. *(Toxic bulb.)*
- Daffodil (*Narcissus*) (I) — The most dependable spring bulb here; sunny trumpets that multiply into drifts and, being toxic, are ignored by deer & voles. *(Toxic, all parts.)*
- Dutch crocus (*Crocus vernus*) (I) — The big, bold spring crocus; plump purple/white/feathered goblets naturalizing into lawns to feed early bees. *(Inedible — deadly Colchicum look-alike.)*
- Prairie smoke (*Geum triflorum*) (N) — Nodding dusky-pink bells in spring, then spectacular smoky feathered seedhead plumes over a fern-leaved mat.
- Golden banner (*Thermopsis divaricarpa*) (N) — Bright lupine-like spikes of golden pea flowers over blue-green trifoliate foliage; spreads into bold drifts. *(Toxic — alkaloids in foliage/seeds.)*

**Summer forbs**
- Purple mullein (*Verbascum phoeniceum*) (I) — Hardy xeric mullein; slender spires of flat purple/rose/white saucer flowers with fuzzy stamens over dark crinkled rosettes. *(Mulleins family card; NOT the weedy V. thapsus/blattaria.)*
- Nettle-leaved mullein (*Verbascum chaixii*) (I) — The sturdiest, longest-lived mullein; spikes of small yellow (or white 'Album') flowers with woolly purple-stamen eyes over nettle-like foliage. *(Mulleins family card.)*
- Giant silver mullein (*Verbascum bombyciferum*) (I) · **Biennial** — Architectural: a white-felted silver rosette year one, then a towering 5–6 ft yellow candelabra spire. *(Mulleins family card; self-sows — deadhead to manage.)*
- Garden hybrid mullein (*Verbascum* 'Southern Charm' & kin) (I) — Showy pastel saucer flowers (apricot/buff/pink/lilac/cream) with purple-stamen eyes on branching spikes; short-lived. *(Mulleins family card; root cuttings to keep named hybrids true.)*
- Hollyhock (*Alcea rosea*) (I) · **Biennial** — Towering cottage spires of saucer flowers in white through deep maroon; a classic dooryard plant bees and hummingbirds work. *(Mallow-family edible flowers & young leaves; hollyhock rust is the signature pest.)*
- Arugula (*Eruca vesicaria*) (I) · **Annual** — Cool-season salad green with lobed leaves and creamy purple-veined flowers; bolts in heat, self-sows. *(Edible peppery leaves, flowers & pods; flea beetles the #1 pest.)*
- Red hot poker (*Kniphofia uvaria*) (I) — South-African torch lily: grassy clumps throwing bicolor red-to-yellow flower spikes hummingbirds and bees mob. *(Zone-borderline — needs sharp drainage; tie foliage over the crown for winter.)*
- Foxglove beardtongue (*Penstemon digitalis*) (I) — Eastern-prairie native (cultivars 'Husker Red'/'Dark Towers'); tall white tubular wands over dark-flushed foliage, a native-bee magnet. *(Penstemons family card; far more clay/moisture-tolerant than the xeric Western penstemons.)*
- Parry's primrose (*Primula parryi*) (N) — Colorado's showiest alpine primrose; magenta golden-eyed flowers over big paddle leaves along 10,000–12,000 ft snowmelt streams. *(Primulas family card; a true high-alpine specialist — very hard in lowland heat; famously skunky; inedible.)*
- Showy milkweed (*Asclepias speciosa*) (N) — THE monarch host; domes of rose-pink stars, then silky-floss pods. The top plant for monarchs here. *(Spreads by rhizome; toxic raw — young parts edible only cooked.)*
- Butterfly milkweed (*Asclepias tuberosa*) (N) — Blazing flat orange clusters on a tidy non-spreading taproot clump; monarch host. *(Toxic — grown as a pollinator plant, not food.)*
- Swamp milkweed (*Asclepias incarnata*) (N) — The wetland monarch host; rose-pink flower domes over willow-like leaves, a well-behaved single-crown clump. *(The moisture-lover — wants moist/wet soil, NOT xeric; caution — toxic raw, not advertised as food.)*
- Whorled milkweed (*Asclepias verticillata*) (I) — Fine threadlike leaves in whorls; greenish-white umbels in late summer, xeric and tough. *(E/central-US native, NOT Colorado — our native is A. subverticillata; toxic — one of the most livestock-toxic milkweeds.)*
- Purple prairie clover (*Dalea purpurea*) (N) — Rose-purple thimbles over ferny foliage; a nitrogen-fixing legume and native-bee keystone. *(Leaves for tea; sweet roots chewed.)*
- Hairy golden aster (*Heterotheca villosa*) (N) — Low silvery-hairy mound of golden daisies midsummer to frost; a specialist-bee keystone (~50 bee spp).
- False sunflower (*Heliopsis helianthoides*) (N) — Long-blooming golden daisies (golden centers) early summer to frost; sturdy and bee-friendly.
- Curlycup gumweed (*Grindelia squarrosa*) (N) · **Biennial** — Yellow daisies in sticky curled-back bracts; the region's #2 specialist-bee plant (~68 bee spp). A self-sowing xeric pioneer. *(Not a food; resin was medicinal.)*
- Acanthus (*Acanthus mollis*) (I) — Architectural 'bear's breeches': huge glossy leaves and hooded white-&-purple flower spikes. Tender (~zone 7).
- Aspen fleabane (*Erigeron speciosus*) (N) — A native daisy
- Blanket flower (*Gaillardia aristata*) (N) — Bold red-and-gold daisies that blaze from early summer…
- Blue flax (*Linum lewisii*) (N) — Sky-blue, tissue-paper flowers open at sunrise and drop by noon
- California poppy (*Eschscholzia californica*) (I) · **Annual** — Silky orange cups over blue-green lace
- Coreopsis (*Coreopsis grandiflora 'Early Sunrise'*) (I) — A cheerful, easy-going golden daisy (semi-double in 'Early…
- Cosmos (*Cosmos bipinnatus*) (I) · **Annual** — Airy, daisy-like blooms on ferny stems
- Dahlia (*Dahlia × hortensis*) (I) · **Tender perennial** — Tender tubers that explode into bold, geometric blooms from…
- Garden lupine (*Lupinus polyphyllus (Russell hybrids)*) (I) — Showy Russell-hybrid spires in every color from white to…
- Garden phlox (*Phlox paniculata*) (I) — Stately, sweetly fragrant domed panicles in pink, white, or…
- German chamomile (*Matricaria chamomilla*) (I) · **Annual** — The apple-scented tea chamomile
- Knautia (*Knautia macedonica*) (I) — Wiry, branching stems carry wine-red pincushion flowers from…
- Larkspur (*Consolida ajacis*) (I) · **Annual** — A cool-season cottage-garden classic with tall airy spires…
- Pincushion flower (*Scabiosa columbaria*) (I) — A non-stop bloomer
- Red valerian (*Centranthus ruber*) (I) — Jupiter's beard
- Rocky Mountain bee plant (*Cleomella serrulata*) (N) · **Annual** — Colorado-native prairie annual
- Salvia (meadow sage) (*Salvia nemorosa*) (I) — Upright wands of violet-blue in early summer
- Scarlet bee balm (*Monarda didyma*) (I) — The classic fire-engine-red bee balm (eastern-US native)
- Shasta daisy (*Leucanthemum × superbum*) (I) — The classic, well-behaved white daisy
- Silvery lupine (*Lupinus argenteus*) (N) — Colorado's most common native lupine
- Snapdragon (*Antirrhinum majus*) (I) · **Annual** — Jewel-toned 'snapping' flower spikes kids love
- Snow-on-the-mountain (*Euphorbia marginata*) (N) · **Annual** — Upright annual frosted with white-margined leaves and bracts…
- Spike speedwell (*Veronica spicata*) (I) — Upright candlestick spikes of starry flowers (lead form:…
- Wild bergamot (*Monarda fistulosa*) (N) — Colorado-native bee balm
- Yellow yarrow (*Achillea 'Moonshine'*) (I) — A tough, silvery-leaved garden hybrid with flat-topped…
- Sunflower (*Helianthus annuus*) (N) · **Annual** — Colorado's own wild sunflower; branching golden, dark-eyed heads bees mob and goldfinches strip for seed. *(Edible seeds.)*
- Nodding onion (*Allium cernuum*) (N) — A dainty native onion whose stalk crooks so its umbel of pink bells nods to the ground; bee-covered in midsummer. *(Edible — but deadly death-camas look-alike; smell for onion.)*
- Desert marigold (*Baileya multiradiata*) (I) — Woolly silver mound throwing long-stemmed lemon daisies for months in the hottest, leanest ground. *(SW-US native, not CO; toxic to livestock.)*
- Black-eyed Susan (*Rudbeckia hirta*) (I) — Golden petals around a chocolate cone for months, seeding into easy drifts bees & goldfinches love. *(E/central-N.A. native, not Front-Range; mild caution.)*
- Marigold (*Tagetes patula*) (I) · **Annual** — Bulletproof bedding annual; ferny aromatic foliage under ruffled yellow-to-mahogany blooms all summer. *(Marigolds family card; edible petals.)*
- African marigold (*Tagetes erecta*) (I) · **Annual** — Tall marigold with big globular yellow-orange pompoms; the Día-de-los-Muertos flower. *(Marigolds family card; edible petals — saffron-substitute colour/flavour.)*
- Signet marigold (*Tagetes tenuifolia*) (I) · **Annual** — Compact lacy-leaved mound smothered in small single flowers; the best-flavoured culinary marigold. *(Marigolds family card; citrus-flavoured edible flowers & leaves.)*
- Mexican mint marigold (*Tagetes lucida*) (I) · **Tender perennial** — Smooth anise-scented leaves used as a heat-proof tarragon substitute; golden flowers in fall. *(Marigolds family card; Texas/Spanish tarragon — edible leaves & flowers; frost-killed here, blooms Fall.)*
- Nigella / love-in-a-mist (*Nigella damascena*) (I) · **Annual** — Sky-blue flowers in a haze of thread-fine foliage, then inflated horned 'balloon' seedpods for drying. *(Caution — ornamental, not culinary N. sativa.)*
- Bachelor's button (*Centaurea cyanus*) (I) · **Annual** — True-blue fringed buttons on wiry stems; easy cool-season reseeder that draws bees. *(Edible petals; NOT a knapweed/weed.)*
- Amaranth / love-lies-bleeding (*Amaranthus caudatus*) (I) · **Annual** — Tall stems draped in drooping crimson ropes; a dramatic ancient grain that's also an edible green. *(Edible grain & cooked leaves.)*
- Celosia (*Celosia argentea*) (I) · **Annual** — Velvety flame plumes and brain-folded combs in electric reds & golds that shrug off Front Range heat. *(Caution — young leaves cooked.)*
- Strawflower (*Xerochrysum bracteatum*) (I) · **Annual** — Stiff papery 'everlasting' bracts that dry perfectly for winter arrangements. *(Inedible; reel is yellow species form — see `gaps`.)*
- Calendula / pot marigold (*Calendula officinalis*) (I) · **Annual** — The true edible pot marigold; cheerful daisies blooming hardest in cool spring & fall. *(Edible petals.)*
- Ornamental allium (*Allium hollandicum*) (I) — Giant lollipop globes of starry purple on bare stems; a bee magnet deer & voles leave alone. *(Caution — oniony; all alliums toxic to pets.)*
- Gladiolus (*Gladiolus × hortulanus*) (I) · **Tender perennial** — Sword-leaved spikes of ruffled trumpets, grown from corms lifted & stored over winter like dahlias. *(Toxic corms.)*
- Rocky Mountain penstemon (*Penstemon strictus*) (N) — Colorado's most dependable native penstemon; dense wands of deep blue-violet flowers over glossy strap leaves. *(Penstemons family card.)*
- Scarlet bugler penstemon (*Penstemon barbatus*) (N) — Tall airy wands of brilliant scarlet tubular flowers; a hummingbird favorite. *(Penstemons family card.)*
- Bluemist penstemon (*Penstemon virens*) (N) — Low Front Range foothills native; evergreen rosettes throwing clouds of blue-violet flowers. *(Penstemons family card.)*
- Prairie coneflower (*Ratibida columnifera*) (N) · *Mexican hat* — Drooping yellow (or mahogany-banded) petals around a tall sombrero cone; easy and long-blooming.
- Scarlet globemallow (*Sphaeralcea coccinea*) (N) — Apricot-scarlet cups on a silvery low mat; bone-dry tough. *(Leaf hairs irritate eyes — 'sore-eye poppy'.)*
- Prairie zinnia (*Zinnia grandiflora*) (N) — Fine-leaved cushion smothered in golden papery daisies midsummer to frost; a Plant Select-tough groundcover.
- Martagon lily (*Lilium martagon*) (I) — Tall woodland-edge true lily; a single stem hung with up to 30 nodding, fully recurved 'Turk's cap' flowers, rosy-pink freckled maroon, over whorled leaves. *(Part-shade, moist humus-rich soil — not xeric; tolerates alkaline clay, so one of the better lilies here; DEADLY to cats like all true lilies.)*
- Himalayan blue poppy (*Meconopsis betonicifolia*) (I) — The legendary sky-blue Himalayan poppy; satiny azure chalices with an orange stamen boss over bristly foliage. *(Kept-but-flagged like winter heath: cold-hardy here but hates our heat/dry air/alkaline clay — grow it potted in acidic mix, cool shade, constantly moist. Inedible — poppy-family alkaloids.)*

**Fall forbs**
- Tansyaster (*Dieteria bigelovii*) (N) · **Biennial** — Big lavender, gold-eyed daisies on branching stems into fall; a self-sowing xeric native and late-season specialist-bee plant.
- Japanese anemone (*Anemone × hybrida*) (I) — Tall, wiry-stemmed perennial that lights up the late-summer…
- Panicled aster (*Symphyotrichum lanceolatum*) (N) — A tall, willow-leaved native aster that erupts in sprays of…
- White heath aster (*Symphyotrichum ericoides*) (N) — In late summer the wiry stems of this tough prairie native…
- White prairie aster (*Symphyotrichum falcatum*) (N) — A low, compact native aster that smothers itself in small…
- Dotted gayfeather (*Liatris punctata*) (N) — Stiff stems crowded with rosy-purple bottlebrush spikes in late summer; a butterfly magnet with a deep drought-proof taproot.
- Showy goldenrod (*Solidago speciosa*) (N) — The well-behaved (clumping, non-running) native goldenrod; golden club-shaped plumes and a keystone fall pollinator. *(Not the cause of hay fever.)*
- Maximilian sunflower (*Helianthus maximiliani*) (N) — A towering 6–10 ft prairie sunflower lined with golden flowers in fall; bees and goldfinches mob it. *(Edible seeds & cooked tubers.)*
- Showy goldeneye (*Heliomeris multiflora*) (N) — An airy xeric daisy hazed with small golden suns from midsummer to hard frost; one of the longest bloomers. *(Not deer-resistant.)*
- Aromatic aster (*Symphyotrichum oblongifolium*) (N) — One of the last to bloom: a tidy aromatic mound sheeted in lavender-blue daisies in October. *(Asters family card.)*

**Dropped from the keep-list (do not re-add):** coyote willow (*Salix exigua*) and
Turkish cliff sage (*Salvia recognita*). Mojave sage is preferred over Turkish cliff
sage.

**Ruled out — evaluated and intentionally NOT added (don't re-propose):** plants we
looked at and decided against, with the reason, so they aren't re-pitched every roster
pass. Re-add only if the stated reason no longer holds.

- **Ranunculus / Persian buttercup (*Ranunculus asiaticus*)** — too marginal on the Front
  Range to thrive. It's a cool-season Mediterranean tuber that needs mild winters and cool,
  dry springs; here it sulks and stalls in the hot, dry May–June heat that arrives just as it
  should bloom, the tubers are very prone to rot in our soils, and they're not winter-hardy
  (must be lifted/treated as a fussy cool-season annual). Doable only with fuss and poor
  reliability, so it fails the "thrives in some capacity" bar. (Note: weedy *Ranunculus
  repens*, creeping buttercup, is a separate avoid-entirely.)

## Open work

The current backlog. Move items out of this section as they ship.

- **Accounts & favourites — code DONE, awaiting Supabase setup.** The full feature ships in
  `auth.js`/`config.js`/`privacy.html` + the page wiring (see "Accounts & favourites (Supabase)").
  It stays hidden until the owner does the one-time Supabase setup in **`SETUP_ACCOUNTS.md`** and
  pastes the project URL + anon key into `config.js`. Until then the live site is unchanged. Once
  configured, the next natural extensions (the API was built for them): grouping favourites into
  named lists/gardens, notes per plant, a "plant journal."

- **Photo reels (DONE — see `IMAGE_AUDIT.md`):** every plant was audited against the 8-axis
  rubric and re-sourced to **excellent** wherever an open-licensed shot exists. Final state:
  **54 excellent · 14 effectively-excellent · 0 fixable gaps** — all 68 at best-possible. The 14
  carry only an unfillable/structural cap, each logged with its reason in `IMAGE_AUDIT.md` (e.g.
  no-CC-winter blue-oat-grass; spike/whorl `front_facing` on lavender/russian-sage/garden-lupine;
  no open-licensed *yellow* 'Mersea Yellow' pineleaf-penstemon habit/macro; no CC fat pre-split
  silvery-lupine pod). `IMAGE_AUDIT.json` is the per-plant scorecard. If a better open-licensed
  shot for a capped axis ever surfaces, re-query the iNat API (the fast path above) and append it
  with `gbif_add.py`. (Watch the *Veronica liwanensis* look-alike: only pick shots verifiable as
  the tiny-glossy-leaved tight mat, not the coarse-leaved *V. persica*.)
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
- **`Read` the *picks*, not just the montage** — auto-reject pressed/herbarium specimens,
  hand-dominated twig shots, wall/indoor backgrounds, pavement/litter settings, and subjects lost in
  grass; trust the pixels over a sub-agent's caption (see "Pick QC"). QC via a picks-only preview
  sheet you `Read` yourself.
- The card `water` field is a short practical **directive** (xeric → "no supplemental water once
  established"; water-hog → "not for dry zones"), with detail in `care.water`. Treat water demand as
  a Boulder happiness check, not an afterthought.
- Weed-check every new plant against CO lists A/B/C + Watch before it goes in.
- `care` facts are sourced like photos: ground them in a trusted authority, list the real
  sources in `care_src`, then run the citation-honesty + fact-check passes (see "Sourcing
  care facts"). No uncited hard numbers; no dead/blog citations. **Run
  `python3 tools/check_citations.py` after any `care_src` change** — it catches dead links and
  URLs that resolve to the wrong plant, and fails if a plant has no reachable source.
- Build + `Read` a picks-only preview to QC the photos before creating the plant file (catches
  bad picks); user sign-off is not required.
- A new plant = one `plant.json` + one `manifest.json` line (not a big array edit).
- After any `finalize.py`/`commons_finalize.py`, run `rethumb.py` so the card thumbs are
  720×480 smart-crops, not the provisional 400px ones.
- **After ANY change to a `plant.json`, `manifest.json`, or `collections.json`, regenerate the grid
  bundle: `python3 tools/build_bundle.py`, and commit the refreshed `plants/bundle.json` in the same
  commit.** The grid loads that one file (with a per-file fallback), so a stale bundle would show
  stale data on the live grid. Guard with `python3 tools/build_bundle.py --check` (nonzero = stale).
  The per-plant `plant.json` stays the source of truth; never hand-edit `bundle.json`.
- Vanilla HTML/CSS/JS, no framework/webpack build, no deps — keep it that way. (`build_bundle.py` is a
  simple committed-data generator like `manifest.json`, not a build toolchain — it stays.)
- Preview locally over `http.server` (fetch won't work from `file://`).
- **Ship by merging to `main`.** Finished, validated, pushed work gets a PR squash-merged into
  `main` (Pages deploys from `main`) — that's the default last step, not an optional one. Don't
  leave completed work sitting on a feature branch (see "How deploys work").
