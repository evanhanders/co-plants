# TODO

## Self-host the 3 cultivar photos (needs Wikimedia network access)

24/27 plants are now self-hosted from the iNaturalist open dataset. These 3 are
horticultural cultivars/hybrids with **no clean iNaturalist taxon**, so the open-data
pipeline can't reach them. They still ride a remote `commons` photo:

- [ ] `vines/garden-clematis` — *Clematis* × *jackmanii* (large-flowered hybrid)
- [ ] `vines/climbing-rose` — *Rosa*, climbing cultivars
- [ ] `vines/rambling-rose` — *Rosa*, rambling cultivars

**Blocked on:** this sandbox's network allowlist blocks Wikimedia. Fix by editing the
environment's **Network access** (cloud icon at claude.ai/code) to **Custom** + add
`*.wikimedia.org` with "include default package managers" checked (keeps `*.amazonaws.com`,
pypi, GitHub), **or** set it to **Full**. The change only applies to a **new session**.

**Then, for each cultivar:** source a CC-licensed close-up (leaves + flowers) **and** a
wider structure/habit shot, verify species/cultivar match + upright orientation, and run
them through the pipeline so each gets a repo-hosted ≤400px thumbnail (`local:`) + ≤1500px
full image (`full:`) with attribution. See `tools/` (esp. `finalize.py`) and the
"Image requirements & sourcing" section of `CLAUDE.md`. Then move these items out of TODO.
