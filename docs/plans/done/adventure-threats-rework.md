# Plan: Adventure threat-pool rework (New Experience mode)

Status: **Done — all phases complete.**
Owner: tormarod
Last updated: 2026-07-19

## Post-ship note (2026-07-19)

`pcBreakIn` (Phase 3) was **removed after shipping**: it had no real downside
when PC storage was empty (a costless no-op message), which isn't acceptable
for a threat — every other entry in the pool has a real, luck-independent
cost regardless of run state. The final shipped threat pool has **7** entries,
not 8: `teamRocketAmbush`, `itemTheft`, `badOmen`, `forcedRetreat`, `spooked`,
`markedTarget`, `pokeballMalfunction`. Version 3.2.0 (which briefly included
`pcBreakIn`) was never released; the shipped release is 3.3.0.

A replacement idea (an ambient PC-corruption mechanic tied to the Danger
meter rather than the threat wheel) is being designed separately — see
`docs/plans/pc-corruption-mechanic.md`.

## Why

The New Experience choose-between adventure's threat pool
(`MainAdventureRouletteComponent.threatPool`, in
`src/app/main-game/roulette-container/roulettes/main-adventure-roulette/main-adventure-roulette.component.ts`)
currently has only 4 entries: `teamRocketAmbush`, `itemTheft`, `toll`, `badOmen`.
Since a draw picks 3 distinct entries from the pool (`drawDistinct(pool, 3)`),
almost every threat draw shows nearly the same 3 candidates — too little variety.

Also, `toll` (hand over a chosen item, or — with no items — a team Pokémon,
weighted toward weaker members, gone for good) is redundant with `itemTheft`
(random item loss): both just remove an item in the common case, and `toll`'s
Pokémon-loss escalation makes it strictly worse with no distinct identity of
its own. Decision (2026-07-19): **drop `toll` entirely** and replace it with
**Forced Retreat**, a mechanically distinct threat (see Phase 1).

This plan reworks `toll` and adds four new threats, bringing the pool to 8
entries. All work is gated behind New Experience mode, same as the rest of
the threat pool — Classic mode is entirely unaffected.

## Final threat pool (after this plan)

| id | severity | effect |
|---|---|---|
| `teamRocketAmbush` | medium, recoverable | existing — unchanged |
| `itemTheft` | mild | existing — unchanged |
| `badOmen` | mild-medium, temporary | existing — unchanged |
| `forcedRetreat` | medium, reversible | **new** (replaces `toll`) — benches a weak-biased team Pokémon to PC storage, **locked there for 1 combat round** (can't be dragged back out, tile shown greyed-out/caved-in) |
| `spooked` | mild, no item/Pokémon cost | **new** — spikes the Danger meter back up |
| ~~`pcBreakIn`~~ | ~~medium, permanent~~ | **removed post-ship** — see Post-ship note above |
| `markedTarget` | medium, tactical | **new** — one random team Pokémon can't be picked as lead in your next real battle's prep screen |
| `pokeballMalfunction` | mild-medium | **new** — your next catch attempt has a chance to fail (Pokémon escapes) |

All new/reworked entries get `weight: 1` in `threatPool`, matching every
existing entry except `teamRocketAmbush` (`weight: 2`) — leave that as-is.

## Phase 1 — Rework `toll` → `forcedRetreat`

The benched Pokémon must be **locked in PC storage for exactly 1 combat
round** — can't be dragged back to the team, tile shown greyed-out/caved-in
(reusing the existing `fainted` visual/drag-disable treatment in
`storage-pc.component.html`) — then automatically unlocks the moment the next
real battle (gym/rival/E4/champion) resolves, win or lose. This is a stronger
guarantee than the old `toll`'s permanent loss but also not a free undo:
"reversible" only after surviving one more fight.

Files: `pokemon-item.ts`, `trainer.service.ts`, `roulette-container.component.ts`,
`main-adventure-roulette.component.ts`, `game-state.ts`,
`storage-pc.component.html`, `storage-pc.component.css`, the 4 battle roulette
components, `en.json` (+ other 5 locales), specs.

1. In `game-state.ts`, rename the `'toll-pokemon'` union member to
   `'forced-retreat-pokemon'`.
2. In `pokemon-item.ts`, add a new field next to `fainted`:
   ```ts
   /** New Experience only: set while the Forced Retreat threat has this Pokémon locked in PC storage; cleared once the next real battle resolves. */
   retreatLocked?: boolean;
   ```
3. In `trainer.service.ts`, add a method (near `removeFromTeam`/`commitTeamAndStorage`):
   ```ts
   /** Clears any pending Forced Retreat lock once the next real battle resolves. */
   clearForcedRetreatLock(): void {
     [...this.trainerTeam, ...this.storedPokemon].forEach(pokemon => {
       if (pokemon.retreatLocked) {
         pokemon.retreatLocked = false;
       }
     });
     this.trainerTeamObservable.next(this.getTeam());
   }
   ```
4. In `main-adventure-roulette.component.ts`:
   - Replace the `toll` entry in `threatPool` with:
     `{ id: 'forcedRetreat', textKey: 'game.main.roulette.adventure.actions.forcedRetreat', fillStyle: 'darkred', weight: 1 }`
   - Replace `@Output() tollEvent` with `@Output() forcedRetreatEvent = new EventEmitter<void>();`
   - Replace the `toll: () => this.tollEvent.emit(),` line in `actionHandlers`
     with `forcedRetreat: () => this.forcedRetreatEvent.emit(),`
5. In `roulette-container.component.html`, rename the `(tollEvent)="toll()"`
   binding on `<app-main-adventure-roulette>` to `(forcedRetreatEvent)="forcedRetreat()"`.
6. In `roulette-container.component.ts`:
   - Delete `tollSelectionMode` field (line ~318) and `handleTollItemSelection()`
     (~543-552) entirely, and its call site in `onItemSelected`/wherever it's
     invoked (~533-535) — Forced Retreat never touches items, so this whole
     item-picker path is dead.
   - Rename the `toll()` method (~799-824) to `forcedRetreat()`. New body:
     ```ts
     forcedRetreat(): void {
       const trainerTeam = this.trainerService.getTeam();
       if (trainerTeam.length < 2) {
         // Never bench the player's only Pokémon.
         this.doNothing();
         return;
       }
       this.stealCandidates = trainerTeam;
       this.auxPokemonList = this.weightByInversePower(trainerTeam);
       this.customWheelTitle = 'game.main.roulette.adventure.threats.forcedRetreat.pickPokemon';
       this.auxPokemonListPickMode = false;
       this.gameStateService.setNextState('forced-retreat-pokemon');
       this.gameStateService.setNextState('select-from-pokemon-list');
       this.finishCurrentState();
     }
     ```
   - Rename the `case 'toll-pokemon':` block in `continueWithPokemon()`
     (~508-517) to `case 'forced-retreat-pokemon':`, and change its body to
     move the Pokémon to storage instead of removing it outright, marking it
     locked:
     ```ts
     case 'forced-retreat-pokemon': {
       const index = this.auxPokemonList.indexOf(pokemon);
       const original = index !== -1 ? this.stealCandidates[index] : pokemon;
       original.retreatLocked = true;
       const newTeam = this.trainerService.getTeam().filter(p => p !== original);
       const newStorage = [...this.trainerService.getStored(), original];
       this.trainerService.commitTeamAndStorage(newTeam, newStorage);
       this.finishCurrentState();
       break;
     }
     ```
     (Reversible only after 1 combat round — the lock is what actually
     enforces this, not the mere fact of being in storage; unlike the old
     `toll-pokemon` path, never call `removeFromTeam` here.)
7. In `storage-pc.component.html`, extend the existing fainted-card treatment
   (~lines 47-52) to also cover the locked case, and add a distinct badge —
   reuses the exact same grey/caved-in visual, different label, no revive
   button:
   ```html
   <div  class="pokemon-storage-card shadow"
         [class.fainted-card]="pokemon.fainted || pokemon.retreatLocked"
         [cdkDragData]="pokemon"
         [cdkDragDisabled]="!!pokemon.fainted || !!pokemon.retreatLocked"
         cdkDrag>
     <img [src]="getSprite(pokemon)"
          class="img-fluid"
          [class.fainted-sprite]="pokemon.fainted || pokemon.retreatLocked"
          ...>
     @if (pokemon.retreatLocked) {
       <span class="fainted-badge">{{ 'trainer.storage.retreatLocked' | translate }}</span>
     }
     ...
   ```
   (Keep the existing `pokemon.fainted` badge/revive-button block as-is — a
   Pokémon can't be both fainted and retreat-locked at once in practice, but
   the two conditions aren't mutually exclusive in code, so leave them as
   separate `@if`s rather than merging.) No CSS changes needed — `.fainted-card`/
   `.fainted-sprite` are reused verbatim.
8. In each of the 4 battle roulette components, find every
   `this.battlePrepService.clearPrep();` call site (2 per component — see
   Phase 4 step 5 for the exact locations) and add
   `this.trainerService.clearForcedRetreatLock();` alongside each one, so the
   lock clears at the same point prep does (i.e. once the next real battle's
   result is known — win or lose).
9. i18n — in `en.json` under `game.main.roulette.adventure`:
   - `actions`: rename `"toll": "Pay a Toll"` → `"forcedRetreat": "Forced Retreat"`.
   - `threats`: replace the `"toll": { "pickItem": ..., "pickPokemon": ... }`
     block with:
     ```json
     "forcedRetreat": {
       "pickPokemon": "Which Pokémon retreats to your PC box? It'll be locked there for your next battle."
     }
     ```
   - Also add, under `trainer.storage` (wherever `"fainted"` is defined, e.g.
     `trainer.storage.fainted`): `"retreatLocked": "Locked (Forced Retreat)"`.
   - Repeat both key additions/renames in `de.json`, `es.json`, `fr.json`,
     `it.json`, `pt.json` (English placeholder text is fine for the 5 non-en
     files per repo convention).
10. Specs:
    - `roulette-container.component.spec.ts`: rename the `describe('toll', ...)`
      block (~871) to `describe('forcedRetreat', ...)`, update all
      `component.toll()` calls to `component.forcedRetreat()`, and change the
      assertion in "picking a Pokemon for the toll removes the original team
      member and never sets stolenPokemon" to assert the Pokémon now appears in
      `trainerService.getStored()` with `retreatLocked === true` (via
      `getTeamObservable`/spy) instead of being gone entirely.
    - `main-adventure-roulette.component.spec.ts`: update the `threatIds` array
      (~310) and the routing spec (~315-326) to use `forcedRetreat` /
      `forcedRetreatEvent` instead of `toll` / `tollEvent`.
    - `storage-pc.component.spec.ts`: add a case mirroring the existing
      `fainted: true` drag-disabled test (~lines 70-82), but with
      `retreatLocked: true`, asserting `cdkDragDisabled` is true and the
      locked badge renders.
    - Add a test (in whichever of the 4 battle roulette component specs
      already covers `clearPrep()`) asserting `clearForcedRetreatLock()` is
      called when that battle resolves.

**Acceptance test:** New Experience run, draw `forcedRetreat`, pick a
Pokémon → team shrinks by one, `trainerService.getStored()` contains that
exact Pokémon with `retreatLocked === true`, `stolenPokemon` is untouched.
Opening the PC shows that tile greyed-out/caved-in with a "Locked" badge and
dragging it is disabled. After the next real battle resolves (win or lose),
`retreatLocked` clears and the Pokémon can be dragged back to the team like
normal. With only 1 team Pokémon, drawing `forcedRetreat` is a no-op
(`doNothing()`).

---

## Phase 2 — `spooked` (Danger meter spike)

Files: `danger-meter.service.ts`, `main-adventure-roulette.component.ts`,
`roulette-container.component.ts`, i18n.

1. In `danger-meter.service.ts`, add a public method:
   ```ts
   private static readonly SPIKE = 30;

   /** "Spooked" threat: undoes most of rollStep's automatic threat relief. Not capped by base(round) — a punishment, not a recovery. */
   applySpike(): void {
     const current = this.state.value;
     this.state.next({
       dangerPercent: Math.min(100, current.dangerPercent + DangerMeterService.SPIKE),
       consecutiveThreats: current.consecutiveThreats
     });
   }
   ```
2. Add `{ id: 'spooked', textKey: 'game.main.roulette.adventure.actions.spooked', fillStyle: 'darkred', weight: 1 }`
   to `threatPool` in `main-adventure-roulette.component.ts`, plus
   `@Output() spookedEvent = new EventEmitter<void>();` and
   `spooked: () => this.spookedEvent.emit(),` in `actionHandlers`.
3. Bind `(spookedEvent)="spooked()"` in `roulette-container.component.html`.
4. In `roulette-container.component.ts`, add (near `badOmen()`):
   ```ts
   spooked(): void {
     this.dangerMeterService.applySpike();
     this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.spooked.title');
     this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.spooked.description');
     this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
     this.doNothing();
   }
   ```
   (`dangerMeterService` is already injected in this component — reused from
   the existing Danger meter wiring; confirm the field name before wiring in.)
5. i18n (`en.json`, mirrored placeholder in the other 5):
   - `actions.spooked`: `"Spooked"`
   - `threats.spooked`: `{ "title": "Spooked!", "description": "Something's rattled your nerves — the road ahead feels more dangerous than it did a moment ago." }`

**Acceptance test:** Drawing `spooked` increases `dangerMeterService.currentDangerPercent`
by 30 (capped at 100), leaves `consecutiveThreats` unchanged, no item/Pokémon
lost, info modal shown.

---

## Phase 3 — `pcBreakIn` (steal from PC storage)

> **Removed after shipping — see "Post-ship note" above.** Left below as a
> historical record of what was implemented and then reverted.

Files: `main-adventure-roulette.component.ts`, `roulette-container.component.ts`, i18n.

1. Add `{ id: 'pcBreakIn', textKey: 'game.main.roulette.adventure.actions.pcBreakIn', fillStyle: 'darkred', weight: 1 }`
   to `threatPool`, plus `@Output() pcBreakInEvent = new EventEmitter<void>();`
   and `pcBreakIn: () => this.pcBreakInEvent.emit(),`.
2. Bind `(pcBreakInEvent)="pcBreakIn()"` in `roulette-container.component.html`.
3. In `roulette-container.component.ts`, mirroring `itemTheft()`:
   ```ts
   pcBreakIn(): void {
     const stored = this.trainerService.getStored();
     this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.pcBreakIn.title');

     if (stored.length === 0) {
       this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pcBreakIn.nothingFound');
     } else {
       const stolen = stored[Math.floor(Math.random() * stored.length)];
       this.trainerService.removeFromTeam(stolen); // checks storedPokemon too
       const pokemonName = this.translateService.instant(`pokemon.${stolen.pokemonId}`); // match whatever key itemTheft/name lookups use elsewhere for a Pokémon's display name — verify against an existing Pokémon-name translate call in this file before wiring in
       this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pcBreakIn.stolenPokemon') + pokemonName;
     }

     this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
     this.doNothing();
   }
   ```
   Before wiring in the Pokémon-name lookup, grep this file for how other
   flows (e.g. `stolenPokemon` display, `altPrizeText`) resolve a `PokemonItem`
   to a display name, and reuse that exact pattern instead of guessing the
   i18n key shape.
4. i18n (`en.json` + 5 others):
   - `actions.pcBreakIn`: `"PC Break-in"`
   - `threats.pcBreakIn`: `{ "title": "PC Break-in!", "stolenPokemon": "A thief broke into your PC and took ", "nothingFound": "A thief broke into your PC but found it empty." }`

**Acceptance test:** Empty PC storage → no-op message, team/storage unchanged.
Non-empty → one storage Pokémon gone, active team untouched, never sets
`stolenPokemon` (this isn't a Team Rocket steal, so it's not recoverable that way).

---

## Phase 4 — `markedTarget` (deny a lead pick for one battle)

New file: `src/app/services/marked-target-service/marked-target.service.ts`
(mirror `battle-debuff.service.ts`'s shape exactly):

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Holds the New-Experience "marked target" threat's pending team-index lock —
 * that team member can't be picked as lead in the next real battle's prep
 * screen, then clears once that battle resolves. Persisted so a reload can't
 * shake off the mark. Tracked by team index at mark time (like leadIndex),
 * not object identity — acceptable because nothing reorders the team between
 * a threat draw and the following battle's prep screen.
 */
@Injectable({ providedIn: 'root' })
export class MarkedTargetService {
  private pendingMark = new BehaviorSubject<number | null>(null);

  getPendingMarkObservable(): Observable<number | null> {
    return this.pendingMark.asObservable();
  }

  get currentMarkedIndex(): number | null {
    return this.pendingMark.value;
  }

  setMark(index: number): void {
    this.pendingMark.next(index);
  }

  clearMark(): void {
    this.pendingMark.next(null);
  }

  restoreMark(index: number | null): void {
    this.pendingMark.next(index);
  }
}
```

1. `main-adventure-roulette.component.ts`: add
   `{ id: 'markedTarget', textKey: 'game.main.roulette.adventure.actions.markedTarget', fillStyle: 'darkred', weight: 1 }`
   to `threatPool`, `@Output() markedTargetEvent = new EventEmitter<void>();`,
   `markedTarget: () => this.markedTargetEvent.emit(),`.
2. Bind `(markedTargetEvent)="markedTarget()"` in `roulette-container.component.html`.
3. `roulette-container.component.ts`: inject `MarkedTargetService`, add:
   ```ts
   markedTarget(): void {
     const team = this.trainerService.getTeam();
     if (team.length < 2) {
       // Marking the only option would be a no-choice punishment — skip.
       this.doNothing();
       return;
     }
     const index = Math.floor(Math.random() * team.length);
     this.markedTargetService.setMark(index);
     const pokemonName = /* reuse the same name-lookup pattern found for Phase 3 */;
     this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.markedTarget.title');
     this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.markedTarget.description') + pokemonName;
     this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
     this.doNothing();
   }
   ```
4. `battle-prep-panel.component.ts`: add `@Input() disabledIndex: number | null = null;`.
   - In `selectLead(index)`, add a guard: `if (index === this.disabledIndex) return;`.
   - Initialize `selectedLeadIndex` defensively: change the field default or
     add to whichever lifecycle hook first has `team`/`disabledIndex` available
     so it never starts on the disabled index — e.g. an `ngOnChanges` (needs
     `OnChanges` added to the class) that sets
     `if (this.selectedLeadIndex === this.disabledIndex) this.selectedLeadIndex = this.disabledIndex === 0 ? 1 : 0;`.
   - `battle-prep-panel.component.html`: read this file first to find the
     per-team-member clickable card markup, then add a disabled visual state
     (e.g. `[class.disabled]="i === disabledIndex"` and skip the `(click)`
     handler for that card) — match whatever pattern the template already uses
     for per-card classes/click bindings.
5. In each of the 4 battle roulette components
   (`gym-battle-roulette`, `rival-battle-roulette`,
   `elite-four-battle-roulette`, `champion-battle-roulette`):
   - Inject `MarkedTargetService`.
   - Pass `[disabledIndex]="markedTargetService.currentMarkedIndex"` on the
     `<app-battle-prep-panel>` element in each `.html`.
   - Find the existing `this.battlePrepService.clearPrep();` call sites (used
     once the battle result is known — e.g. `champion-battle-roulette.component.ts:69,78`)
     and add `this.markedTargetService.clearMark();` alongside each one, so
     the mark clears at the same point the prep does.
6. `run-persistence.service.ts`:
   - Add `markedTeamIndex: number | null;` to `SavedRun`.
   - Inject `MarkedTargetService`, add `this.markedTargetService.getPendingMarkObservable()`
     to the `combineLatest` array, destructure it, and add
     `markedTeamIndex: <that value>` to the `persistRun(...)` call.
   - In `restoreRun()`, add `this.markedTargetService.restoreMark(run.markedTeamIndex ?? null);`.
   - In `isValidSavedRun()`, add
     `(run.markedTeamIndex === undefined || run.markedTeamIndex === null || typeof run.markedTeamIndex === 'number')`.
7. i18n (`en.json` + 5 others):
   - `actions.markedTarget`: `"Marked Target"`
   - `threats.markedTarget`: `{ "title": "Marked Target", "description": "A rival scout has tailed one of your team — it can't lead your next battle: " }`

**Acceptance test:** Draw `markedTarget` with a 3+ member team → the marked
index can't be selected as lead in the next gym/rival/E4/champion prep screen;
after that battle resolves, the mark clears and every team member is pickable
again. With exactly 1 team member, it's a no-op.

---

## Phase 5 — `pokeballMalfunction` (catch escape chance)

New file: `src/app/services/catch-risk-service/catch-risk.service.ts`
(same shape as `battle-debuff.service.ts`, mirrored 1:1):

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Holds the New-Experience "poké ball malfunction" threat's pending escape
 * chance (0 = none) for the very next catch attempt, then clears once that
 * attempt resolves (whether it succeeds or the Pokémon escapes). Persisted so
 * a reload can't shake it off.
 */
@Injectable({ providedIn: 'root' })
export class CatchRiskService {
  private pendingEscapeChance = new BehaviorSubject<number>(0);

  getPendingEscapeChanceObservable(): Observable<number> {
    return this.pendingEscapeChance.asObservable();
  }

  get currentEscapeChance(): number {
    return this.pendingEscapeChance.value;
  }

  setEscapeChance(chance: number): void {
    this.pendingEscapeChance.next(chance);
  }

  clearEscapeChance(): void {
    this.pendingEscapeChance.next(0);
  }

  restoreEscapeChance(chance: number): void {
    this.pendingEscapeChance.next(chance);
  }
}
```

1. `main-adventure-roulette.component.ts`: add
   `{ id: 'pokeballMalfunction', textKey: 'game.main.roulette.adventure.actions.pokeballMalfunction', fillStyle: 'darkred', weight: 1 }`
   to `threatPool`, `@Output() pokeballMalfunctionEvent = new EventEmitter<void>();`,
   `pokeballMalfunction: () => this.pokeballMalfunctionEvent.emit(),`.
2. Bind `(pokeballMalfunctionEvent)="pokeballMalfunction()"` in `roulette-container.component.html`.
3. `roulette-container.component.ts`: inject `CatchRiskService`, add a constant
   near `BADOMEN_DEBUFF_AMOUNT`: `const MALFUNCTION_ESCAPE_CHANCE = 0.35;`, add:
   ```ts
   pokeballMalfunction(): void {
     this.catchRiskService.setEscapeChance(MALFUNCTION_ESCAPE_CHANCE);
     this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.title');
     this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.description');
     this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
     this.doNothing();
   }
   ```
4. In `preparePokemonCapture(pokemon: PokemonItem)` (~line 1270), as the very
   first thing in the method body:
   ```ts
   const escapeChance = this.catchRiskService.currentEscapeChance;
   if (escapeChance > 0) {
     this.catchRiskService.clearEscapeChance();
     if (Math.random() < escapeChance) {
       const pokemonName = /* reuse the same name-lookup pattern found for Phase 3 */;
       this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.escapeTitle');
       this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.escapeMessage') + pokemonName;
       this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
       this.finishCurrentState();
       return;
     }
   }
   ```
   Read the rest of `preparePokemonCapture`'s existing body first (forms/shiny
   branching) to confirm `finishCurrentState()` is the correct way to
   "cancel this catch and move on" consistent with how the method's other
   early-return branches conclude — adjust if a different call is actually
   used there.
5. `run-persistence.service.ts`:
   - Add `pendingCatchEscapeChance: number;` to `SavedRun`.
   - Inject `CatchRiskService`, add its observable to `combineLatest`, persist
     it, restore via `this.catchRiskService.restoreEscapeChance(run.pendingCatchEscapeChance ?? 0);`,
     and extend `isValidSavedRun()` accordingly (same optional-number pattern
     as `pendingBattleDebuff`).
6. i18n (`en.json` + 5 others):
   - `actions.pokeballMalfunction`: `"Poké Ball Malfunction"`
   - `threats.pokeballMalfunction`: `{ "title": "Poké Ball Malfunction", "description": "One of your Poké Balls is acting up — the next Pokémon you try to catch might slip free.", "escapeTitle": "It got away!", "escapeMessage": "The faulty Poké Ball popped open — " }`
   (escapeMessage reads naturally followed by the Pokémon's name + "got away.",
   or adjust phrasing once you see how Phase 3's name-interpolation pattern
   actually concatenates in this file.)

**Acceptance test:** Draw `pokeballMalfunction`, then attempt any catch
(`catchPokemon`, `catchTwoPokemon`, legendary/paradox capture, `catchZubat`,
`catchSnorlax`) → ~35% of the time the Pokémon is not added to the team/Pokédex
and an escape modal shows instead; either way the pending chance is cleared
after that one attempt, so a second catch afterward is never at risk.

---

## Phase 6 — i18n cleanup, README, release notes, backlog

1. Confirm every new key added across Phases 1-5 exists in all 6 locale files
   (`en`, `de`, `es`, `fr`, `it`, `pt`) — English placeholder text for the 5
   non-en files is fine per repo convention.
2. Update the README "New features added on top of the original" list and the
   New Experience Mode threat-list sentence (currently: *"...the threat side
   can draw a Team Rocket ambush (...), an item theft (...), a toll (...), or
   a bad omen (...)"*) to describe the new 8-entry pool instead.
3. Bump `package.json` version to `3.2.0`. Add a newest-first entry to
   `RELEASE_NOTES` in `src/app/data/release-notes.ts` with
   `whatsNew.v3_2_0.*` note keys (2-3 short bullets: threat variety increase,
   Forced Retreat replacing Pay a Toll, mention Marked Target/PC
   Break-in/Poké Ball Malfunction). Add those keys + a `v3_2_0` version label
   to all six locale files (`en` real, others English placeholder).
4. Check `docs/todo/backlog.md` for any existing entry about the threat pool
   being thin / toll redundancy and remove it if this plan supersedes it.

---

## Execution notes

- **Checkpoint after every phase** — do not run multiple phases in one go;
  wait for review before continuing, per repo convention.
- Run `npm run test:local` after each phase; all specs must stay green before
  moving to the next phase.
- Phases 2-5 are independent of each other (no ordering dependency) — only
  Phase 1 (the `toll` removal) should go first, since later phases add net-new
  pool entries rather than touching `toll`.
- Once every phase's checkbox below is done, move this file to `docs/plans/done/`.

## Checklist

- [x] Phase 1 — Rework `toll` → `forcedRetreat`
- [x] Phase 2 — `spooked`
- [x] Phase 3 — `pcBreakIn` (**shipped then removed** — see Post-ship note)
- [x] Phase 4 — `markedTarget`
- [x] Phase 5 — `pokeballMalfunction`
- [x] Phase 6 — i18n cleanup, README, release notes, backlog
