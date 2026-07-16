# Extend type-bias items to all pokemon-obtaining roulettes

Status: done. All 4 steps implemented; full test suite (520 specs) passes;
app boots cleanly with no console errors. A full manual playthrough
reaching each of the 9 wheels wasn't performed in this session (would
require a long multi-battle run) — verification relied on the dedicated
`apply-type-bias.spec.ts` covering every bias combination plus each
component spec confirming correct wiring.

## Context

`TrainerService.currentPendingTypeBiases` (set by Honey/Repel/Poké Radar/Max
Repel) is currently only consumed by two wheels:
`pokemon-from-generation-roulette` (wild catch) and `trade-pokemon-roulette`
(trade-in). Every other roulette that hands the player a new Pokémon —
fossils, legendaries, cave encounters, starters, fishing, mysterious egg, and
the Area Zero paradox pool — ignores the bias entirely. This was a
deliberate, staged scope in the original implementation (see commit
`bcffcb2`, titled "Apply the active type bias to the catch and trade
wheels"), not a bug, and the README/i18n text already matches it ("bias your
next catch or trade"). It was tracked as an open item in
`docs/todo/backlog.md`.

The user wants the scope widened: the bias should apply to **every**
roulette where a new Pokémon is obtained from a species pool, not just catch
and trade. This plan extends it consistently and removes the now-duplicated
bias logic.

**Out of scope, and why** (so this isn't re-litigated mid-implementation):
- `pokemon-from-aux-list-roulette` — picks among the player's *own* team or
  evolution candidates (evolution choice, trade-out, steal target, battle
  award from own roster). Nothing is being newly "obtained" from an external
  species pool here.
- `catch-legendary-roulette` / `catch-paradox-roulette` — pure yes/no
  capture-chance wheels with no species pool of their own. The actual
  species pools they gate (`legendary-roulette`, `area-zero-roulette`) are
  in scope and covered below.
- `snorlax-roulette` — 3-outcome run/catch/defeat wheel, single fixed
  target, no species pool.
- `select-form-roulette` — picks a regional *form* of an already-chosen
  species, not a new species.
- `base-battle-roulette` and its gym/rival/elite-four/champion subclasses —
  these hold the opposing trainer's team, not a catch pool.

## Current implementation (duplicated today)

Both `pokemon-from-generation-roulette.component.ts` and
`trade-pokemon-roulette.component.ts` contain an identical private
`applyTypeBias` / `applySoftWeight` / `matchesType` block (plus identical
`TOWARD_SOFT_WEIGHT_MULTIPLIER = 4` / `AWAY_SOFT_WEIGHT_MULTIPLIER = 0.25`
constants) that reads `trainerService.currentPendingTypeBiases` and:
- **hard mode**: filters the pool to matching (`toward`) or non-matching
  (`away`) type, but skips the filter if it would empty the pool (never
  soft-locks a wheel)
- **soft mode**: multiplies matching Pokémon's wheel `weight` by the
  multiplier above (a nudge, not exclusion)

## Step 1 — Extract the shared bias logic

Create `src/app/services/trainer-service/apply-type-bias.ts`, a pure
function moved verbatim out of the two existing components:

```ts
export function applyTypeBias(pokemon: PokemonItem[], biases: PendingTypeBiases): PokemonItem[]
```

(keeping the same hard/soft/fallback behavior and the two multiplier
constants as file-local consts). No DI, no side effects — just the existing
logic relocated so it has one home instead of two copies.

Update `pokemon-from-generation-roulette.component.ts` and
`trade-pokemon-roulette.component.ts` to import and call
`applyTypeBias(pool, this.trainerService.currentPendingTypeBiases)`, deleting
their now-redundant private methods and local constants.

Add `src/app/services/trainer-service/apply-type-bias.spec.ts` covering:
hard toward, hard away, hard toward+away combined, hard filter that would
empty the pool (falls back to unfiltered), soft toward, soft away, soft
toward+away combined, and no active bias (pool passed through unchanged).
This becomes the single source of truth test for the behavior, so the
per-component specs don't need to re-prove the bias math.

## Step 2 — Wire the remaining pool-based roulettes

For each component below: inject `TrainerService` (constructor param,
matching the existing `pokemon-from-generation-roulette` style), import
`applyTypeBias`, and wrap the existing pool-assignment line with it.

Per-generation pool components (identical shape — `getGeneration().subscribe`
building a list via `pokemonService.getPokemonByIdArray(ids)`):
- `fossil-roulette.component.ts`
- `legendary-roulette.component.ts`
- `cave-pokemon-roulette.component.ts`
- `starter-roulette.component.ts`
- `fishing-roulette.component.ts`

Example diff shape (same for all five):
```ts
this.fossils = applyTypeBias(
  this.pokemonService.getPokemonByIdArray(fossilIds),
  this.trainerService.currentPendingTypeBiases
);
```

One-shot constructor-built pools:
- `mysterious-egg-roulette.component.ts` — wraps
  `pokemonService.getAllPokemon()`
- `area-zero-roulette.ts` (`AreaZeroRoulette` class) — wraps
  `pokemonService.getPokemonByIdArray(areaZeroParadoxPokemonIds)`

## Step 3 — Test fixture updates

The existing `pokemon-from-generation-roulette.component.spec.ts` already
hit this: injecting `TrainerService` transitively constructs
`EvolutionService`, which calls `pokemonService.getAllPokemon()` in its own
constructor — so the spec had to add
`pokemonService.getAllPokemon.and.returnValue([])` to its mock. None of the
7 newly-wired components' specs currently stub `getAllPokemon` (their
`PokemonService` mocks only define `getPokemonByIdArray` /
`getPokemonById`). Add that same stub to each spec's `PokemonService`
provider so `TrainerService`'s real (unmocked) construction doesn't throw.
No other spec changes are required — with no bias active,
`currentPendingTypeBiases` defaults to `{ toward: null, away: null }`, so
`applyTypeBias` is a no-op and all existing assertions keep passing
unchanged.

Files: `fossil-roulette.component.spec.ts`,
`legendary-roulette.component.spec.ts`,
`cave-pokemon-roulette.component.spec.ts`,
`starter-roulette.component.spec.ts`, `fishing-roulette.component.spec.ts`,
`mysterious-egg-roulette.component.spec.ts`, `area-zero-roulette.spec.ts`.

## Step 4 — Docs

- `README.md:42` — currently scopes the items to "bias your next catch or
  trade". Reword to reflect the wider scope (e.g. "bias your next wild
  Pokémon encounter" or similar — covering catch, trade, fossils,
  legendaries, cave, starters, fishing, mysterious egg, and Area Zero).
- `src/assets/i18n/en.json` item descriptions for `honey`, `repel`,
  `poke-radar`, `max-repel` (currently "bias your next catch or trade
  toward...") — update wording to match. Update the other five locale files
  (`de`, `es`, `fr`, `it`, `pt`) too where practical, per CLAUDE.md i18n
  guidance.
- `docs/todo/backlog.md` — remove the "Type-bias items … only affect two
  wheels" entry now that it's resolved.

## Verification

- `npm run test:local` — full suite, confirms the extracted function's new
  spec passes and all 9 touched component specs still pass.
- Manual smoke check via the `run` skill: start a run, use Honey on a type,
  and confirm the fossil/legendary/cave/starter/fishing/mysterious-egg/area-zero
  wheels (whichever are reachable in a short session) visibly favor that
  type, and that the bias still clears on entering a battle as before.

## Notes from research (for the execution session)

- Confirmed via `git log` on `trainer.service.ts` and the two wired-up
  roulettes: the two-wheel scope was the deliberate, stated target from the
  start (commits `1a0032d` and `bcffcb2`), not an oversight.
- Full survey of every `roulettes/*` component was done to confirm the
  in-scope/out-of-scope split above — no other pokemon-species-pool
  components exist beyond the 9 listed (2 already wired + 7 to add).
