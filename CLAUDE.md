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

## Architecture

The site is a few plain files plus a tree of per-plant data:

```
index.html              # encyclopedia grid shell: markup only; links styles.css + reel.js + app.js
plant.html              # standalone per-plant detail page shell; links styles.css + reel.js + plant.js
styles.css              # all styling (grid + detail page)
reel.js                 # SHARED engine: shot resolution, the seasonal reel, the zoom/swipe
                        #   lightbox, and the TRAITS predicates/badges. Loaded first on both pages.
app.js                  # grid behaviour (render cards, filters, search, loader)
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
images resolve), then `render()`. `SEED` order doesn't matter — the app sorts by botanical name and groups by
**morphology** via `groupOf(p)` (growth form; forbs split by `bloom_season`). The on-disk
`plants/<category>/` folder is just a storage path (and the `dir` for image resolution) — it
is **NOT** the grouping. A file can live in `plants/perennials/` yet be a `Groundcover` or
`Forb`; don't move files to re-group (it'd break `dir`/manifest), just set `type`.

**`plant.json` schema** (confirm exact shape in any file; `index.html` / a real
`plant.json` is the source of truth):

- The card fields: `common, botanical, type, lifecycle, native, blurb, size, sun, water,
  spread, seasons, wildlife, deer, toxic, winter, verified` (+ `bloom_season` for forbs;
  + `origin` and `habitat` on **non-native** plants).
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
  `{"size":[1,2],"toxic":[1,3]}`. Keys: `size, sun, water, spread, seasons, wildlife, deer, toxic`
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
  actually eat — that flag (not `level`) drives the grid's **Edible** trait badge/filter, so set it
  on the `edible` plants and the genuinely-edible `caution` ones (chokecherry, Oregon grape, Wood's
  rose, kinnikinnick, blue flax, columbine, dahlia, yarrow), but NOT the "don't eat" cautions.
  When `food:true`, also add **`card`** — a *short, citation-free* phrase naming the edible part(s)
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
Cards are grouped by morphology (collapsible) with an A–Z toggle, a search box, and a
per-season photo strip you flip with the season dots
(the strip is deliberately *not* finger-swipeable — see the tap-vs-swipe note). The card
shows a small thumbnail; clicking (or `Enter`/`Space` on it — the photos are keyboard-focusable)
opens the full-size image in a pinch/scroll zoom lightbox. The lightbox is a **swipeable
gallery**: it loads the whole reel, so swipe left/right, arrow keys, or the on-screen
`‹ ›` buttons step through that plant's full-size photos (with an "n / m" counter; nav
hides for single-photo plants and at the ends).
**Photos must be real CC-licensed photographs — no illustrations.** (See "Image
requirements & sourcing" below for the per-plant photo spec.)

**Filtering & state.** Four filter axes compose: **Origin** (Both/Native/Introduced),
**Form** chips (the morphology groups, with counts), **Lifecycle** chips
(`Perennial`/`Tender perennial`/`Biennial`/`Annual`, from each plant's `lifecycle` tag), and
**Trait** chips (`Winter`/`Pollinator`/`Spreads`/`Edible`/`Toxic`), plus the free-text search. The
trait predicates live in one place — the `TRAITS` map in `reel.js` — shared by *both* the card
badges and the trait filter (and auto-built chips with counts) so they never drift; add a new trait
by extending that map (`flagsHTML` also pushes the badge). The **`Edible`** trait flags plants with
a genuine edible part — its predicate is the explicit `edible.food === true` marker (NOT the
`edible.level`), so a "partly edible" plant like chokecherry (fruit edible, rest toxic) carries
*both* the Edible and Toxic badges, while a `caution`/`inedible` plant that's really "don't eat"
(california poppy, peony, red-twig dogwood) is left untagged. Set `edible.food:true` on a plant when
it has a part people actually eat. The legend always reads "Showing N of M plants" and shows a **Clear
all** button when anything is active. Filter/search/view state is mirrored into the **URL hash**
(`#view=…&nat=…&type=…&life=…&trait=…&q=…`) via `syncHash()`/`applyHash()`, so filtered views are
shareable and survive a reload.

### Adding a trait

A "trait" is a single boolean fact about a plant (Winter / Pollinator / Spreads / Edible / Toxic)
that shows as a **card+sheet badge** *and* a **filter chip with a count** — both driven off one
predicate so they can't drift. To add one (e.g. `Fragrant`):

1. **Add one entry to the `TRAITS` map in `reel.js`** — `key:{ label, icon, test:function(p){…} }`.
   The `test(p)` predicate is the whole definition of who qualifies; base it on existing data
   (regex a field, e.g. `/fragran|scent/i.test(p.blurb||'')`) or on an explicit per-plant marker
   (like the `Edible` trait's `edible.food === true`). Prefer an explicit marker when "who
   qualifies" is a judgment call rather than something cleanly derivable from a field.
2. **Push the badge in `flagsHTML` (`reel.js`)** —
   `if(TRAITS.key.test(p)) flags.push('<span class="flag CLASS">ICON Label</span>');` (the map's
   `test` is the gate; the badge text/icon lives here).
3. **Add a `.flag.CLASS` colour rule in `styles.css`** next to the other `.flag.*` rules.
4. **That's it for wiring.** `app.js` never hard-codes trait names: `buildTraitChips()` iterates
   `Object.keys(TRAITS)` (auto-creating the chip + live count), `passesFilters()` tests
   `TRAITS[t].test(p)`, and the `trait=` URL-hash round-trip + Clear-all already cover any key in
   the map. The one-line comment listing trait values at the top of `app.js` is the only manual
   touch (cosmetic).
5. **If the predicate reads a new data field, populate it** on the qualifying `plant.json`s (and
   document the field in the "`plant.json` schema" list). Then sanity-check the count.

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

## The plant card fields

Every plant records:

- **Growth form** (`type`: tree / shrub / subshrub / grass / vine / groundcover / forb) and,
  for forbs, **primary bloom season** (`bloom_season`) — these set the grid grouping.
- **Lifecycle** tag (`lifecycle`: perennial / annual / biennial / tender perennial)
- **Mature size** (Height × Width)
- **Sun** requirement
- **Water** requirement
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
4. **Show the user the image(s) and the blurb in chat for sign-off first.** Don't
   create the plant file until the visual + blurb are approved.
5. **After approval,** create `plants/<category>/<slug>/plant.json` (with a `shots`
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

**Per-plant photo goal — the reel should let a viewer *understand the plant*.** Two shots
is the floor, but cover these **shot types** (3–5 where the plant warrants it), because a
single flower close-up + one habit shot usually isn't enough to know a plant:

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

**85 specimens**, all verified non-weed in CO and all carrying a full `care` block (incl.
`planting` + `propagation`) **and a repo-hosted photo reel** (close-up + structure, seasonal
where good shots exist). Every plant's detail page is now **fully cited** — a numbered
`references` bibliography with inline `[n]` markers on the facts table (`fact_src`), the care
prose, and a safety-reviewed **`edible` block** (current split: 37 inedible · 21 caution · 16
edible · 11 toxic). Every **non-native** plant (62 of the 85) also carries **provenance** —
`origin` (where it's from) + `habitat` (its wild growing conditions) — shown as blue "Native
to" / "Wild habitat" rows on its card and detail page, cited via `fact_src`. Grouped by type
below (the order the site uses). Photos were sourced
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
(N) = CO/regional native, (I) = introduced/vetted.

**Trees**
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

**Shrubs**
- Common lilac (*Syringa vulgaris*) (I) — Old-fashioned dooryard shrub prized for plumes of intensely…
- Creeping Oregon grape (*Berberis repens*) (N) — A low, stoloniferous native evergreen with holly-like leaves…
- Mock orange (*Philadelphus lewisii*) (N) — One of the most powerfully fragrant native shrubs on the…
- Red-twig dogwood (*Cornus sericea*) (N) — The classic winter shrub
- Smoke tree (*Cotinus coggygria*) (I) — A large, dramatic shrub famed for billowing clouds of…
- Twinberry honeysuckle (*Lonicera involucrata*) (N) — A bold native riparian shrub
- Wood's rose (*Rosa woodsii*) (N) — Fragrant pink wild rose with red hips that hang on all winter.

**Subshrubs**
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

**Ornamental grasses**
- Blue oat grass (*Helictotrichon sempervirens*) (I) — A tidy steel-blue fountain of fine, arching foliage
- Little bluestem (*Schizachyrium scoparium*) (N) — Prairie bunchgrass turning mahogany-copper with fluffy…

**Groundcovers**
- Bloody cranesbill (*Geranium sanguineum*) (I) — Tough, mounding hardy geranium with vivid magenta-to-crimson…
- Cheddar pinks (*Dianthus gratianopolitanus*) (I) — Intensely clove-scented, fringed pink flowers hover above a…
- Evening primrose (*Oenothera macrocarpa*) (I) — A sprawling Great Plains xeric perennial (native to…
- Garden verbena (*Glandularia canadensis 'Homestead Purple'*) (I) · **Tender perennial** — A heat-loving, drought-tolerant trailing mat that carpets…
- Hardy cranesbill (*Geranium 'Rozanne'*) (I) — The famous long-blooming hardy cranesbill
- Hardy ice plant (*Delosperma cooperi*) (I) — A Plant Select staple from South Africa
- Ivy-leaved geranium (*Pelargonium peltatum*) (I) · **Tender perennial** — The window-box spiller: glossy ivy leaves and cascading flower clusters.
- Kinnikinnick (*Arctostaphylos uva-ursi*) (N) — A tough native evergreen mat-former
- Snow-in-summer (*Cerastium tomentosum*) (I) — A silver-gray mat of woolly foliage that erupts into a froth…
- Turkish speedwell (*Veronica liwanensis*) (I) — A Plant Select standout

**Vines**
- 'Dropmore Scarlet' honeysuckle (*Lonicera × brownii 'Dropmore Scarlet'*) (I) — A Canadian-bred cold-hardy twining vine that puts on a…
- Climbing rose (*Rosa (climbing cultivars)*) (I) — Stiff-caned roses trained upright on a wall or trellis, many…
- Garden clematis (*Clematis × jackmanii*) (I) — Classic large-flowered climber
- Nasturtium (*Tropaeolum majus*) (I) · **Annual** — Easy peppery-edible annual; round leaves and spurred flowers that trail or climb.
- Rambling rose (*Rosa (rambling cultivars)*) (I) — Vigorous, flexible-caned roses that 'wander' over fences &…
- Trumpet honeysuckle (*Lonicera sempervirens*) (I) — A well-behaved twining climber with clusters of long…

**Spring forbs**
- Brunnera (*Brunnera macrophylla*) (I) — Clouds of tiny forget-me-not-blue flowers drift above…
- Colorado blue columbine (*Aquilegia coerulea*) (N) — Colorado's state flower
- English wallflower (*Erysimum cheiri*) (I) · **Biennial** — The classic fragrant cottage-garden wallflower in jewel-toned spring spires.
- Garden peony (*Paeonia lactiflora*) (I) — Lavish, fragrant late-spring blooms on a clump that can…
- Grecian windflower (*Anemone blanda*) (I) — A low spring-blooming tuber that carpets the ground with…
- Horned spurge (*Euphorbia brachycera*) (N) — A low Rocky Mountain native forming spreading yellow-green mats.
- Mountain bluet (*Centaurea montana*) (I) — Fringed, almost spidery blue cornflowers on silver-felted…
- Oriental poppy (*Papaver orientale*) (I) — Enormous crepe-paper blooms with inky centers
- Pasque flower (*Pulsatilla patens*) (N) — One of the very first wildflowers of spring
- Western wallflower (*Erysimum capitatum*) (N) · **Biennial** — A tough native short-lived perennial or biennial that covers…

**Summer forbs**
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

**Fall forbs**
- Japanese anemone (*Anemone × hybrida*) (I) — Tall, wiry-stemmed perennial that lights up the late-summer…
- Panicled aster (*Symphyotrichum lanceolatum*) (N) — A tall, willow-leaved native aster that erupts in sprays of…
- White heath aster (*Symphyotrichum ericoides*) (N) — In late summer the wiry stems of this tough prairie native…
- White prairie aster (*Symphyotrichum falcatum*) (N) — A low, compact native aster that smothers itself in small…

**Dropped from the keep-list (do not re-add):** coyote willow (*Salix exigua*) and
Turkish cliff sage (*Salvia recognita*). Mojave sage is preferred over Turkish cliff
sage.

## Open work

The current backlog. Move items out of this section as they ship.

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
- **Ship by merging to `main`.** Finished, validated, pushed work gets a PR squash-merged into
  `main` (Pages deploys from `main`) — that's the default last step, not an optional one. Don't
  leave completed work sitting on a feature branch (see "How deploys work").
