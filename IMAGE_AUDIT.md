# Image-quality audit — The Front Range Herbarium

Scored against the 8-axis rubric in `CLAUDE.md` (`whole_plant, foliage, flowers, front_facing, bloom_in_context, seed_pods, thumb_framing, seasonal`; each ●=2 / ◐=1 / ○=0 / –=NA). **excellent** = every applicable (non-NA) axis = 2. Annuals' `seasonal` is treated NA (one-season life). Spike/whorl flowers that can't present face-on (lavender et al.) carry a structural `front_facing` cap.

**Tally of 68:** 11 excellent · 1 effectively excellent (only a structural cap) · 17 one shot from excellent · 39 multi-gap.

## ⭐ Excellent — every applicable axis = 2

- **Brunnera** (5 shots)
- **California poppy** (6 shots)
- **Common lilac** (4 shots)
- **Garden peony** (5 shots)
- **Grecian windflower** (5 shots)
- **Larkspur** (7 shots)
- **Little bluestem** (5 shots)
- **Mountain alder** (5 shots)
- **Red-twig dogwood** (7 shots)
- **Snow-on-the-mountain** (5 shots)
- **Wood's rose** (6 shots)

## ◎ Effectively excellent — only a structural cap remains

- **Lavender** — capped: `front_facing` (flower form can't present face-on; no CC shot can fix it)

## ◐ One shot from excellent — a single targeted photo flips it

| plant | the one gap | how to fill |
|---|---|---|
| Aspen fleabane | `foliage` | iNat `--phenology no_evidence` / a clean leaf shot |
| Cushion spurge | `foliage` | iNat `--phenology no_evidence` / a clean leaf shot |
| Blue oat grass | `seasonal` | iNat `--month` for the missing season |
| Turkish speedwell | `seasonal` | iNat `--month` for the missing season |
| Snow-in-summer | `seasonal` | iNat `--month` for the missing season |
| Garden lupine | `seasonal` | iNat `--month` for the missing season |
| Mountain bluet | `seasonal` | iNat `--month` for the missing season |
| Shasta daisy | `seasonal` | iNat `--month` for the missing season |
| Wild bergamot | `seasonal` | iNat `--month` for the missing season |
| Creeping Oregon grape | `seasonal` | iNat `--month` for the missing season |
| 'Dropmore Scarlet' honeysuckle | `seasonal` | iNat `--month` for the missing season |
| Horned spurge | `seed_pods` | iNat `--phenology fruiting` (or GBIF `--month` autumn) |
| Scarlet bee balm | `seed_pods` | iNat `--phenology fruiting` (or GBIF `--month` autumn) |
| Garden clematis | `seed_pods` | iNat `--phenology fruiting` (or GBIF `--month` autumn) |
| Kinnikinnick | `thumb_framing` | re-`rethumb.py` / reframe the existing full image |
| Garden verbena | `thumb_framing` | re-`rethumb.py` / reframe the existing full image |
| German chamomile | `whole_plant` | Commons habit/habitus shot |

## ○ Multi-gap — needs 2+ shots

| plant | overall | fixable gaps | structural caps |
|---|---|---|---|
| Candytuft | fair | whole_plant, bloom_in_context, seasonal | — |
| Coreopsis | fair | whole_plant, foliage, thumb_framing, seasonal | — |
| Evening primrose | fair | whole_plant, flowers, front_facing, bloom_in_context, seed_pods, thumb_framing | — |
| Garden phlox | fair | foliage, thumb_framing, seasonal | — |
| Hardy ice plant | fair | whole_plant, bloom_in_context | — |
| Mock orange | fair | whole_plant, foliage, thumb_framing, seasonal | — |
| Oriental poppy | fair | flowers, front_facing, thumb_framing, seasonal | — |
| Pasque flower | fair | whole_plant, foliage, bloom_in_context, thumb_framing, seasonal | — |
| Pincushion flower | fair | whole_plant, foliage, bloom_in_context, thumb_framing, seasonal | — |
| Pineleaf penstemon | fair | whole_plant, flowers, seasonal | — |
| Rambling rose | fair | foliage, thumb_framing, seasonal | — |
| Red valerian | fair | whole_plant, foliage, thumb_framing | — |
| Silvery lupine | fair | foliage, seed_pods, thumb_framing | — |
| Twinberry honeysuckle | fair | foliage, flowers, front_facing, bloom_in_context, seed_pods, thumb_framing, seasonal | — |
| Yellow yarrow | fair | whole_plant, thumb_framing, seasonal | — |
| Blanket flower | good | whole_plant, bloom_in_context, thumb_framing | — |
| Bloody cranesbill | good | seed_pods, seasonal | — |
| Blue flax | good | foliage, seed_pods, thumb_framing, seasonal | — |
| Cheddar pinks | good | foliage, thumb_framing, seasonal | — |
| Chokecherry | good | flowers, front_facing | — |
| Climbing rose | good | foliage, seasonal | — |
| Colorado blue columbine | good | foliage, seasonal | — |
| Cosmos | good | whole_plant, thumb_framing | — |
| Dahlia | good | whole_plant, seasonal | — |
| Hardy cranesbill | good | foliage, seasonal | — |
| Japanese anemone | good | seed_pods, seasonal | — |
| Knautia | good | foliage, thumb_framing, seasonal | — |
| Mojave sage | good | foliage, seasonal | — |
| Panicled aster | good | seed_pods, seasonal | — |
| Rocky Mountain bee plant | good | whole_plant, foliage | — |
| Russian sage | good | foliage, seasonal | front_facing |
| Salvia (meadow sage) | good | front_facing, thumb_framing, seasonal | — |
| Smoke tree | good | thumb_framing, seasonal | — |
| Snapdragon | good | whole_plant, seed_pods, thumb_framing | — |
| Spike speedwell | good | foliage, seasonal | — |
| Trumpet honeysuckle | good | whole_plant, thumb_framing | — |
| Western wallflower | good | seed_pods, thumb_framing | — |
| White heath aster | good | foliage, thumb_framing, seasonal | — |
| White prairie aster | good | front_facing, seed_pods, thumb_framing, seasonal | — |

## Full scorecard

| plant | whole | folia | flowe | front | bloom | seed_ | thumb | seaso | overall |
|---|---|---|---|---|---|---|---|---|---|
| 'Dropmore Scarlet' honeysuckle | ● | ● | ● | ● | ● | – | ● | ◐ | good |
| Aspen fleabane | ● | ◐ | ● | ● | ● | ● | ● | ● | good |
| Blanket flower | ◐ | ● | ● | ● | ◐ | ● | ◐ | ● | good |
| Bloody cranesbill | ● | ● | ● | ● | ● | ○ | ● | ◐ | good |
| Blue flax | ● | ◐ | ● | ● | ● | ◐ | ◐ | ◐ | good |
| Blue oat grass | ● | ● | – | – | – | ● | ● | ◐ | good |
| Brunnera | ● | ● | ● | ● | ● | – | ● | ● | excellent |
| California poppy | ● | ● | ● | ● | ● | ● | ● | – | excellent |
| Candytuft | ○ | ● | ● | ● | ◐ | – | ● | ◐ | fair |
| Cheddar pinks | ● | ◐ | ● | ● | ● | – | ◐ | ◐ | good |
| Chokecherry | ● | ● | ◐ | ◐ | ● | ● | ● | ● | good |
| Climbing rose | ● | ◐ | ● | ● | ● | ● | ● | ◐ | good |
| Colorado blue columbine | ● | ◐ | ● | ● | ● | – | ● | ◐ | good |
| Common lilac | ● | ● | ● | ● | ● | – | ● | ● | excellent |
| Coreopsis | ◐ | ◐ | ● | ● | ● | – | ◐ | ◐ | fair |
| Cosmos | ◐ | ● | ● | ● | ● | – | ◐ | – | good |
| Creeping Oregon grape | ● | ● | ● | – | – | ● | ● | ◐ | good |
| Cushion spurge | ● | ◐ | ● | ● | ● | – | ● | ● | good |
| Dahlia | ◐ | ● | ● | ● | ● | – | ● | ◐ | good |
| Evening primrose | ◐ | ● | ◐ | ◐ | ◐ | ◐ | ◐ | ● | fair |
| Garden clematis | ● | ● | ● | ● | ● | ◐ | ● | ● | good |
| Garden lupine | ● | ● | ● | ◐ | ● | – | ● | ◐ | good |
| Garden peony | ● | ● | ● | ● | ● | ● | ● | ● | excellent |
| Garden phlox | ● | ◐ | ● | ● | ● | – | ◐ | ◐ | fair |
| Garden verbena | ● | ● | ● | ● | ● | – | ◐ | – | good |
| German chamomile | ◐ | ● | ● | ● | ● | – | ● | – | good |
| Grecian windflower | ● | ● | ● | ● | ● | – | ● | – | excellent |
| Hardy cranesbill | ● | ◐ | ● | ● | ● | – | ● | ◐ | good |
| Hardy ice plant | ◐ | ● | ● | ● | ◐ | – | ● | – | fair |
| Horned spurge | ● | ● | ● | – | ● | ◐ | ● | ● | good |
| Japanese anemone | ● | ● | ● | ● | ● | ○ | ● | ◐ | good |
| Kinnikinnick | ● | ● | ● | – | – | ● | ◐ | ● | good |
| Knautia | ● | ◐ | ● | ● | ● | – | ◐ | ◐ | good |
| Larkspur | ● | ● | ● | ● | ● | ● | ● | – | good |
| Lavender | ● | ● | ● | ◐ | ● | – | ● | ● | good |
| Little bluestem | ● | ● | – | – | – | ● | ● | ● | excellent |
| Mock orange | ◐ | ◐ | ● | ● | ● | – | ◐ | ◐ | fair |
| Mojave sage | ● | ◐ | ● | ● | ● | – | ● | ◐ | good |
| Mountain alder | ● | ● | ● | – | ● | ● | ● | ● | excellent |
| Mountain bluet | ● | ● | ● | ● | ● | – | ● | ◐ | good |
| Oriental poppy | ● | ● | ◐ | ◐ | ● | ● | ◐ | ◐ | fair |
| Panicled aster | ● | ● | ● | ● | ● | ◐ | ● | ◐ | good |
| Pasque flower | ◐ | ◐ | ● | ● | ◐ | ● | ◐ | ◐ | fair |
| Pincushion flower | ○ | ○ | ● | ● | ○ | ● | ◐ | ◐ | fair |
| Pineleaf penstemon | ◐ | ● | ◐ | – | ● | – | ● | ◐ | fair |
| Rambling rose | ● | ○ | ● | ● | ● | ● | ◐ | ◐ | fair |
| Red valerian | ◐ | ◐ | ● | ● | ● | ● | ◐ | ● | fair |
| Red-twig dogwood | ● | ● | ● | ● | ● | ● | ● | ● | excellent |
| Rocky Mountain bee plant | ◐ | ◐ | ● | ● | ● | ● | ● | – | good |
| Russian sage | ● | ◐ | ● | ◐ | ● | – | ● | ◐ | good |
| Salvia (meadow sage) | ● | ● | ● | ◐ | ● | – | ◐ | ◐ | good |
| Scarlet bee balm | ● | ● | ● | ● | ● | ◐ | ● | ● | good |
| Shasta daisy | ● | ● | ● | ● | ● | – | ● | ◐ | good |
| Silvery lupine | ● | ◐ | ● | ● | ● | ◐ | ◐ | ● | fair |
| Smoke tree | ● | ● | ● | – | ● | – | ◐ | ◐ | good |
| Snapdragon | ◐ | ● | ● | ● | ● | ◐ | ◐ | – | good |
| Snow-in-summer | ● | ● | ● | ● | ● | – | ● | ◐ | good |
| Snow-on-the-mountain | ● | ● | ● | ● | ● | – | ● | ● | excellent |
| Spike speedwell | ● | ◐ | ● | ● | ● | – | ● | ◐ | good |
| Trumpet honeysuckle | ◐ | ● | ● | – | ● | ● | ◐ | ● | good |
| Turkish speedwell | ● | ● | ● | ● | ● | – | ● | ◐ | good |
| Twinberry honeysuckle | ● | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | fair |
| Western wallflower | ● | ● | ● | ● | ● | ◐ | ◐ | ● | good |
| White heath aster | ● | ◐ | ● | ● | ● | ● | ◐ | ◐ | good |
| White prairie aster | ● | ● | ● | ◐ | ● | ◐ | ◐ | ◐ | good |
| Wild bergamot | ● | ● | ● | ● | ● | ● | ● | ◐ | good |
| Wood's rose | ● | ● | ● | ● | ● | ● | ● | ● | excellent |
| Yellow yarrow | ◐ | ● | ● | – | ● | – | ◐ | ◐ | fair |
