# Plan: Shiny-family consistency pipeline (retire the two TODO bridges)

Status: **Ready to implement. All decisions baked in.**
Owner: tormarod
Last updated: 2026-07-16
File to edit: `src/app/services/pokedex-service/pokedex.service.ts`
Tests to edit: `src/app/services/pokedex-service/pokedex.service.spec.ts`
Resolves the `[LOW] Pokédex TODOs` item (#8 in `code-review-cleanup.md`, which
was correctly left un-touched).

## Why (read once)

Two blocks in `pokedex.service.ts` carry `TODO(next-task cleanup)` labels calling
themselves "temporary", waiting on a "dedicated shiny consistency pipeline". That
pipeline was never built — **these two blocks *are* the mechanism**, and they must
not be deleted:
- `markSeen` (L36-42): propagates shiny across the evolution family when a shiny
  is seen. Callers (`roulette-container.ts:1123/1126`) pass only one id + its base,
  so this block is what flags the whole line.
- `normalizeShinyOnLoad` (L145-172): re-applies the invariant on load (L116) **and
  on profile import** (`replacePokedex`, L69) — imports are ongoing, so this is a
  permanent need, not legacy.

The fix: **consolidate both into one shared helper, keep both call sites, drop the
"temporary" framing.** That single consolidated helper *is* the pipeline. Nothing
is deleted; propagation becomes guaranteed and DRY.

The invariant, stated once: **if any member of an evolution family is shiny, every
member is shiny.**

## Decisions already made (do not re-open)

- **Keep both call sites permanent.** Write-path = immediate funnel; load/import =
  enforcement safety net (imports need it forever). Do NOT version-gate or delete
  either. (`getRelatedPokemonIds` is bidirectional, so it covers pre-evos and
  evos — one source id reaches the whole family.)
- **Preserve the existing create-vs-only-existing split:** the write path *creates*
  missing family entries (reveals the line); load/import enforcement only updates
  entries that already exist. This is carried by a `createMissing` flag.
- **No `POKEDEX_VERSION` bump, no migration step.** Purely a refactor; behavior is
  identical to today, just de-duplicated and relabeled.

## Edit 1 — add the shared helper

In `PokedexService`, add:

```ts
/**
 * Shiny-family consistency invariant: if any member of an evolution family is
 * shiny, every member is shiny. Applies it around `sourceId`'s family in
 * `caught`. `createMissing` reveals family members not yet in the dex (write
 * path); when false, only existing entries are updated (load/import enforcement).
 * Returns true if anything changed.
 */
private propagateShinyToFamily(
  caught: Record<string, PokedexEntry>,
  sourceId: number,
  createMissing: boolean,
): boolean {
  let changed = false;
  for (const relatedId of this.getRelatedPokemonIds(sourceId)) {
    if (!createMissing && !caught[String(relatedId)]) continue;
    changed = this.upsertSeenEntry(caught, relatedId, true) || changed;
  }
  return changed;
}
```

## Edit 2 — `markSeen`: use the helper, drop the TODO

Replace the current block (L36-42):

```ts
    // TODO(next-task cleanup): remove this temporary shiny propagation bridge once the
    // dedicated shiny consistency pipeline lands in the next task.
    if (shiny) {
      for (const relatedId of this.getRelatedPokemonIds(pokemonId)) {
        changed = this.upsertSeenEntry(updatedCaught, relatedId, true) || changed;
      }
    }
```

with:

```ts
    if (shiny) {
      changed = this.propagateShinyToFamily(updatedCaught, pokemonId, true) || changed;
    }
```

## Edit 3 — rename `normalizeShinyOnLoad` → `enforceShinyFamilyConsistency`, use the helper, drop the TODO

Replace the whole method (L145-172) with:

```ts
  /**
   * Enforces the shiny-family invariant across the whole Pokédex — permanent,
   * not a migration: runs on load and on profile import (replacePokedex), where
   * an imported blob may carry a shiny without its family flagged. Only updates
   * entries already present (does not reveal new family members).
   */
  private enforceShinyFamilyConsistency(data: PokedexData): { data: PokedexData; changed: boolean } {
    const caught: Record<string, PokedexEntry> = { ...data.caught };
    let changed = false;
    for (const [pokemonId, entry] of Object.entries(data.caught)) {
      if (!entry?.shiny) continue;
      changed = this.propagateShinyToFamily(caught, Number(pokemonId), false) || changed;
    }
    return { data: { version: data.version, caught }, changed };
  }
```

Then update the two callers to the new name:
- L116 (`getInitialPokedex`): `this.normalizeShinyOnLoad(fromStorage)` → `this.enforceShinyFamilyConsistency(fromStorage)`.
- L69 (`replacePokedex`): `this.normalizeShinyOnLoad(normalized)` → `this.enforceShinyFamilyConsistency(normalized)`.

## Tests (add to `pokedex.service.spec.ts`)

Charmander line = 4→5→6, Bulbasaur line = 1→2→3.

1. **Write-path reveals the whole family.** `service.markSeen(6, true)` → dex has
   ids 4, 5, 6 all present with `shiny: true`.
2. **Non-shiny write does not propagate.** `service.markSeen(6, false)` → only id 6
   present, no `shiny`.
3. **Load enforcement flags existing family only.** Seed storage with id 6
   `{shiny:true}` and id 4 `{shiny:false}` (no id 5). Re-create the service (load) →
   id 4 becomes `shiny:true`; id 5 is NOT created.
4. **Import enforcement.** `service.replacePokedex({version:1, caught:{ '6': {won:false,sprite:null,shiny:true}, '4': {won:false,sprite:null} }})`
   → id 4 shiny true, id 5 absent.
5. **Unrelated family untouched.** After marking id 6 shiny, ids 1/2/3 remain
   absent / unshiny.

Behavior must be identical to before these edits (this is a refactor) — existing
Pokédex specs should stay green with no assertion changes.

## Steps

1. Add `propagateShinyToFamily` (Edit 1).
2. Apply Edits 2 and 3, including the two caller renames.
3. Add the 5 tests; run `npm run test:local` — full suite green, no existing
   assertions changed.
4. Grep the file for `TODO(next-task cleanup)` → confirm zero remain.
5. Mark this plan done → `docs/plans/done/`; note #8 resolved.
