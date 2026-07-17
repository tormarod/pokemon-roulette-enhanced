# Plan: Type-bias item stacking + in-wheel usage

Status: **Done** — all phases shipped 2026-07-17 (including the single-wheel-use
amendment made during Phase 2 execution).

## Current system (context for the execution session)

Soft-bias items (Honey = toward a type, Repel = away from a type) and
hard-guarantee items (Poké Radar = toward, Max Repel = away) set a **pending
bias** that the next Pokémon-obtaining wheel reads and applies to its
candidate pool's weights. The bias persists across an entire "gym stretch"
(cleared on reaching `gym-battle`/`elite-four-battle`/`champion-battle`), not
just one spin.

**Data model** — `src/app/services/trainer-service/trainer.service.ts:20-36`:
```ts
export interface TypeBiasEntry { type: PokemonType; mode: 'soft' | 'hard'; }
export interface PendingTypeBiases { toward: TypeBiasEntry | null; away: TypeBiasEntry | null; }
```
Two single-value slots. `setTowardBias()` / `setAwayBias()`
(`trainer.service.ts:227-233`) **overwrite** their slot — a 2nd Honey use just
replaces the 1st's type, it doesn't stack.

**Weighting math** — `src/app/services/trainer-service/apply-type-bias.ts`
(pure function `applyTypeBias(pokemon, biases)`):
- Hard mode: filters the pool to matching (`toward`) / non-matching (`away`)
  Pokémon, falling back to the unfiltered pool if the filter would empty it.
- Soft mode: multiplies `PokemonItem.weight` by `4` (toward) or `0.25` (away)
  for Pokémon matching the biased type. Fixed multiplier, no stacking.

**Trigger flow today** — clicking a bias item in `app-items`
(`src/app/items/items.component.ts:55-67`) emits `typeBiasItemInterrupt` →
relayed via `TypeBiasItemService` → `RouletteContainerComponent
.handleTypeBiasItemUse()` (`roulette-container.component.ts:591-597`), which:
1. `gameStateService.repeatCurrentState()` (re-queues the current screen)
2. removes the item from inventory
3. pushes `'select-from-type-list'` as the next state and finishes
4. `SelectFromTypeListRouletteComponent` (a plain type-picker grid, no wheel)
   emits the chosen type → `continueWithType()`
   (`roulette-container.component.ts:603-621`) calls `setTowardBias`/
   `setAwayBias`, then the re-queued screen renders again

This means using a bias item **always leaves and reconstructs** whatever
screen was on-screen — including an obtain wheel, if the player is
mid-catch. There is currently no way to apply a bias to a wheel already on
screen without leaving it.

**The 9 obtain-wheel components** (each independently calls `applyTypeBias`
once against `trainerService.currentPendingTypeBiases`, no shared base
class):

| Wheel | State | Component | Source field |
|---|---|---|---|
| Catch | `catch-pokemon` | `pokemon-from-generation-roulette.component.ts` | `pokemon` |
| Trade | `trade-pokemon` | `trade-pokemon-roulette.component.ts` | `nationalDexPokemon` |
| Fossil | `find-fossil` | `fossil-roulette.component.ts` | `fossils` |
| Legendary | `legendary-encounter` | `legendary-roulette.component.ts` | `legendaries` |
| Cave | `catch-cave-pokemon` | `cave-pokemon-roulette.component.ts` | `cavePokemon` |
| Starter | `starter-pokemon` | `starter-roulette.component.ts` | `starters` |
| Fishing | `go-fishing` | `fishing-roulette.component.ts` | `fish` |
| Mysterious egg | `mysterious-egg` | `mysterious-egg-roulette.component.ts` | `nationalDexPokemon` |
| Area Zero | `area-zero` | `area-zero-roulette.ts` (class `AreaZeroRoulette`) | `paradoxPokemon` |

Note: `starter-pokemon` happens **before** `'start-adventure'` is popped off
the state stack, and the Items panel is gated by `itemsAvailable = !stack
.includes('start-adventure')` (`main-game.component.ts:88`) — so the Items
panel isn't rendered during the starter screen and bias items can't be used
there at all today. **Exclude starter from the in-wheel-usage work below**;
only the other 8 need it. The stacking data-model change (Phase 1) applies
everywhere regardless.

**Wheel redraw**: `src/app/wheel/wheel.component.ts` implements
`ngOnChanges` and redraws whenever its `@Input() items` reference changes
(skipping only the very first change). So reassigning a component's `pokemon`
array to a new array is enough to make the on-screen wheel redraw live — no
new redraw plumbing needed, just reassigning to a new array reference when
the bias changes.

**Persistence**: `run-persistence.service.ts:105` restores
`run.pendingTypeBiases ?? { toward: null, away: null }` — this default and
any saved-run shape assumptions need updating for the new array-based model,
with a migration path for old saves already in players' `localStorage`
(single-entry object, not array).

---

## Design decisions (already made — do not re-litigate)

**Amendment (made during Phase 2 execution):** a pending bias is
**single-wheel-use**, not stretch-persistent. It weights exactly one obtain
wheel's resolution — whichever comes next, or the one already on screen — and
is cleared immediately once that wheel resolves (`RouletteContainerComponent
.capturePokemon()` / `.legendaryCaptureChance()` / `.performTrade()` /
`.paradoxCaptureChance()` each call `trainerService.clearPendingTypeBiases()`
as their first action). The original "persists across the whole gym stretch"
behavior was the pre-existing design before this feature; reaching a battle
state still clears it too, as a safety net for a bias that was set but never
actually used on a wheel.


1. **Stacking scope**: each bias-item use is independent and additive. A 2nd
   Honey used on a *different* type does **not** overwrite the 1st — both
   types end up boosted simultaneously. A 2nd Honey on the *same* type stacks
   with the 1st (compounds that type's boost).
2. **Formula**: linear, uncapped. For a given type, if a soft-toward bias has
   been applied `n` times to that type, its weight multiplier is `4 × n`. If
   a soft-away bias has been applied `n` times to that type, its multiplier
   is `0.25 ÷ n`. A Pokémon matching multiple *different* biased types gets
   each type's multiplier applied (multiplied together).
3. **Hard-guarantee items** (Poké Radar / Max Repel) do not stack in
   strength — a filter is already absolute. But using a 2nd hard-toward item
   for a *different* type **widens** the guarantee to an OR across both
   types (same non-stacking principle as soft, applied to a set instead of a
   scalar). A repeat hard use on the *same* type is a no-op (the Set
   dedupes).
4. Hard items also get the new in-wheel usage affordance (question 3 below),
   for consistency with soft items.
5. **In-wheel UX**: clicking a bias item while an obtain wheel (one of the 8
   above, excluding starter) is on screen opens the existing
   `SelectFromTypeListRouletteComponent` picker as an **NgbModal overlay**
   (via `ModalQueueService`, same pattern as
   `showMegaEvolutionAnimation()` in `roulette-container.component.ts:1038`)
   — no `GameState` change, no `repeatCurrentState()`. On type selection, the
   bias is applied and the modal closes; the wheel screen underneath
   recomputes its candidate pool and reassigns its array, which the wheel
   redraws live via `ngOnChanges`. Outside an obtain-wheel screen (e.g. on
   `main-adventure`), the existing deferred flow (leave screen → type picker
   state → return) is unchanged.

---

## Phase 1 — Data model, stacking math, persistence, UI badges [done]

### 1a. `src/app/services/trainer-service/trainer.service.ts`

Change the interface (lines 20-36):
```ts
export interface TypeBiasEntry {
  type: PokemonType;
  mode: 'soft' | 'hard';
}

/**
 * "Toward" (Honey/Poké Radar) and "away" (Repel/Max Repel) are independent —
 * using one doesn't consume or overwrite the other. Each direction is a list:
 * every item use appends an entry rather than replacing one, so multiple
 * uses (same type or different types) all stay active and stack — see
 * applyTypeBias() for how the list turns into a weight multiplier.
 */
export interface PendingTypeBiases {
  toward: TypeBiasEntry[];
  away: TypeBiasEntry[];
}

const NO_PENDING_TYPE_BIASES: PendingTypeBiases = { toward: [], away: [] };
```

Replace `setTowardBias`/`setAwayBias` (lines 226-233) to append instead of
overwrite:
```ts
/** Each use appends an entry — same-type reuse stacks, different-type uses add independently. */
setTowardBias(entry: TypeBiasEntry): void {
  this.updatePendingTypeBiases({
    ...this.pendingTypeBiases,
    toward: [...this.pendingTypeBiases.toward, entry]
  });
}

setAwayBias(entry: TypeBiasEntry): void {
  this.updatePendingTypeBiases({
    ...this.pendingTypeBiases,
    away: [...this.pendingTypeBiases.away, entry]
  });
}
```

`restorePendingTypeBiases()` and `clearPendingTypeBiases()`
(lines 236-242) need no logic change — they already bulk-overwrite via
`updatePendingTypeBiases()`; `NO_PENDING_TYPE_BIASES` now has empty arrays.

### 1b. `src/app/services/trainer-service/apply-type-bias.ts`

Rewrite to operate over the entry lists:
```ts
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { PendingTypeBiases, TypeBiasEntry } from './trainer.service';

const TOWARD_SOFT_BASE_MULTIPLIER = 4;
const AWAY_SOFT_BASE_MULTIPLIER = 0.25;

/**
 * A hard filter that would empty the pool is skipped (falls back to the
 * unfiltered pool) rather than ever soft-locking the wheel. Multiple hard
 * entries for different types OR together (widen the guarantee); multiple
 * soft entries for the same type multiply together (stack the boost).
 */
export function applyTypeBias(pokemon: PokemonItem[], biases: PendingTypeBiases): PokemonItem[] {
  const { toward, away } = biases;
  let result = pokemon;

  const hardTowardTypes = new Set(toward.filter(e => e.mode === 'hard').map(e => e.type));
  const hardAwayTypes = new Set(away.filter(e => e.mode === 'hard').map(e => e.type));

  if (hardTowardTypes.size > 0) {
    const filtered = result.filter(p => matchesAnyType(p, hardTowardTypes));
    if (filtered.length > 0) {
      result = filtered;
    }
  }
  if (hardAwayTypes.size > 0) {
    const filtered = result.filter(p => !matchesAnyType(p, hardAwayTypes));
    if (filtered.length > 0) {
      result = filtered;
    }
  }

  const towardSoftCounts = countByType(toward.filter(e => e.mode === 'soft'));
  const awaySoftCounts = countByType(away.filter(e => e.mode === 'soft'));

  if (towardSoftCounts.size > 0 || awaySoftCounts.size > 0) {
    result = result.map(p => applySoftWeight(p, towardSoftCounts, awaySoftCounts));
  }

  return result;
}

function countByType(entries: TypeBiasEntry[]): Map<PokemonType, number> {
  const counts = new Map<PokemonType, number>();
  for (const entry of entries) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }
  return counts;
}

function applySoftWeight(
  pokemon: PokemonItem,
  towardCounts: Map<PokemonType, number>,
  awayCounts: Map<PokemonType, number>
): PokemonItem {
  let weight = pokemon.weight;
  weight *= softMultiplier(pokemon, towardCounts, TOWARD_SOFT_BASE_MULTIPLIER, true);
  weight *= softMultiplier(pokemon, awayCounts, AWAY_SOFT_BASE_MULTIPLIER, false);
  return weight === pokemon.weight ? pokemon : { ...pokemon, weight };
}

function softMultiplier(
  pokemon: PokemonItem,
  counts: Map<PokemonType, number>,
  base: number,
  toward: boolean
): number {
  let multiplier = 1;
  for (const [type, n] of counts) {
    if (!matchesType(pokemon, type)) continue;
    multiplier *= toward ? base * n : base / n;
  }
  return multiplier;
}

function matchesType(pokemon: PokemonItem, type: PokemonType): boolean {
  return pokemon.type1 === type || pokemon.type2 === type;
}

function matchesAnyType(pokemon: PokemonItem, types: Set<PokemonType>): boolean {
  return types.has(pokemon.type1) || (pokemon.type2 != null && types.has(pokemon.type2));
}
```

Update `src/app/services/trainer-service/apply-type-bias.spec.ts` — every
`biases` fixture in the existing spec passes `{ type, mode }` object literals
for `toward`/`away`; change them to single-element arrays (`[{ type, mode }]`)
or `[]` for "no bias". Add new cases:
- Two soft-toward entries, same type → weight `×16` (4×2, squared via the
  multiplicative loop — verify against the formula above: multiplier is
  `base × n` = `4 × 2 = 8`, **not** 16; write the assertion against `8`, not
  a compounding-per-entry value. Double-check by tracing `countByType` +
  `softMultiplier`: two entries of the same type collapse into one
  `Map` entry with `n = 2`, and `softMultiplier` multiplies once by
  `4 × 2 = 8`. Assert `8`.
- Two soft-toward entries, different types (e.g. Electric ×1, Water ×1) → an
  Electric/Water dual-type Pokémon gets both applied: `4 × 4 = 16`. A
  pure-Electric Pokémon gets only `4`.
- Two soft-away entries, same type → multiplier `0.25 / 2 = 0.125`.
- Two hard-toward entries, different types → pool filtered to the union of
  both types (OR), not intersection.
- Repeated hard-toward entry, same type twice → no different outcome than
  once (Set dedupes).

### 1c. `src/app/services/run-persistence-service/run-persistence.service.ts`

Update the fallback and add migration for old single-entry saves. Replace
line 104-105:
```ts
// Older saves may have no pendingTypeBiases field, or the pre-stacking
// single-entry shape ({ toward: {type,mode}|null, away: ... }) instead of
// today's array shape — normalize both into the current array format.
this.trainerService.restorePendingTypeBiases(this.normalizePendingTypeBiases(run.pendingTypeBiases));
```
Add a private method:
```ts
private normalizePendingTypeBiases(value: unknown): PendingTypeBiases {
  const record = (value ?? {}) as { toward?: unknown; away?: unknown };
  return {
    toward: this.normalizeBiasDirection(record.toward),
    away: this.normalizeBiasDirection(record.away)
  };
}

private normalizeBiasDirection(value: unknown): TypeBiasEntry[] {
  if (Array.isArray(value)) {
    return value as TypeBiasEntry[];
  }
  if (value && typeof value === 'object') {
    return [value as TypeBiasEntry];
  }
  return [];
}
```
Import `TypeBiasEntry` alongside the existing `PendingTypeBiases` import
(line 5).

`isValidSavedRun()` (lines 117-134) needs no change — its check is already
just `typeof run.pendingTypeBiases === 'object'`, which holds for both the
old and new shapes.

### 1d. `src/app/main-game/main-game.component.ts` + `.html`

The badge UI currently shows at most one toward + one away badge. With
stacking, potentially multiple *types* can be active per direction
simultaneously, each with its own stack count. Replace the single-entry
badge fields with grouped lists.

In `main-game.component.ts`, add a local interface and two fields:
```ts
interface GroupedBias {
  type: PokemonType;
  mode: 'soft' | 'hard';
  count: number;
}
```
Replace `pendingTypeBiases: PendingTypeBiases = { toward: null, away: null };`
(line 67) with:
```ts
groupedTowardBiases: GroupedBias[] = [];
groupedAwayBiases: GroupedBias[] = [];
```
Replace the subscription body (lines 77-79):
```ts
this.trainerService.getPendingTypeBiasesObservable().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(biases => {
  this.groupedTowardBiases = this.groupBiases(biases.toward);
  this.groupedAwayBiases = this.groupBiases(biases.away);
});
```
Add the grouping helper (private method):
```ts
private groupBiases(entries: TypeBiasEntry[]): GroupedBias[] {
  const grouped = new Map<string, GroupedBias>();
  for (const entry of entries) {
    const key = `${entry.type}-${entry.mode}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(key, { type: entry.type, mode: entry.mode, count: 1 });
    }
  }
  return [...grouped.values()];
}
```
Update `getBiasTypeIconUrl`/`getBiasLabelKey` (lines 92-100) to take a
`GroupedBias` instead of `TypeBiasEntry` (identical bodies, just the param
type changes since both have `.type`/`.mode`).

In `main-game.component.html` (lines 50-61), replace the two `@if` blocks
with `@for` loops over the grouped lists, showing a `×N` suffix only for
`count > 1` (a stack count on a hard entry is meaningless — hard mode
doesn't compound in strength — so only render the multiplier for
`mode === 'soft'`):
```html
@for (bias of groupedTowardBiases; track bias.type + bias.mode) {
    <div class="active-bias-indicator">
        <img [src]="getBiasTypeIconUrl(bias)" [alt]="bias.type" height="20">
        <span>
            {{ getBiasLabelKey(bias, 'toward') | translate }} {{ 'pokemonType.' + bias.type | translate }}
            @if (bias.mode === 'soft' && bias.count > 1) { ×{{ bias.count }} }
        </span>
    </div>
}
@for (bias of groupedAwayBiases; track bias.type + bias.mode) {
    <div class="active-bias-indicator">
        <img [src]="getBiasTypeIconUrl(bias)" [alt]="bias.type" height="20">
        <span>
            {{ getBiasLabelKey(bias, 'away') | translate }} {{ 'pokemonType.' + bias.type | translate }}
            @if (bias.mode === 'soft' && bias.count > 1) { ×{{ bias.count }} }
        </span>
    </div>
}
```

### 1e. Check other `PendingTypeBiases` consumers

Grep for `.toward` / `.away` / `pendingTypeBiases` across the codebase
beyond the files above (there may be a save/export or stats surface that
also reads the old shape) and update any remaining `null` checks (e.g.
`if (pendingTypeBiases.toward)`) to array checks (`.length > 0`).

### Acceptance tests for Phase 1 (no UI needed — unit test level)

Using `applyTypeBias` directly:
- `toward: [{type:'electric',mode:'soft'}], away: []` on a pool containing
  one Electric (weight 1) and one Water (weight 1) Pokémon → Electric weight
  `4`, Water weight `1`.
- `toward: [{type:'electric',mode:'soft'}, {type:'electric',mode:'soft'}]` →
  Electric weight `8` (not `16`).
- `toward: [{type:'electric',mode:'soft'}, {type:'water',mode:'soft'}]` on a
  dual Electric/Water Pokémon → weight `16`; on a pure Electric Pokémon →
  weight `4`.
- `away: [{type:'fire',mode:'soft'}, {type:'fire',mode:'soft'}]` → Fire
  weight `0.125` (0.25 / 2).
- `toward: [{type:'fire',mode:'hard'}, {type:'water',mode:'hard'}]` on a pool
  of Fire/Water/Grass → result contains Fire and Water only, not Grass.
- Load a saved run with the old single-entry `pendingTypeBiases` shape
  (`{toward: {type:'fire',mode:'soft'}, away: null}`) via
  `RunPersistenceService` → confirm it restores as
  `{toward: [{type:'fire',mode:'soft'}], away: []}` without throwing.

**Stop here and check in before starting Phase 2.**

---

## Phase 2 — Use bias items inside the obtain wheels [done]

### 2a. `src/app/services/game-state-service/game-state.ts` / container

No new `GameState` values needed. In
`src/app/main-game/roulette-container/roulette-container.component.ts`, add
a state set near the top of the class (alongside existing sets like
`battleStates`):
```ts
private readonly obtainWheelStates = new Set<GameState>([
  'catch-pokemon', 'trade-pokemon', 'find-fossil', 'legendary-encounter',
  'catch-cave-pokemon', 'go-fishing', 'mysterious-egg', 'area-zero'
]);
```
(`starter-pokemon` intentionally excluded — see "Current system" note above:
the Items panel isn't shown during that screen.)

### 2b. Branch `handleTypeBiasItemUse()`

Replace `handleTypeBiasItemUse()` (`roulette-container.component.ts:591-597`)
to branch on whether the current screen is an obtain wheel:
```ts
private handleTypeBiasItemUse(item: ItemItem): void {
  if (this.obtainWheelStates.has(this.currentGameState)) {
    this.applyTypeBiasInPlace(item);
    return;
  }

  // Not on an obtain wheel yet — defer to whichever wheel comes next, same
  // as before: repeatCurrentState() re-queues the screen the player was
  // already on, so picking a type is a bonus action, not a substitute turn.
  this.gameStateService.repeatCurrentState();
  this.trainerService.removeItem(item);
  this.pendingTypeBiasItem = item;
  this.gameStateService.setNextState('select-from-type-list');
  this.finishCurrentState();
}

/**
 * Applies a bias item to the obtain wheel already on screen, via a modal
 * type-picker overlay — no GameState change, no screen reconstruction.
 * `applyBiasForItem()` (extracted from the old continueWithType() body)
 * updates TrainerService, which every obtain-wheel component is subscribed
 * to (Phase 2c) and will use to recompute + redraw its wheel live.
 */
private async applyTypeBiasInPlace(item: ItemItem): Promise<void> {
  const modalRef = await this.modalQueueService.open(SelectFromTypeListRouletteComponent, {
    centered: true,
    backdrop: 'static'
  });

  const subscription = modalRef.componentInstance.selectedTypeEvent.subscribe((type: PokemonType) => {
    this.trainerService.removeItem(item);
    this.applyBiasForItem(item, type);
    modalRef.close();
  });

  modalRef.result.finally(() => subscription.unsubscribe());
}
```

### 2c. Extract `applyBiasForItem()` from `continueWithType()`

`continueWithType()` (`roulette-container.component.ts:603-621`) currently
does both the "resume the deferred screen" bookkeeping and the actual bias
application in one method. Split out the bias-application part so
`applyTypeBiasInPlace()` (2b) can reuse it without the
`finishCurrentState()`/`pendingTypeBiasItem` bookkeeping that only applies to
the deferred (non-in-wheel) flow:
```ts
continueWithType(type: PokemonType): void {
  this.finishCurrentState();

  const item = this.pendingTypeBiasItem;
  this.pendingTypeBiasItem = null;
  if (!item) {
    return;
  }

  this.applyBiasForItem(item, type);
}

private applyBiasForItem(item: ItemItem, type: PokemonType): void {
  // Honey/Poké Radar boost TOWARD the chosen type; Repel/Max Repel steer AWAY
  // from it. Each use appends an entry (see TrainerService) rather than
  // overwriting, so repeated uses stack instead of replacing each other.
  const mode = item.name === 'poke-radar' || item.name === 'max-repel' ? 'hard' : 'soft';
  if (item.name === 'honey' || item.name === 'poke-radar') {
    this.trainerService.setTowardBias({ type, mode });
  } else {
    this.trainerService.setAwayBias({ type, mode });
  }
}
```

### 2d. Live-recompute in each of the 8 obtain-wheel components

Each component needs to: (1) keep its pre-bias candidate pool in a field,
(2) subscribe to `trainerService.getPendingTypeBiasesObservable()`, and (3)
recompute + reassign its bias-adjusted array on every emission (including
the initial one) so `<app-wheel [items]="...">` sees a new reference and
redraws per `ngOnChanges`.

**Pattern** (apply per-component with the exact field/method names in the
table below):
```ts
private sourcePokemon: PokemonItem[] = [];
private biasSubscription: Subscription | null = null;
// ...existing generationSubscription field, if the component has one...

ngOnInit(): void {
  // ...existing subscription that computes the candidate pool...
  // change its final assignment from applying bias directly to:
  //   this.sourcePokemon = <the candidate pool computation, unchanged>;
  //   this.refreshPokemon();

  this.biasSubscription = this.trainerService.getPendingTypeBiasesObservable().subscribe(() => {
    this.refreshPokemon();
  });
}

private refreshPokemon(): void {
  this.<targetField> = applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases);
}

ngOnDestroy(): void {
  this.generationSubscription?.unsubscribe(); // if present
  this.biasSubscription?.unsubscribe();
}
```

Per-file specifics:

| Component | Needs `implements OnInit, OnDestroy` added? | Target field | Notes |
|---|---|---|---|
| `pokemon-from-generation-roulette.component.ts` | already has both | `pokemon` | keep existing `filterByPower()` call feeding into `sourcePokemon` |
| `trade-pokemon-roulette.component.ts` | yes — currently computes in constructor only, no `OnInit`/`OnDestroy` | `nationalDexPokemon` | move constructor's `applyTypeBias(...)` call into `ngOnInit`; `sourcePokemon = pokemonService.getAllPokemon()` is static, no generation subscription needed |
| `fossil-roulette.component.ts` | already has both | `fossils` | |
| `legendary-roulette.component.ts` | already has both | `legendaries` | |
| `cave-pokemon-roulette.component.ts` | already has both | `cavePokemon` | |
| `fishing-roulette.component.ts` | has the methods but not the `implements` clause — add it for clarity | `fish` | |
| `mysterious-egg-roulette.component.ts` | yes — constructor-only today | `nationalDexPokemon` | same as trade: static `sourcePokemon`, no generation dependency |
| `area-zero-roulette.ts` (class `AreaZeroRoulette`) | yes — constructor-only today | `paradoxPokemon` | static `sourcePokemon = pokemonService.getPokemonByIdArray(areaZeroParadoxPokemonIds)` |

For the 3 constructor-only components (trade, mysterious-egg, area-zero),
moving the computation into `ngOnInit` means adding `OnInit`/`OnDestroy` to
the `@Component` class's `implements` clause and importing `Subscription`
from `rxjs` alongside the existing imports.

`starter-roulette.component.ts` is **not** touched in this phase (excluded
per 2a) — its bias application stays exactly as-is (computed once from
whatever bias was pending when the screen was built), since the Items panel
can't be used while it's showing anyway.

### Acceptance tests for Phase 2

Manual (via `npm start`, since this is a live-UI interaction):
1. Start a run, reach `catch-pokemon`. Click Honey in the Items panel → the
   type-picker modal opens **over** the wheel (wheel still visible
   underneath/behind, not replaced). Pick Electric → modal closes, wheel
   redraws with Electric slices visibly larger. Confirm the game state
   didn't change (no screen transition, no re-queue).
2. With the Electric bias still active, click Honey again and pick Water →
   wheel redraws again; both Electric and Water slices should now be
   enlarged (relative to a pure Normal-type Pokémon's slice), and any
   dual Electric/Water Pokémon's slice should be enlarged the most.
3. Click Honey a 3rd time on Electric again → wheel redraws once more;
   Electric's slice should grow further versus the 2-use state (stacking).
4. Repeat with Repel/Max Repel and confirm slices shrink / hard-filter
   applies live, without leaving the screen.
5. Confirm the Items-panel bias badges (Phase 1d) show the right grouped
   types with `×N` counts as items are used.
6. Confirm the pre-existing deferred flow still works unchanged when a bias
   item is used from `main-adventure` (not an obtain wheel) — screen leaves,
   type picker state, returns to the *next* wheel with the bias applied.
7. Confirm `wheelSpinning` gating still blocks item use mid-spin (should be
   unaffected — `main-game.component.ts`'s `typeBiasItemInterrupt()` already
   early-returns on `wheelSpinning`).

**Stop here and check in before starting Phase 3.**

---

## Phase 3 — Tests, docs, cleanup [done]

- Add/extend unit tests: `apply-type-bias.spec.ts` (Phase 1 cases above),
  and a `run-persistence.service.spec.ts` case for the legacy-shape
  migration if that spec file exists (check first).
- Run `npm run test:local` — full suite must pass.
- Update `README.md`'s bias-item description (search for "Honey" / "Repel" /
  "Poké Radar" in the README) to mention stacking and in-wheel usage — per
  CLAUDE.md's "README before mechanics commit" rule, this is a game-mechanics
  change.
- Update `README.md`'s "New features added on top of the original" list if
  in-wheel bias usage counts as a new user-facing feature (it does — new
  interaction surface).
- Delete the two backlog entries this plan implements from
  `docs/todo/backlog.md` ("Type-bias items should stack when multiple are
  used" and "Use bias items inside the obtain wheels, with visual feedback").
- Move this file to `docs/plans/done/bias-items-stacking-and-in-wheel-use.md`
  once all phases are checked off.
