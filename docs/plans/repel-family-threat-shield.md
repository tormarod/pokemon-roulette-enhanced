# Repel & Max Repel → New-Experience threat-avoidance items

**Status:** Not started. Phases are checkpointed — stop for owner review after each.

## Decisions (locked with owner)

- **Repel and Max Repel stop being catch-steering items and become threat-avoidance items**, matching the real-game fantasy (Repel avoids encounters, not catches). The current soft/hard "avoid a catch type" is near-useless — steering away from a type on a wide catch wheel barely moves the odds, same root problem the deleted Repel had.
- **Repel = next 1 adventure step is threat-free. Max Repel = next 3** (longer shield mirrors the real-game duration difference). Consumed proactively from the item bar (any time items are available), like other consumables.
- **No type picker** — real repels are blanket. These items no longer open `SelectFromTypeListRouletteComponent`.
- **New-Experience-only** (Classic has no threats/danger meter). Precedent: Revive is already NE-only. Classic loses Repel/Max Repel entirely.
- **Delay only, never defuse.** A shielded step skips the threat but must **never cool** the danger meter (danger keeps climbing underneath). This needs a dedicated shield counter, *not* the existing `guaranteedRewardSteps` path — that path runs `recoverTo(round)`, which pulls danger toward the round baseline and would cool a spike (e.g. right after "Spooked"). The shield must leave danger climbing-only.
- **Ordering:** land this **after** `honey-target-share-market.md`. That plan moves Honey off the soft-toward path; once it has, Phase 3 here can delete the whole soft machinery cleanly. (Phases 1–2 are order-independent; only the Phase 3 cleanup assumes Honey has shipped.)

## Why this is a good fit (current system)

- **New Experience adventure loop** (`MainAdventureRouletteComponent`): each step, `DangerMeterService.rollStep(round)` returns `reward` (draw 3 candidates to choose) or `threat` (one forced, punishing encounter from a 10-item `threatPool` — Team Rocket Ambush, Item Theft, Forced Retreat, Bad Omen, Spooked, Marked Target, Pokéball Malfunction, Toll Booth, Scouting Report, PC Lockout). Threats are the thing a Repel should avoid.
- **The shield primitive already half-exists.** `DangerMeterService` (`src/app/services/danger-meter-service/danger-meter.service.ts`):
  - State `{ dangerPercent, consecutiveThreats, guaranteedRewardSteps }` (line 6).
  - `rollStep(round)` (81): consumes `guaranteedRewardSteps` first (with `recoverTo` — **cools/normalizes danger**, which is why we can't reuse it), then hard-pity, then the danger roll.
  - `addGuaranteedRewardSteps(count)` (120), `isNextStepGuaranteedSafe()` (144), `resetForNewRun()` (149), `restore(dangerPercent, consecutiveThreats, guaranteedRewardSteps=0)` (153).
  - Constants: `BASE=5, CURVE=5, CAP=70, RELIEF=20, RECOVERY=15, FLOOR=5, PITY=3, SPIKE=30`. `base(round)=min(CAP, BASE+CURVE*round^2)`, `recoverTo(round)=min(base(round), danger+RECOVERY)`.
- **Persistence** (`run-persistence.service.ts`): `PersistedRun` carries `dangerPercent`/`consecutiveThreats`/`guaranteedRewardSteps` (34–36); written 117–119; restored 210 (`restore(... ?? defaults)`); validated 264–266.
- **Item-use dispatch** (`ItemsComponent.useItem`, `src/app/items/items.component.ts:56`): routes by name — `rare-candy`→rareCandyInterrupt, mega stones→megaStoneInterrupt, `link-cable`→linkCableInterrupt, and `TYPE_BIAS_ITEM_NAMES = {honey, poke-radar, repel, max-repel}` (line 40)→typeBiasItemInterrupt. Each `@Output` interrupt bubbles to `MainGameComponent` (`main-game.component.ts:183` etc.), which forwards to the matching trigger service; `RouletteContainerComponent` subscribes to that service (e.g. `typeBiasItemSubscription`, line 221). **Follow the `link-cable` chain as the template** (LinkCableService → linkCableInterrupt → triggerLinkCable → container subscription → handler).
- **NE-only item filter:** `ItemsService.getRegularItems()` (`items.service.ts:46`) filters `revive` out unless `isNewExperienceMode`.
- **Type-bias "away" branch** (removed in Phase 3): `PendingTypeBiases.away` + `setAwayBias` (`trainer.service.ts`), and in `apply-type-bias.ts` the hard-away filter + soft-away weight (`AWAY_SOFT_BASE_MULTIPLIER`, `applySoftWeight`/`softMultiplier` away half, `cancelOpposingSoftCounts`). After this rework nothing produces an `away` bias; after the Honey plan nothing produces a soft bias at all.

---

## Phase 1 — Danger-meter shield primitive (delay-only)

Pure engine + persistence; no item wiring yet.

**`danger-meter.service.ts`:**
- Add `shieldedSteps: number` to `DangerMeterState` (default 0). Doc-comment: "Player-triggered threat shields from Repel/Max Repel. Unlike `guaranteedRewardSteps`, a shielded step is **delay-only**: it skips the threat and lets danger climb toward `base(round)` but **never cools** it — a spike is never refunded."
- In `rollStep`, add a **first** branch (before the `guaranteedRewardSteps` branch):
  ```ts
  if (current.shieldedSteps > 0) {
    this.state.next({
      dangerPercent: Math.max(current.dangerPercent, this.recoverTo(round)), // climb-only, never cool
      consecutiveThreats: 0,
      guaranteedRewardSteps: current.guaranteedRewardSteps,
      shieldedSteps: current.shieldedSteps - 1
    });
    return 'reward';
  }
  ```
  (`Math.max(current, recoverTo)` climbs toward `base(round)` if below it, holds if above — so danger is never reduced.)
- Add `addThreatShield(count: number): void` → `next({ ...current, shieldedSteps: current.shieldedSteps + count })`.
- `isNextStepGuaranteedSafe()`: also return true when `shieldedSteps > 0`.
- `resetForNewRun()`: include `shieldedSteps: 0`. `restore(...)`: add a `shieldedSteps = 0` param and set it. Update the initial `BehaviorSubject` default (line 40) and `applySpike`/`addGuaranteedRewardSteps` to carry the new field (they spread `...current`, so verify they don't drop it).

**`run-persistence.service.ts`:**
- `PersistedRun`: add `shieldedSteps: number;`.
- Persist payload: `shieldedSteps: dangerMeterState.shieldedSteps`.
- `restore(...)` call (210): pass `run.shieldedSteps ?? 0` as the new arg.
- Validation (264–266): add `(run.shieldedSteps === undefined || typeof run.shieldedSteps === 'number')`.

**Specs:**
- `danger-meter.service.spec.ts`: `addThreatShield` grants; a shielded `rollStep` returns `'reward'` and **does not lower** a spiked meter (`applySpike` to push above `base(round)`, then `rollStep`, assert `dangerPercent` unchanged); shielded steps are consumed before `guaranteedRewardSteps`; `isNextStepGuaranteedSafe()` true while shielded.
- `run-persistence.service.spec.ts`: `shieldedSteps` round-trips; missing field restores to 0.

**Acceptance:** `npm run test:local` green; shield never cools danger; survives reload.

**Checkpoint — stop for review.**

---

## Phase 2 — Rewire Repel / Max Repel as shield items

**New `ThreatShieldService`** (`src/app/services/threat-shield-service/threat-shield.service.ts`) — copy `LinkCableService`/`TypeBiasItemService` shape: `private subject = new Subject<ItemItem>()`, `get threatShieldTrigger$()`, `triggerThreatShield(item: ItemItem)`.

**`ItemsComponent`:**
- Remove `'repel'`, `'max-repel'` from `TYPE_BIAS_ITEM_NAMES` (leaves `{honey, poke-radar}`).
- Add `private static readonly THREAT_SHIELD_ITEM_NAMES = new Set(['repel', 'max-repel']);`
- Add `@Output() threatShieldInterrupt = new EventEmitter<ItemItem>();` and a `useItem` branch routing those names to it.
- `items.component.html`: add the `(threatShieldInterrupt)` wiring the same way `linkCableInterrupt` is bound (if the template binds outputs explicitly).

**`MainGameComponent`:** inject `ThreatShieldService`; add `threatShieldInterrupt(item)` (guard `wheelSpinning`/`itemsAvailable` like `linkCableInterrupt`) → `this.threatShieldService.triggerThreatShield(item)`. Bind `(threatShieldInterrupt)` on `<app-items>` in `main-game.component.html`.

**`RouletteContainerComponent`:** inject `DangerMeterService`; subscribe to `threatShieldService.threatShieldTrigger$` in `ngOnInit` (mirror the `typeBiasItemSubscription`, line 221; unsubscribe in `ngOnDestroy`) → `handleThreatShieldUse(item)`:
```ts
private handleThreatShieldUse(item: ItemItem): void {
  if (!this.gameStateService.isNewExperienceMode) return; // NE-only safety net
  const count = item.name === 'max-repel' ? 3 : 1;
  this.dangerMeterService.addThreatShield(count);   // grant BEFORE removeItem so the save captures it
  this.trainerService.removeItem(item);
  // Optional but recommended: brief confirmation modal ("Repel active — your next N encounters are safe").
}
```
This is a bonus action — **no** `repeatCurrentState()` (it doesn't consume a wheel/turn, just mutates the danger meter). `removeItem` triggers the mutation-based persistence save, which now snapshots `shieldedSteps`.

**`ItemsService.getRegularItems()`:** make the NE-only filter a set: `const NE_ONLY = new Set<RegularItemName>(['revive', 'repel', 'max-repel']); return Object.values(this.regularItemsData).filter(i => !NE_ONLY.has(i.name as RegularItemName) || this.gameStateService.isNewExperienceMode);` Update the doc-comment.

**`RouletteContainerComponent.applyBiasForItem`:** now only `honey` (→ `addHoneyUse`, from the Honey plan) and `poke-radar` (→ hard toward) remain. Remove the `repel`/`max-repel` (`setAwayBias`) branches. (If the Honey plan hasn't shipped yet, keep its existing honey branch untouched and only drop repel/max-repel.)

**i18n** — rewrite `items.repel.description` and `items.max-repel.description` in all 6 locales:
- repel: "Use Repel to keep your **next adventure step** threat-free — walk safely past one encounter. (New Experience only.)"
- max-repel: "Use Max Repel to keep your **next 3 adventure steps** threat-free. (New Experience only.)"

**Specs:**
- `items.component.spec.ts`: `repel`/`max-repel` now emit `threatShieldInterrupt`, not `typeBiasItemInterrupt`.
- `items.service.spec.ts`: mirror the revive tests — `repel`/`max-repel` excluded from `getRegularItems()` in Classic, included in NE.
- `roulette-container.component.spec.ts`: remove the `handleTypeBiasItemUse(REPEL)` / `(MAX_REPEL)` cases; add `handleThreatShieldUse` cases (Repel grants 1, Max Repel grants 3, item removed, no-op when not NE).

**README:** update the Repel/Max Repel feature description (threat-avoidance, NE-only).

**Acceptance:** in NE, using Repel makes the next adventure step a reward (no threat); Max Repel covers 3; danger keeps climbing; the shielded-state indicator (`isNextStepGuaranteedSafe`) lights up; items don't appear in Classic. `npm run test:local` green.

**Checkpoint — stop for review.**

---

## Phase 3 — Remove the dead type-bias "away" branch (+ now-dead soft machinery)

Assumes the Honey plan has shipped (so nothing produces a soft-toward bias either). If it hasn't, do only the `away` removal and leave the soft-toward path for the Honey plan.

**`trainer.service.ts`:** remove `away` from `PendingTypeBiases`, remove `setAwayBias`, drop `away` from `NO_PENDING_TYPE_BIASES` and any restore/normalize. (Resulting shape: `{ toward, honey }`.)

**`apply-type-bias.ts`:** remove the hard-away filter and the entire soft path — `AWAY_SOFT_BASE_MULTIPLIER`, `TOWARD_SOFT_BASE_MULTIPLIER`, `applySoftWeight`, `softMultiplier`, `cancelOpposingSoftCounts`, `countByType`, `setOrDelete`. Engine reduces to: hard-toward filter (Poké Radar) → Honey target-share block → `tagBiasVisuals` (dimmed set is now always empty; simplify the visual tagging to highlight-only).

**`run-persistence.service.ts`:** `normalizePendingTypeBiases` drops `away`.

**Specs:** `apply-type-bias.spec.ts` — delete all away/soft/cancellation tests; keep hard-toward + honey + highlight tests. Update any remaining `PendingTypeBiases` literals across specs to the `{ toward, honey }` shape.

**Acceptance:** `npm run test:local` green; `grep -n "away\|setAwayBias\|SOFT" src/app/services/trainer-service/` is clean; Honey + Poké Radar unaffected.

**Checkpoint — stop for review.**

---

## Phase 4 — Release notes / version / README

- If shipping in the same release as the Honey plan, **fold into that plan's `v3_11_0`** What's-New entry (don't bump twice) — add note keys for the Repel/Max Repel rework. Otherwise create the next `v3_x_y` entry per the repo release-notes rules (`RELEASE_NOTES`, `package.json`, `whatsNew.*` keys in all 6 locales, version label).
- README "New features" changelog line: Repel/Max Repel are now NE threat-avoidance items.

**Acceptance:** What's-New shows the rework; build green.

**Checkpoint — done. Move to `docs/plans/done/` once all phases (and the Honey plan) have shipped.**

---

## Open options (not blocking; confirm if you want them in)

- **Sell Repel in the Market?** It's now a useful NE consumable; a cheap Market price (e.g. ~20 coins) would fit, with Max Repel left as a rarer found item. Default: **not** in the Market (found only) unless you say otherwise.
- **Confirmation modal on use.** Recommended for feedback ("Repel active — next N encounters safe"), but the existing shielded-state UI may be enough. Default: add a small info modal.
