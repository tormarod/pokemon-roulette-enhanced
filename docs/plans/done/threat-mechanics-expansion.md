# Plan: Threat-mechanics expansion (New Experience mode)

Status: **Implemented.**
Owner: tormarod
Last updated: 2026-07-21

## Why

The New Experience threat pool (`MainAdventureRouletteComponent.threatPool`) currently
has 7 entries, none of which touch the **coin economy** (added later, see
`docs/plans/done/economy-and-market.md`). This plan adds three new threats that each hit
a distinct lever — money, battle type-matchup, and PC access — plus one global
difficulty tweak to the danger meter, and closes a costless-no-op hole in the threat draw.

All work is gated behind New Experience mode, same as the rest of the threat pool.
Classic mode is entirely unaffected.

### The threat design guardrail (do not violate)

Every threat must impose a **real, luck-independent cost in the common case**. A threat
that becomes a costless no-op depending on run state is not acceptable — that is why
`pcBreakIn` was removed after shipping (see `docs/plans/done/adventure-threats-rework.md`).
Phase 1 hardens this: instead of drawing an inapplicable threat and no-oping (which also
leaks free danger relief — see Phase 1's Why), ineligible threats are filtered out of the
draw so a threat step always lands something real.

## New threats (after this plan → 10-entry pool)

| id | difficulty | effect |
|---|---|---|
| `tollBooth` | mild | Lose `15 + 3·round` coins. If the wallet can't cover it, take what's there and apply a danger-meter spike scaled to the shortfall (+5/+10/+15). |
| `scoutingReport` | medium | The next real battle's opponent **gains one extra type** — a random type super-effective against your strongest Pokémon's type (roster **+** PC). Recomputes the whole team's matchup; shown in the matchup strip. |
| `pcLockout` | medium | The PC is frozen **both directions** (no withdraw, no deposit/bench) for the next combat round. Filtered out of the draw when you own ≤1 Pokémon total. |

New entries get `weight: 1` provisionally. **Weights are NOT final** — see Phase 5; the
whole pool (reward vs threat frequency and per-threat weights) is re-tuned once these land.

## Decisions locked (2026-07-21)

- **Toll amount:** round-scaled `15 + 3·round` (matches `economy-config` win-reward scaling).
- **Toll short/empty wallet:** take `min(balance, toll)`, then a danger spike scaled by how
  much of the toll went **unpaid** (fraction of the toll): `≤1/3 → +5`, `≤2/3 → +10`, `>2/3 → +15`,
  `0 unpaid → no spike`. Thresholds are tunable. (Being 1 coin short must NOT cost the same
  as being flat broke — that was the whole point.)
- **Scouting Report type selection:** **pure random** among the super-effective counters of
  the ace's type. Not "meanest," not "harmful-random" — see Phase 5's backlog note for the
  future option to upgrade the selection rule.
- **Scouting "strongest":** highest `power` across `trainerTeam` **+** `storedPokemon`
  combined, computed and **locked at draw time** (so stashing your ace in the PC afterward
  can't relabel who's targeted). Benching the ace for the battle is legitimate counterplay
  with a cost, not a free dodge.
- **Ineligible-threat handling (Phase 1):** filter ineligible threats out of the draw pool
  rather than drawing then no-oping. `pcLockout` excluded when `team + storage <= 1`;
  `forcedRetreat`/`markedTarget` excluded when `team <= 1` (this also fixes the existing
  costless-no-op hole in those two shipped threats). The eligible pool is never empty because
  `tollBooth`/`spooked`/`badOmen` are always applicable. The `doNothing()` gates in the
  handlers stay as a defensive fallback.
- **Danger meter:** `RECOVERY` 10 → 15.

---

## Current system (so an execution session needn't re-research)

- **Threat pool + routing:** `main-adventure-roulette.component.ts`. Entries are
  `{ id, textKey, fillStyle, weight }` in `threatPool` (line ~130). Each threat has an
  `@Output() <id>Event` (lines ~55-60) and an `actionHandlers[id]` entry (line ~145) that
  emits it. A threat step draws one entry via `drawWeightedOne(this.threatPool)` in
  `initializeDraw()` (line ~238) and routes it through `routeCandidate` → the matching
  `@Output`. `roulette-container.component.html` binds each `(<id>Event)="<handler>()"`.
- **Danger-step timing (matters for Phase 1):** `initializeDraw()` calls
  `dangerMeterService.rollStep(...)` (line ~234) — committing the threat's danger relief and
  `consecutiveThreats++` — **before** the specific threat id is drawn. There is no refund, so
  a threat that later no-ops has already spent the meter relief.
- **Threat handlers** live in `roulette-container.component.ts` (see existing `badOmen()`,
  `spooked()`, `markedTarget()`). They read run state via injected services, apply the
  effect, open an info modal via `modalQueueService.open(this.infoModal, …)` using
  `infoModalTitle`/`infoModalMessage`, and end with `doNothing()` (which is just
  `finishCurrentState()`, line ~518). `TrainerService`, `DangerMeterService`,
  `TranslateService`, `ModalQueueService` are already injected there.
- **Pending-effect services** (mirror these exactly for the two new stateful threats):
  `BattleDebuffService` (a `number`), `MarkedTargetService` (a `number | null`). Each is a
  root service wrapping a `BehaviorSubject` with `get current*`, `set*`, `clear*`,
  `restore*`, and `get*Observable()`; persisted in `RunPersistenceService`.
- **Battle-effect clear point:** `BaseBattleRouletteComponent.finishBattleCleanup()`
  (`base-battle-roulette.component.ts:320`) already calls `clearForcedRetreatLock()`,
  `clearMark()`, `clearDebuff()` once the battle result is known. New per-battle effects
  clear here too.
- **Odds computation (one source, three consumers):** `BattleOddsService.computeOdds()`.
  Called from (a) `BaseBattleRouletteComponent.buildVictoryOdds()` (the wheel), (b)
  `battle-prep-panel.component.ts:63` (live win-% preview), and the matchup strip reads the
  same `opponentTypes`. All three receive `opponentTypes` from each battle subclass's
  `protected get opponentTypes()` getter (`gym`/`rival`/`elite-four`/`champion`
  `*-battle-roulette.component.ts`). To keep them in sync, inject the scouting type at a
  single base-level wrapper (Phase 3).
- **Type matchup:** `TypeMatchupService`. `isWeakAgainst(mt, ot)` returns true iff `ot` is
  super-effective against `mt`. `typeMatchups` (data map) is keyed by every `PokemonType`.
- **Coins:** `TrainerService.getCoins()`, `spendCoins(amount)` (returns false and no-ops if
  `amount <= 0 || amount > coins`), `addCoins`, persisted via `restoreCoins`. `currentRoundValue`
  on `GameStateService` = rounds cleared. `getTeam()`/`getStored()` read current roster/PC
  synchronously.
- **PC drag UI:** `storage-pc.component.html`. Team (`#trainerTeam`) and stored
  (`#storedPokemon`) are two connected `cdkDropList`s in one `cdkDropListGroup`. Withdraw =
  drag a stored card into team; deposit/bench = drag a team card into stored. Per-card
  `[cdkDragDisabled]` already exists (team: marked index; stored: `fainted || retreatLocked`).
- **Persistence:** `run-persistence.service.ts` — `SavedRun` interface, a `combineLatest`
  of every persisted observable, `persistRun(...)`, `restoreRun()`, and `isValidSavedRun()`.
  `MarkedTargetService`/`markedTeamIndex` is the closest template for a new field.

---

## Phase 0 — Danger meter tuning

Files: `danger-meter.service.ts`, `danger-meter.service.spec.ts`.

1. `danger-meter.service.ts`: change `private static readonly RECOVERY = 10;` to `= 15`.
2. `danger-meter.service.spec.ts`: update any test asserting a +10 recovery step to +15
   (grep the spec for `10` near `recoverTo`/`rollStep` reward-branch assertions).

**Acceptance test:** a non-threat `rollStep` now raises `dangerPercent` by up to 15 (capped
at `base(round)`), not 10. Existing pity/relief/spike behavior unchanged.

---

## Phase 1 — Threat eligibility draw-filter

**Why:** `rollStep()` commits the danger-meter step (relief + `consecutiveThreats++`) in
`initializeDraw()` **before** the specific threat is drawn/routed. A threat that then can't
apply and calls `doNothing()` wastes the step **and** keeps the free danger relief — a
costless no-op. Filtering ineligible threats out of the draw pool (rather than drawing then
no-oping) means the step always lands a real threat. The eligible pool is never empty because
`tollBooth`/`spooked`/`badOmen` are always applicable. This also fixes the existing
same-shaped hole in `forcedRetreat`/`markedTarget` at 1-team-Pokémon.

Files: `main-adventure-roulette.component.ts`, `roulette-container.component.ts` + `.html`, specs.

1. `main-adventure-roulette.component.ts`:
   - Add `@Input() excludedThreatIds: string[] = [];` (next to the other `@Input`s).
   - In `initializeDraw()`, the `stepType === 'threat'` branch (line ~237-238), replace
     `const drawn = this.drawWeightedOne(this.threatPool);` with:
     ```ts
     const eligible = this.threatPool.filter(t => !this.excludedThreatIds.includes(t.id));
     const drawn = this.drawWeightedOne(eligible.length ? eligible : this.threatPool);
     ```
     (The `eligible.length ? … : this.threatPool` guard is belt-and-suspenders — in practice
     the always-applicable threats keep `eligible` non-empty.) The reload-replay path above
     it is unaffected: it re-shows an already-committed draw and never re-draws.
   - Angular sets `@Input`s before `ngOnInit`, and `initializeDraw()` runs at/after
     `ngOnInit`, so the excluded list is populated before the first draw — verify the call
     site ordering holds when wiring.
2. `roulette-container.component.ts`: add a method computing the current exclusions from live
   roster state:
   ```ts
   excludedThreatIds(): string[] {
     const teamCount = this.trainerService.getTeam().length;
     const total = teamCount + this.trainerService.getStored().length;
     const excluded: string[] = [];
     if (total <= 1) excluded.push('pcLockout');            // nothing to withdraw or bench
     if (teamCount <= 1) excluded.push('forcedRetreat', 'markedTarget'); // never bench/mark your only battler
     return excluded;
   }
   ```
   (`pcLockout` is added to the pool in Phase 4; listing its id here early is harmless — it
   matches no pool entry until then. Note `total <= 1` implies `teamCount <= 1`, so a
   single-Pokémon roster excludes all three; a 1-team + ≥1-PC roster excludes only
   forcedRetreat/markedTarget, leaving `pcLockout` eligible — correct, since there's a PC
   Pokémon to lock away.)
3. `roulette-container.component.html`: bind `[excludedThreatIds]="excludedThreatIds()"` on
   `<app-main-adventure-roulette>`.
4. Keep the `doNothing()` guards inside `forcedRetreat()`/`markedTarget()` (and Phase 4's
   `pcLockout()`) as a defensive fallback — with the filter they should never fire in normal
   play, but they guard the full-pool fallback and any future caller.
5. Specs:
   - `main-adventure-roulette.component.spec.ts`: set
     `component.excludedThreatIds = ['forcedRetreat','markedTarget']`, force a threat step
     (stub `rollStep` → `'threat'`), and assert the routed id is never an excluded one across
     several draws. (Grep the spec for how existing tests stub the danger meter / force a
     threat draw and read the routed id.)
   - `roulette-container.component.spec.ts`: `excludedThreatIds()` returns
     `['pcLockout','forcedRetreat','markedTarget']` for a 1-Pokémon roster; excludes only
     `['forcedRetreat','markedTarget']` for a 1-team + 2-PC roster; returns `[]` for a healthy
     4-team roster.

**Acceptance test:** With a single-Pokémon roster, forcing repeated threat steps never draws
`forcedRetreat`, `markedTarget`, or `pcLockout` — it always lands one of
`tollBooth`/`spooked`/`badOmen`/`itemTheft`/`teamRocketAmbush`. The danger meter's relief is
thus always "paid for" by a real threat.

---

## Phase 2 — `tollBooth` (coin drain + scaled overdraft spike)

Files: `danger-meter.service.ts`, `main-adventure-roulette.component.ts`,
`roulette-container.component.ts` + `.html`, i18n, specs.

1. `danger-meter.service.ts`: generalize the spike so the toll can request a smaller one.
   Change `applySpike()` to take an optional amount defaulting to the existing constant:
   ```ts
   applySpike(amount: number = DangerMeterService.SPIKE): void {
     const current = this.state.value;
     this.state.next({
       dangerPercent: Math.min(100, current.dangerPercent + amount),
       consecutiveThreats: current.consecutiveThreats,
       guaranteedRewardSteps: current.guaranteedRewardSteps
     });
   }
   ```
   The existing `spooked()` caller passes nothing and still gets +30.
2. `main-adventure-roulette.component.ts`: add to `threatPool`
   `{ id: 'tollBooth', textKey: 'game.main.roulette.adventure.actions.tollBooth', fillStyle: 'darkred', weight: 1 }`,
   plus `@Output() tollBoothEvent = new EventEmitter<void>();` and
   `tollBooth: () => this.tollBoothEvent.emit(),` in `actionHandlers`.
3. `roulette-container.component.html`: bind `(tollBoothEvent)="tollBooth()"` on
   `<app-main-adventure-roulette>`.
4. `roulette-container.component.ts`: add a tuning helper and the handler:
   ```ts
   private tollAmount(round: number): number { return 15 + 3 * round; }

   tollBooth(): void {
     const round = this.gameStateService.currentRoundValue;
     const toll = this.tollAmount(round);
     const balance = this.trainerService.getCoins();
     const paid = Math.min(balance, toll);
     if (paid > 0) {
       this.trainerService.spendCoins(paid);
     }
     const unpaidFraction = (toll - paid) / toll;
     let spike = 0;
     if (unpaidFraction > 0) {
       spike = unpaidFraction <= 1 / 3 ? 5 : unpaidFraction <= 2 / 3 ? 10 : 15;
       this.dangerMeterService.applySpike(spike);
     }
     this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.tollBooth.title');
     this.infoModalMessage = spike > 0
       ? this.translateService.instant('game.main.roulette.adventure.threats.tollBooth.shortMessage', { paid, spike })
       : this.translateService.instant('game.main.roulette.adventure.threats.tollBooth.paidMessage', { paid });
     this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
     this.doNothing();
   }
   ```
   (Confirm `translateService`/`modalQueueService`/`infoModal` field names against the
   existing `badOmen()`/`spooked()` handlers before wiring — reuse whatever they use. If
   ngx-translate interpolation params aren't already used in this file, verify the
   `instant(key, params)` shape works or fall back to string concatenation like the other
   handlers do.)
5. i18n (`en.json`, English placeholder in the other 5):
   - `actions.tollBooth`: `"Toll Booth"`
   - `threats.tollBooth`: `{ "title": "Toll Booth", "paidMessage": "A toll gate blocks the road — you hand over {{paid}} coins.", "shortMessage": "A toll gate blocks the road — you scrape together {{paid}} coins, but coming up short rattles you (danger +{{spike}}%)." }`
6. Specs (`roulette-container.component.spec.ts`): add a `describe('tollBooth', …)` with cases:
   (a) balance ≥ toll → coins drop by exactly `toll`, no spike; (b) balance 0 → coins stay 0,
   `applySpike(15)` called; (c) balance just under toll (e.g. toll−1) → coins hit 0, small
   spike tier applied. Spy `dangerMeterService.applySpike`.

**Acceptance test:** round 3 toll = 24. With 100 coins → 76 left, no spike. With 10 coins →
0 left, unpaid 14/24 ≈ 0.58 → +10 spike. With 0 coins → 0 left, unpaid 1.0 → +15 spike.
With 23 coins → 0 left, unpaid 1/24 ≈ 0.04 → +5 spike.

---

## Phase 3 — `scoutingReport` (opponent gains a type)

New file `src/app/services/scouting-report-service/scouting-report.service.ts` (mirror
`MarkedTargetService`, holding a `PokemonType | null`):

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PokemonType } from '../../interfaces/pokemon-type';

/**
 * Holds the New-Experience "scouting report" threat's pending extra opponent type —
 * appended to the next real battle's opponentTypes, then cleared once that battle
 * resolves. Chosen at draw time from the player's strongest Pokémon (team + PC).
 * Persisted so a reload can't shake it off.
 */
@Injectable({ providedIn: 'root' })
export class ScoutingReportService {
  private pendingType = new BehaviorSubject<PokemonType | null>(null);
  getPendingTypeObservable(): Observable<PokemonType | null> { return this.pendingType.asObservable(); }
  get currentType(): PokemonType | null { return this.pendingType.value; }
  setType(type: PokemonType): void { this.pendingType.next(type); }
  clearType(): void { this.pendingType.next(null); }
  restoreType(type: PokemonType | null): void { this.pendingType.next(type); }
}
```

1. `type-matchup.service.ts`: add a helper for the candidate counters:
   ```ts
   /** All types super-effective against `type` (i.e. `type` is weak to them). */
   getSuperEffectiveCounters(type: PokemonType): PokemonType[] {
     return (Object.keys(typeMatchups) as PokemonType[]).filter(t => this.isWeakAgainst(type, t));
   }
   ```
2. `main-adventure-roulette.component.ts`: add to `threatPool`
   `{ id: 'scoutingReport', textKey: 'game.main.roulette.adventure.actions.scoutingReport', fillStyle: 'darkred', weight: 1 }`,
   plus `@Output() scoutingReportEvent = new EventEmitter<void>();` and
   `scoutingReport: () => this.scoutingReportEvent.emit(),`.
3. `roulette-container.component.html`: bind `(scoutingReportEvent)="scoutingReport()"`.
4. `roulette-container.component.ts`: inject `ScoutingReportService` and `TypeMatchupService`
   (verify whether TypeMatchupService is already injected first), add:
   ```ts
   scoutingReport(): void {
     const roster = [...this.trainerService.getTeam(), ...this.trainerService.getStored()];
     if (roster.length === 0) { this.doNothing(); return; }
     const ace = roster.reduce((best, p) => (p.power > best.power ? p : best), roster[0]);
     const aceTypes = [ace.type1, ace.type2].filter((t): t is PokemonType => !!t);
     // Try the ace's types in random order; take the first with any counters. Pure random pick.
     const shuffledAceTypes = [...aceTypes].sort(() => Math.random() - 0.5);
     let chosen: PokemonType | null = null;
     for (const at of shuffledAceTypes) {
       const counters = this.typeMatchupService.getSuperEffectiveCounters(at);
       if (counters.length) { chosen = counters[Math.floor(Math.random() * counters.length)]; break; }
     }
     if (!chosen) { this.doNothing(); return; } // no type has a counter — extremely rare
     this.scoutingReportService.setType(chosen);
     const aceName = this.translateService.instant(ace.text); // reuse whatever key markedTarget()/itemTheft() use for a PokemonItem's name — verify first
     const typeName = this.translateService.instant(`type.${chosen}`); // verify the type-name key shape used elsewhere (matchup strip / type icons)
     this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.scoutingReport.title');
     this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.scoutingReport.description', { pokemon: aceName, type: typeName });
     this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
     this.doNothing();
   }
   ```
   Before wiring the two name lookups, grep this file for how `markedTarget()`/`itemTheft()`
   resolve a `PokemonItem` display name and how type names are translated, and reuse those
   exact patterns instead of guessing the i18n key shapes.
5. `base-battle-roulette.component.ts`: inject `ScoutingReportService`, add a wrapper getter,
   and route all odds/UI reads through it:
   ```ts
   protected readonly scoutingReportService = inject(ScoutingReportService);

   /** opponentTypes with the pending scouting-report type appended (New Experience threat). */
   protected get effectiveOpponentTypes(): PokemonType[] | undefined {
     const scouted = this.scoutingReportService.currentType;
     if (!scouted) return this.opponentTypes;
     return [...(this.opponentTypes ?? []), scouted];
   }
   ```
   - In `calcVictoryOdds()` (line ~283), pass `this.effectiveOpponentTypes` instead of
     `this.opponentTypes` to `buildVictoryOdds`.
   - In `finishBattleCleanup()` (line ~320), add `this.scoutingReportService.clearType();`.
6. The 4 battle subclass templates (`gym`/`rival`/`elite-four`/`champion`-`battle-roulette.component.html`):
   grep each for `[opponentTypes]=` (the bindings to `<app-battle-prep-panel>` and
   `<app-matchup-strip>`) and change `"opponentTypes"` → `"effectiveOpponentTypes"` so the
   prep preview and matchup strip show the added type too (transparency invariant).
7. `run-persistence.service.ts`:
   - Add `scoutingType: PokemonType | null;` to `SavedRun`.
   - Inject `ScoutingReportService`, add `getPendingTypeObservable()` to `combineLatest`,
     destructure it, add `scoutingType: <value>` to the `persistRun(...)` call.
   - In `restoreRun()`: `this.scoutingReportService.restoreType(run.scoutingType ?? null);`.
   - In `isValidSavedRun()`: `(run.scoutingType === undefined || run.scoutingType === null || typeof run.scoutingType === 'string')`.
8. i18n (`en.json` + 5 placeholders):
   - `actions.scoutingReport`: `"Scouting Report"`
   - `threats.scoutingReport`: `{ "title": "Rival Scouting Report", "description": "A rival scout studied your team — the next enemy came prepared with a {{type}} edge against your {{pokemon}}." }`
9. Specs:
   - New `scouting-report.service.spec.ts` (trivial set/clear/restore, mirror the marked-target spec).
   - `type-matchup.service.spec.ts`: a case asserting `getSuperEffectiveCounters('grass')`
     includes `'fire'` (and not `'water'`).
   - `base-battle-roulette.component.spec.ts`: with a scouting type set, `buildVictoryOdds`
     produces more No tickets than with it cleared, for a team weak to that type; and
     `finishBattleCleanup` clears it (grep the spec for the existing clearDebuff/clearMark test).
   - `roulette-container.component.spec.ts`: `scoutingReport()` with a known team sets a
     `ScoutingReportService` type that is super-effective against the highest-power member's
     type; empty roster → `doNothing()`, no type set.
   - `main-adventure-roulette.component.spec.ts`: add `scoutingReport`/`scoutingReportEvent`
     to the `threatIds` routing arrays.
   - `run-persistence.service.spec.ts`: extend the round-trip persistence test with a
     non-null `scoutingType`.

**Acceptance test:** New Experience run, ace = Venusaur (Grass/Poison). Draw `scoutingReport`
→ `ScoutingReportService.currentType` is a random type super-effective against Grass or Poison
(e.g. Fire/Ice/Flying/Psychic/Ground). Next battle's wheel, prep preview, and matchup strip
all reflect the enemy having that extra type; your team's win % drops accordingly. After that
battle resolves, the type clears. Stashing the ace in the PC before the battle does not change
which type was chosen (locked at draw time).

---

## Phase 4 — `pcLockout` (freeze PC both directions for one round)

New file `src/app/services/pc-lock-service/pc-lock.service.ts` (mirror `MarkedTargetService`,
holding a `boolean`):

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Holds the New-Experience "PC lockout" threat's pending freeze — while true, the PC
 * storage is locked both directions (no withdraw, no deposit) until the next real battle
 * resolves. Persisted so a reload can't shake it off.
 */
@Injectable({ providedIn: 'root' })
export class PcLockService {
  private locked = new BehaviorSubject<boolean>(false);
  getLockedObservable(): Observable<boolean> { return this.locked.asObservable(); }
  get isLocked(): boolean { return this.locked.value; }
  setLock(value: boolean): void { this.locked.next(value); }
  clearLock(): void { this.locked.next(false); }
}
```

1. `main-adventure-roulette.component.ts`: add to `threatPool`
   `{ id: 'pcLockout', textKey: 'game.main.roulette.adventure.actions.pcLockout', fillStyle: 'darkred', weight: 1 }`,
   plus `@Output() pcLockoutEvent = new EventEmitter<void>();` and
   `pcLockout: () => this.pcLockoutEvent.emit(),`.
2. `roulette-container.component.html`: bind `(pcLockoutEvent)="pcLockout()"`.
3. `roulette-container.component.ts`: inject `PcLockService`, add (the `total <= 1` guard is
   a defensive fallback — Phase 1's filter already excludes `pcLockout` in that case):
   ```ts
   pcLockout(): void {
     const total = this.trainerService.getTeam().length + this.trainerService.getStored().length;
     if (total <= 1) { this.doNothing(); return; }
     this.pcLockService.setLock(true);
     this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.pcLockout.title');
     this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pcLockout.description');
     this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
     this.doNothing();
   }
   ```
4. `base-battle-roulette.component.ts`: inject `PcLockService`, add
   `this.pcLockService.clearLock();` in `finishBattleCleanup()` (line ~320).
5. `storage-pc.component.ts`: inject `PcLockService`, subscribe in `ngOnInit` (unsubscribe in
   `ngOnDestroy`) to expose `pcLocked = false;` updated from `getLockedObservable()`.
6. `storage-pc.component.html`: freeze both lists while locked.
   - Team card (line ~20): `[cdkDragDisabled]="(isNewExperienceMode && idx === markedIndex) || pcLocked"`.
   - Stored card (line ~61): `[cdkDragDisabled]="!!pokemon.fainted || !!pokemon.retreatLocked || pcLocked"`.
   - Add a lock banner just inside `.modal-body` (after the opening `<div … cdkDropListGroup>`):
     ```html
     @if (pcLocked) {
       <div class="pc-lock-banner">{{ 'trainer.storage.pcLocked' | translate }}</div>
     }
     ```
   - `storage-pc.component.css`: a small warning-styled `.pc-lock-banner` (reuse existing
     warning/badge colors in that file; no new color system needed).
7. `run-persistence.service.ts`:
   - Add `pcLocked: boolean;` to `SavedRun`.
   - Inject `PcLockService`, add `getLockedObservable()` to `combineLatest`, persist
     `pcLocked: <value>`, restore via `this.pcLockService.setLock(run.pcLocked ?? false);`,
     and extend `isValidSavedRun()` with
     `(run.pcLocked === undefined || typeof run.pcLocked === 'boolean')`.
8. i18n (`en.json` + 5 placeholders):
   - `actions.pcLockout`: `"PC Lockout"`
   - `threats.pcLockout`: `{ "title": "PC Lockout", "description": "A system glitch locks your PC — you can't withdraw or deposit any Pokémon until after your next battle." }`
   - `trainer.storage.pcLocked`: `"PC locked until your next battle"`
9. Specs:
   - New `pc-lock.service.spec.ts` (set/clear/restore).
   - `storage-pc.component.spec.ts`: with `PcLockService` locked, assert both a team card and
     a stored card render `cdkDragDisabled` true and the banner shows (mirror the existing
     `retreatLocked`/marked drag-disable tests).
   - `roulette-container.component.spec.ts`: `pcLockout()` with ≥2 total sets the lock;
     with 1 total → `doNothing()`, lock stays false.
   - `run-persistence.service.spec.ts`: round-trip a `pcLocked: true`.

**Acceptance test:** New Experience run with ≥2 Pokémon total. Draw `pcLockout` → open the
PC: every card in both team and stored grids is un-draggable and the banner shows. Draw any
real battle and resolve it (win or lose) → PC is usable again. With exactly 1 Pokémon total,
`pcLockout` is never drawn (Phase 1 filter). A reload while locked keeps the lock.

---

## Phase 5 — Weights review, i18n, README, release notes, backlog

1. **Weights pass — done (2026-07-21).** Tuned by severity assessment (no playtest data yet;
   revisit once there is some) instead of leaving every new threat at the provisional `weight: 1`.
   Final `threatPool` weights in `main-adventure-roulette.component.ts`:
   - **High (1):** `forcedRetreat`, `scoutingReport` — a concrete cost every single draw
     (a roster slot benched, or the next battle's odds worsened).
   - **High-medium (1.25):** `teamRocketAmbush` — can cost a whole Pokémon via the mini-wheel's
     steal outcome, but only ~40% of the time (defeat/run-away are neutral-to-good), so it's not
     as consistently punishing as the two `weight: 1` threats. (Demoted from its old `weight: 2`
     — previously the most common threat in the 7-entry pool — now that the pool has grown and
     its risk profile was reassessed against the new threats.)
   - **Medium (1.5):** `pcLockout`, `badOmen`, `markedTarget` — worsens one battle or removes
     tactical flexibility for a round, but no roster/coin loss.
   - **Low (2):** `tollBooth`, `itemTheft`, `pokeballMalfunction`, `spooked` — a recoverable
     resource loss (coins, one item) or a purely probabilistic/meta cost.
2. Confirm every new key across Phases 2-4 exists in all 6 locale files (`en` real, others
   English placeholder per repo convention).
3. Update the README "New features added on top of the original" list and the New Experience
   Mode threat-list sentence to describe the new 10-entry pool (Toll Booth, Scouting Report,
   PC Lockout) and the danger-meter change.
4. Bump `package.json` (minor version — check the current value first) and add a newest-first
   `RELEASE_NOTES` entry (`src/app/data/release-notes.ts`) with `whatsNew.v<x>_<y>_<z>.*` keys
   (2-3 short bullets: three new threats + a harder danger curve). Add those keys + a
   `v<x>_<y>_<z>` version label to all six locale files.
5. Remove any superseded threat/danger entries from `docs/todo/backlog.md`. Add a backlog
   entry: **"Scouting Report selection rule — currently pure random; consider upgrading to
   harmful-random (filter out counters that don't worsen the team's odds) or meanest-counter
   if pure random feels too swingy in playtest."**
6. Consider a separate backlog entry noting the emergent **bench-to-win** property (fielding
   <6 to shed a matchup liability raises win % when already favored) as a possible balance
   topic, independent of PC Lockout.

---

## Execution notes

- **Checkpoint after every phase** — do not run multiple phases in one go; wait for review.
- Run `npm run test:local` after each phase; all specs green before continuing.
- Phase 0 is standalone. Phase 1 (the draw-filter) should land before Phase 4 (it's what keeps
  `pcLockout` from ever being drawn at ≤1 Pokémon) and also retrofits the two existing gated
  threats. Phases 2, 3, 4 are otherwise independent net-new pool entries. Phase 5 is last.
- Once every checkbox below is done, move this file to `docs/plans/done/`.

## Checklist

- [x] Phase 0 — Danger meter `RECOVERY` 10 → 15
- [x] Phase 1 — Threat eligibility draw-filter (fixes `forcedRetreat`/`markedTarget` too)
- [x] Phase 2 — `tollBooth`
- [x] Phase 3 — `scoutingReport`
- [x] Phase 4 — `pcLockout`
- [x] Phase 5 — Weights review, i18n, README, release notes, backlog
