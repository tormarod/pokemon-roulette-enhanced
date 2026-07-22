# Honey rework (target-share, up to 3 types) + Honey in Market

**Status:** All phases done (shipped as v3.12.0, since v3.11.0 was already used by `endgame-rebalance.md`).

**Note (post-Phase-1):** MainGameComponent's toward/away bias badge strip (not in the original "current system" section below) needed a matching update — Honey moving off `toward` onto its own `honey` field meant it would silently stop showing any badge. Owner chose to add a parallel `groupedHoneyBiases`/`game.main.activeBias.honey` badge (`main-game.component.ts`/`.html`, all 6 locales) so a pending Honey use stays visible before a wheel is on screen. Phase 2 must keep this working when Honey moves to multi-type: `groupHoneyBiases()` already unions all types across all pending uses, so no shape change needed there, just re-verify.

## Decisions (locked with owner)

- **Repel and Max Repel are NOT touched by this plan.** They are being reworked into New-Experience threat-avoidance items in a separate plan — `docs/plans/repel-family-threat-shield.md` — which also removes the type-bias engine's entire "away" branch. This plan stays purely on Honey and is **additive** to the bias engine (leaves soft/away machinery in place for the repel plan to remove). The two plans are order-independent.
- **Honey becomes a target-share item.** It tilts the obtain wheel so the chosen type(s) collectively occupy a **target share of the wheel (55% for a single Honey use)**, *computed live from the current pool at spin time*. This is the key fix: a fixed additive weight (`+30`) or the old fixed multiplier (`x10`) drifts with pool size (`+30` ≈ 49% early but ≈ 29% late). A target share holds ~55% at every stage because the added weight is recomputed from the live pool.
- **Honey selects up to 3 types.** The 55% target is spread across the chosen set — pick 1 type for precision, or up to 3 to hedge *which* type you land (still ~55% to catch one of them). This is the "divide the potency" the owner asked for: the same wheel-share, split across more types.
- **Honey is sold in the Market** (New Experience only, like the rest of the Market). Recommended price **45 coins** (between super-potion 40 and hyper-potion 55) — tunable.

### Math the numbers are based on (why 55% is stable)

Obtain-wheel pool (`PokemonFromGenerationRouletteComponent.filterByPower`) averaged across all 9 generations:

| Stage | Pool size T | Typical count of one type c |
|---|---|---|
| Early (round < 2, power 1) | ~36 | ~3 |
| Mid (round < 4, power ≤ 2) | ~69 | ~5 |
| Late (round ≥ 4, all) | ~101 | ~8 |

Target-share formula (base weight is 1 per Pokémon): to make the chosen set K occupy share `S` of the wheel, set every K-matching Pokémon to weight `w = (S/(1-S)) * (nonK / countK)`, leaving non-K at weight 1. Then `countK*w / (countK*w + nonK) = S` exactly, for any T. So it self-adjusts (small boost early, large late) and always lands on S.

## Design (final)

**Stacking (diminishing returns toward a hard ceiling):** `n` = number of Honey uses currently pending; `K` = union of all their chosen types. Effective target `S = CAP * (1 - (1 - s1/CAP)^n)` where `s1 = 0.55` (single-use share) and `CAP = 0.75` (the hard ceiling). This gives n=1 → 55%, n=2 → ~70%, n=3 → ~74%, n≥4 → ~75% and **never crosses 75%** no matter how many Honeys stack. The ceiling is deliberate: it makes **Poké Radar the only route to a guaranteed catch**, so no amount of Market spending on Honey can replicate it (Honey = buyable/very-likely/multi-type; Radar = scarce/certain/single-type). One Honey use may carry 1–3 types; all its types join K.

**Distribution:** every pool Pokémon matching *any* type in K gets the same boosted weight `w` (per-Pokémon-equal). Dual-type mons matching K are boosted once. Consequence: within K, a type with more Pokémon in the pool is proportionally likelier — acceptable and natural ("55% to get one of your 3 types"). We do **not** attempt exact per-type-equal shares (dual-type overlaps make that fiddly for no real gain).

**Guards:** if `countK === 0` (Poké Radar already filtered K out, or none in pool) or `nonK === 0` (pool is all K), Honey is a no-op.

## Current system (so an execution session needn't re-research)

- **Bias data model** — `PendingTypeBiases` in `src/app/services/trainer-service/trainer.service.ts:38`:
  ```ts
  export interface TypeBiasEntry { type: PokemonType; mode: 'soft' | 'hard'; }  // line 20
  export interface PendingTypeBiases { toward: TypeBiasEntry[]; away: TypeBiasEntry[]; }
  const NO_PENDING_TYPE_BIASES: PendingTypeBiases = { toward: [], away: [] };     // line 43
  ```
  Producers: `setTowardBias(entry)` (259), `setAwayBias(entry)` (266), `restorePendingTypeBiases` (274), `clearPendingTypeBiases` (278), getter `currentPendingTypeBiases` (250), observable `getPendingTypeBiasesObservable` (254).
- **Bias engine** — `applyTypeBias(pokemon, biases)` in `src/app/services/trainer-service/apply-type-bias.ts`. Today: hard toward filter (OR, skip-if-empties), hard away filter, then **soft** weight math (`TOWARD_SOFT_BASE_MULTIPLIER=10`, `AWAY_SOFT_BASE_MULTIPLIER=0.1`, `applySoftWeight`, `softMultiplier`, `cancelOpposingSoftCounts`, `countByType`, `setOrDelete`), then `tagBiasVisuals` (highlighted/dimmed). Called by every obtain-wheel component via `applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases)` (e.g. `pokemon-from-generation-roulette.component.ts:59`).
- **Item → bias wiring** — `RouletteContainerComponent` (`src/app/main-game/roulette-container/roulette-container.component.ts`):
  - `handleTypeBiasItemUse` (748): in-wheel → `applyTypeBiasInPlace`; else defers to a `select-from-type-list` screen.
  - `applyTypeBiasInPlace` (768): opens `SelectFromTypeListRouletteComponent` as a modal, subscribes `selectedTypeEvent`.
  - `continueWithType` (787): the deferred-screen callback.
  - `applyBiasForItem` (804): `mode = poke-radar|max-repel ? 'hard' : 'soft'`; `honey|poke-radar → setTowardBias`, else `setAwayBias`. Honey moves out of this in Phase 1; `poke-radar`/`repel`/`max-repel` stay.
- **Type picker** — `SelectFromTypeListRouletteComponent` (`.../roulettes/select-from-type-list-roulette/`): single instant pick, `@Output() selectedTypeEvent = new EventEmitter<PokemonType>()`, `@Input() screenTitle`. Template renders a button grid; `roulette-action-row` is empty.
- **Item definitions** — `itemsData` (`src/app/services/items-service/items-data.ts`), name union `RegularItemName` (`.../items-service/regular-item-names.ts`). Find-wheel inventory via `ItemsService.getRegularItems()` (`items.service.ts:46`).
- **Market** — stock built in `MarketComponent.buildStock` (`src/app/trainer-team/market/market.component.ts:156`); prices in `MARKET_PRICES` (`src/app/main-game/roulette-container/economy-config.ts:56`); `MarketEntryId = keyof typeof MARKET_PRICES`.
- **Persistence** — `RunPersistenceService` (`.../run-persistence-service/run-persistence.service.ts`) serializes `pendingTypeBiases` (line 114) and restores via `normalizePendingTypeBiases` (220) / `normalizeBiasDirection` (228).
- **Coordination:** the open plan `docs/plans/economy-market-reconciliation.md` **Phase 1** (not yet shipped) lists `honey` as Find-Item-only — must be reconciled when Honey enters the Market (Phase 3 below).
- Current version `package.json` = **3.10.0**.

---

## Phase 1 — Bias engine: add target-share Honey (additive; Repel/Max Repel untouched) — DONE

Purely **additive** to the type-bias engine — it does **not** remove the soft/away machinery (Repel still uses soft-away, Max Repel still uses hard-away; both are removed in `repel-family-threat-shield.md`). Honey is wired single-type here (reusing the existing single-pick UI); multi-select is Phase 2 — single-type Honey already gets the 55% target-share buff.

**`src/app/services/trainer-service/trainer.service.ts`:**
- `PendingTypeBiases`: add `honey: PokemonType[][];`. `NO_PENDING_TYPE_BIASES = { toward: [], away: [], honey: [] };`
- Add `addHoneyUse(types: PokemonType[]): void` → append `types` to `pendingTypeBiases.honey` via `updatePendingTypeBiases` (mirror `setTowardBias`).
- `TypeBiasEntry.mode` stays `'soft' | 'hard'`; `setTowardBias`/`setAwayBias` unchanged (Repel still soft-away).
- `clearPendingTypeBiases` / `restorePendingTypeBiases` carry `honey` (they spread `NO_PENDING` / the passed object — fine once the shape includes it).

**`src/app/services/trainer-service/apply-type-bias.ts`** — keep all existing hard/soft/cancellation handling; only **add** a Honey block:
- Add constants: `export const HONEY_TARGET_SHARE = 0.55;`, `export const HONEY_STACK_CAP = 0.75;`, `export const HONEY_MAX_TYPES = 3;`
- After the existing soft-weight step and **before** `tagBiasVisuals`, insert:
  - `const n = biases.honey.length; const K = new Set(biases.honey.flat());`
  - if `n > 0 && K.size > 0`:
    - `const S = HONEY_STACK_CAP * (1 - Math.pow(1 - HONEY_TARGET_SHARE / HONEY_STACK_CAP, n));` (n=1 → 0.55; asymptotes to 0.75, never above)
    - `const countK = result.filter(p => matchesAnyType(p, K)).length; const nonK = result.length - countK;`
    - if `countK > 0 && nonK > 0`: `const w = (S / (1 - S)) * (nonK / countK); result = result.map(p => matchesAnyType(p, K) ? { ...p, weight: w } : p);`
  - Honey runs after soft-away and **assigns** weight (base is 1). Honey and Repel targeting the *same* type is a cross-family non-goal (different item families, different domains after the repel rework) — don't add special handling.
- Visuals: extend the toward highlight set to include Honey types — pass `new Set([...towardTypes, ...K])` (or equivalent) into `tagBiasVisuals`.
- Keep `matchesAnyType`, `matchesType`, `tagBiasVisuals`, and all soft helpers.

**`src/app/main-game/roulette-container/roulette-container.component.ts` — `applyBiasForItem` (804):** route Honey to the new field; leave the others exactly as today:
```ts
private applyBiasForItem(item: ItemItem, type: PokemonType): void {
  if (item.name === 'honey') { this.trainerService.addHoneyUse([type]); return; }
  const mode = item.name === 'poke-radar' || item.name === 'max-repel' ? 'hard' : 'soft';
  if (item.name === 'poke-radar') {
    this.trainerService.setTowardBias({ type, mode });
  } else { // repel (soft) or max-repel (hard)
    this.trainerService.setAwayBias({ type, mode });
  }
}
```

**`src/app/services/run-persistence-service/run-persistence.service.ts`:**
- `normalizePendingTypeBiases` (220): return `{ toward, away, honey }`. `toward`/`away` unchanged (keep `normalizeBiasDirection`); `honey = Array.isArray(record.honey) ? record.honey.filter(Array.isArray) : []`.

**Honey i18n description** (interim, single-type wording) — `items.honey.description` in all 6 locales:
> "Use Honey to make your chosen type about 55% of your next wild Pokémon wheel — works on a wheel already on screen, and stacks (up to ~75%) if used again."

**`apply-type-bias.spec.ts`:** keep all existing tests (the engine still supports soft/away). Add `honey: []` to every existing `PendingTypeBiases` literal. Add honey tests:
- single `honey: [['fire']]` on pools of 20 and 100 mons → Fire set-share ≈ 0.55 (assert `countK*w/(countK*w+nonK)` within 1e-6). Proves pool-size stability.
- `n=2` (`honey: [['fire'],['water']]`) → set share ≈ `0.75*(1-(1-0.55/0.75)^2)` ≈ 0.697.
- ceiling: large `n` (e.g. 8) → set share ≤ 0.75.
- guard: honey type absent from pool → passthrough unchanged.
- visual: honey-matching mons `highlighted === true`.

**Other specs** (`trainer.service.spec.ts`, `run-persistence.service.spec.ts`, `roulette-container.component.spec.ts`, `main-game.component.spec.ts`): add `honey: []` to `PendingTypeBiases` literals; the container spec's honey case asserts `addHoneyUse([type])` instead of `setTowardBias`.

**README:** update the Honey feature line to the target-share behavior. (Repel/Max Repel unchanged here.)

**Acceptance:**
- `npm run test:local` green.
- New unit test proves single-type Honey ≈ 55% at small and large pool sizes; stacking ceiling ≤ 75%.
- Manual: Honey in-wheel → chosen type ~half the wheel; Poké Radar / Repel / Max Repel behave exactly as before.

**Checkpoint — stop for review.**

---

## Phase 2 — Multi-select type picker (Honey: up to 3 types) — DONE

**Note (post-Phase-2):** the plain white `box-shadow` ring specced for the selected state was invisible against this modal's white background (verified in-browser) — replaced with a green checkmark badge (`::after` content), which stays legible regardless of button/modal color.

**`SelectFromTypeListRouletteComponent`:**
- Add `@Input() maxSelections = 1;` and `@Output() selectedTypesEvent = new EventEmitter<PokemonType[]>();` Keep `selectedTypeEvent` removed/replaced — migrate callers to the array output.
- State `selected: PokemonType[] = []`. Click handler `toggleType(type)`:
  - If `maxSelections === 1`: emit `[type]` immediately (preserves current instant UX for Poké Radar / Max Repel).
  - Else: toggle membership; block adding past `maxSelections`; do **not** auto-emit.
- Add a Confirm button (only rendered when `maxSelections > 1`), disabled while `selected.length === 0`, emits `selectedTypesEvent.emit([...selected])`.
- Template: mark selected buttons (e.g. `[class.selected]`), show `selected.length`/`maxSelections`, add Confirm in the empty `roulette-action-row`. Add matching CSS for the selected state + button.
- New title key for the Honey case, e.g. `game.main.roulette.typeBias.whichHoney` = "Which types? (up to 3)" in all 6 locales; Poké Radar / Max Repel keep `typeBias.which`.

**`roulette-container.component.ts`:**
- `applyTypeBiasInPlace` and the deferred screen: set `componentInstance.maxSelections = item.name === 'honey' ? HONEY_MAX_TYPES : 1;` and the Honey title key; subscribe to `selectedTypesEvent` instead of `selectedTypeEvent`.
- `applyBiasForItem(item, types: PokemonType[])`: honey → `addHoneyUse(types)`; poke-radar → `setTowardBias({ type: types[0], mode: 'hard' })`; max-repel → `setAwayBias({ type: types[0], mode: 'hard' })`.
- `continueWithType` → rename/retype to accept `PokemonType[]`; update the `select-from-type-list` template binding to `(selectedTypesEvent)="continueWithType($event)"` and `[maxSelections]="honeyPendingMaxSelections"` (a getter returning 3 when `pendingTypeBiasItem?.name === 'honey'`, else 1).

**Honey i18n description** (final) — update all 6 to mention up to 3 types:
> "Use Honey to steer your next wild Pokémon toward up to 3 types you choose — the wheel tilts so your picks make up about 55% of it (split across them). Works on a wheel already on screen, and stacks if used again."

**README:** note Honey supports up to 3 types.

**Acceptance:**
- Honey opens a multi-pick screen; selecting 3 types → all three highlighted on the wheel, set share ≈ 55%; selecting 1 behaves as Phase 1.
- Poké Radar / Max Repel still single instant pick.
- `npm run test:local` green (update `select-from-type-list-roulette.component.spec.ts` + container spec for the array output).

**Checkpoint — stop for review.**

---

## Phase 3 — Market: sell Honey — DONE

- `economy-config.ts` `MARKET_PRICES`: add `'honey': 45,` (tunable). This makes `'honey'` a valid `MarketEntryId` automatically.
- `market.component.ts` `buildStock` (156): add `{ id: 'honey', itemName: 'honey' }` to the `items` array.
- `market.component.spec.ts`: extend stock-list expectations to include honey.
- **Reconcile `docs/plans/economy-market-reconciliation.md` Phase 1:** honey is now Market-sold — remove it from that phase's "Find-Item-only" enumerations and add it to the Market-sold exclusion list. If that phase derives its exclusion list programmatically from Market stock, it will pick up honey automatically once implemented — but fix the enumerated prose either way so the two plans don't contradict.

**Acceptance:** Honey purchasable in the Market (New Experience) at 45 coins; `npm run test:local` green; the two plan docs no longer contradict each other on honey.

**Checkpoint — stop for review.**

---

## Phase 4 — Release notes, version bump, docs — DONE

**Note (post-Phase-4):** shipped as **v3.12.0**, not v3.11.0 as originally written — that number was already consumed by `endgame-rebalance.md`'s "Rebalance endgame battle math" release before this plan's Phase 4 ran.

- `package.json`: `3.10.0` → `3.11.0`.
- `src/app/data/release-notes.ts`: newest-first `v3_11_0` entry with `whatsNew.v3_11_0.*` keys covering: Honey reworked (up to 3 types, ~55% wheel share, buyable in the Market).
- All 6 i18n: add the `whatsNew.v3_11_0.*` note keys (en real, others English placeholder) + a `v3_11_0` version label.
- README "New features added on top of the original": add the Honey rework + Honey-in-Market changelog line.

**Note on versioning:** if the repel-family rework ships in the same release, combine both into one `v3_11_0` What's-New entry rather than bumping twice. Coordinate whichever plan lands second.

**Acceptance:** What's-New modal shows the v3.11.0 entry for a returning visitor; production build green; `CURRENT_VERSION` derives to 3.11.0.

**Checkpoint — done. Move this file to `docs/plans/done/`.**

---

## Open sub-decision to confirm before Phase 2

- **Split rule** = *conserved set-share* (chosen SET ≈ 55% however many types picked; each individual type gets a smaller slice). This is baked in above and matches "divide the potency across the types you pick." If the owner instead wants spreading to genuinely *cost* total odds (each of 3 types targets 55%/3 individually), say so and Phase 1 step 3 changes to per-type target allocation.
