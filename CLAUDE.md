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

The repo is cloned locally, so deploys are just git:

1. Edit the relevant file(s) — `index.html`, `styles.css`, `app.js`, or a
   `plants/.../plant.json`.
2. `git add -A && git commit && git push`.
3. GitHub Pages redeploys automatically; changes go live in a minute or two.

**Local preview:** because the page `fetch()`es the plant data, you can't just
double-click `index.html` — `file://` blocks fetch. Serve it instead:

```
python3 -m http.server 8000   # then open http://localhost:8000/
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
    images/             # repo-hosted photos for this plant (mostly empty for now)
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
- `commons:'File.jpg'` — the primary photo (a Commons filename). May be `""`.
- `shots:[…]` *(optional)* — an ordered seasonal reel. Each entry is
  `{ commons | url | local | try:[a,b], s?:'spring'|'summer'|'fall'|'winter', cap? }`.
  `try:[…]` lists fallback Commons filenames; `local:'images/foo.jpg'` is a
  repo-hosted file (resolved against the plant's `dir`).

**Image resolution** (`shotsFor` → `shotCandidates`): per shot, candidates are tried
in order **local → try[] → url → commons**, each Commons name going through
`Special:FilePath`. The `<img onerror>` handler (`__imgnext`) walks to the next
candidate, and falls back to a "coming soon"/"unavailable" placeholder. A plant with
no `shots` falls back to `commons`, then `photo`. **This means downloading images
later is non-breaking:** drop a file in the plant's `images/`, add `local:` to the
shot, and it's preferred while Commons stays as the fallback.

### UI features

Cards grouped by plant type (collapsible) with an A–Z toggle, a search box, a
weed-gated "add plant" form, and a swipeable per-season photo strip. **Photos must
be real Wikimedia Commons images — no illustrations.**

### Known reel gotcha (already fixed — don't regress)

The per-season tab is derived from the reel's scroll position. It needs the index
clamped, **plus** a recompute ~150ms after scroll settles **plus** a `scrollend`
listener. Without all three, the tab deselects on the last panel or mis-highlights
while swiping.

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
3. **Find a real Wikimedia Commons photo** (see image rules below).
4. **Show the user the image(s) and the blurb in chat for sign-off first.** Don't
   create the plant file until the visual + blurb are approved.
5. **After approval,** create `plants/<category>/<slug>/plant.json` (with a `shots`
   array if you have multiple seasonal photos), add its `"<category>/<slug>"` path to
   `plants/manifest.json`, then commit and push. Category folder follows `groupOf()`
   (trees, shrubs, subshrubs, grasses, perennials, annuals, vines); slug is the
   common name lowercased and hyphenated. No giant array to edit anymore — one new
   file plus one manifest line.

## Image sourcing rules

- Use real **CC-licensed Wikimedia Commons** photos via `Special:FilePath`.
- Prefer finding/verifying the exact `File:Name.jpg` title yourself. In Claude Code
  with network access you may be able to browse Commons directly — if so, confirm
  the file resolves before wiring it in.
- To avoid look-alikes, search the **species-specific subcategory** (e.g.
  `Category:Alnus incana subsp. tenuifolia`) and `Special:MediaSearch`.
- **Never hotlink copyrighted nursery/blog photos**, and never bake in guessed or
  unverified URLs.
- **Fallback:** if you can't verify an image, the user can paste a Commons
  `File:Name.jpg` title (or link) and you wire it in. The exact title is all you need.
- `shots` entries accept `try:[a, b]` so you can list fallback filenames per season.
- **Repo-hosted images:** to self-host (rather than live-load from Commons), drop the
  file in the plant's `images/` folder and add `local:'images/name.jpg'` to the shot.
  Local is tried first; keep the `commons:`/`try:` title on the same shot as a fallback.
  Still use CC-licensed Commons originals — keep attribution in the `cap`/source.

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

**27 specimens**, all verified non-weed in CO. Grouped by type below (the order the
site uses); reel status noted. "Reel" = multi-photo `SHOTS` strip; everything else
renders its single `commons` photo. (N) = CO/regional native, (I) = introduced/vetted.

**Trees**
- Chokecherry (*Prunus virginiana*) (N) — 2-photo reel (spring flower + summer fruit)
- Mountain alder, ssp. *tenuifolia* (*Alnus incana*) (N) — 4-season reel

**Shrubs**
- Red-twig dogwood (*Cornus sericea*) (N) — 3-photo reel (summer / fall / winter stems)
- Wood's rose (*Rosa woodsii*) (N) — single labeled photo (summer)
- Common lilac (*Syringa vulgaris*) (I) — single photo

**Subshrubs**
- Mojave sage (*Salvia pachyphylla*) (I) — single labeled photo
- Russian sage (*Salvia yangii*, syn. *Perovskia atriplicifolia*) (I) — single photo

**Ornamental grasses**
- Little bluestem (*Schizachyrium scoparium*) (N) — 3-photo reel (summer blue / fall
  copper / seed detail)

**Perennials**
- Cushion spurge (*Euphorbia polychroma*) (I) — single photo
- Horned spurge (*Euphorbia brachycera*) (N) — single labeled photo
- Silvery lupine (*Lupinus argenteus*) (N) — single labeled photo
- Garden peony (*Paeonia lactiflora*) (I) — single photo
- Dahlia (*Dahlia × hortensis*) (I) — single photo; **tender, not winter-hardy**
- Oriental poppy (*Papaver orientale*) (I) — single photo
- Colorado blue columbine (*Aquilegia coerulea*) (N) — single photo
- Shasta daisy (*Leucanthemum × superbum*) (I) — single photo
- Aspen fleabane (*Erigeron speciosus*) (N) — single photo
- Salvia / meadow sage (*Salvia nemorosa*) (I) — single photo
- Wild bergamot (*Monarda fistulosa*) (N) — single photo
- Scarlet bee balm (*Monarda didyma*) (I) — single photo

**Annuals**
- Snow-on-the-mountain (*Euphorbia marginata*) (N) — single photo
- Cosmos (*Cosmos bipinnatus*) (I) — single photo
- California poppy (*Eschscholzia californica*) (I) — single photo
- Snapdragon (*Antirrhinum majus*) (I) — single photo

**Vines**
- Garden clematis (*Clematis × jackmanii*, large-flowered hybrids) (I) — single photo
- Climbing rose (*Rosa*, climbing cultivars) (I) — single photo
- Rambling rose (*Rosa*, rambling cultivars) (I) — single photo

**Dropped from the keep-list (do not re-add):** coyote willow (*Salix exigua*) and
Turkish cliff sage (*Salvia recognita*). Mojave sage is preferred over Turkish cliff
sage.

## Open work

The current backlog. Move items out of this section as they ship.

- **Photos still wanted if found:** Wood's rose hips (fall) and a winter
  little-bluestem shot — both would upgrade those entries to fuller seasonal reels.
  Most single-photo plants could grow into reels as good Commons seasonal shots
  turn up.
- **Self-host images (gradual):** the `plants/.../images/` folders are ready; download
  CC-licensed Commons originals into them and add `local:` to the shots over time so
  the guide stops depending on live Commons load.

## Quick conventions recap

- Real Commons photos only, verified titles, no illustrations, no copyrighted hotlinks.
- Weed-check every new plant against CO lists A/B/C + Watch before it goes in.
- Show image + blurb for sign-off **before** creating the plant file.
- A new plant = one `plant.json` + one `manifest.json` line (not a big array edit).
- Vanilla HTML/CSS/JS, no build, no deps — keep it that way unless the user asks otherwise.
- Preview locally over `http.server` (fetch won't work from `file://`).
