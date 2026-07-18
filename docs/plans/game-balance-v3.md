# Plan: Game balance V3 — Pre-spin battle mechanics

Status: **Ready to implement (Sonnet).** All open decisions from the roadmap are
settled below. 5 phases, checkpoint after each.
Owner: tormarod
Last updated: 2026-07-18
Rationale + roadmap: `docs/research/game-balance-research.md` (§ "V3 — Pre-spin
battle mechanics"). Builds on V1 (implemented) and V2 (Part B implemented —
bias stacking; Part A — Danger meter / choose-between adventure / new threats —
**not yet implemented** as of this writing). V3 does not depend on V2 Part A
landing first; it only touches the battle screens.

## Decisions locked in (from user Q&A, 2026-07-18)

1. **Lead pick is mandatory every battle** — no skip/opt-out. Simpler
   persistence (no "declined" branch), and keeps the mechanic's whole point
   (reward reading the opponent's type) in front of the player every time.
2. **Applies to all four battle types** — gym, rival, Elite Four, Champion.
   One shared implementation point (`BaseBattleRouletteComponent`), no
   per-type branching on whether the step appears.
3. **Pre-spin items: x-attack + potion tiers only.** `escape-rope` and
   `running-shoes` keep their existing, unrelated jobs (negating a Team Rocket
   steal; adventure-wheel reroll) — **do not** touch them or give them new
   battle behavior in this plan. New battle-specific items are V4's job
   (abilities), not V3's.
4. **Lead choice and item use are one editable draft** — the player can change
   the lead after applying an item, and re-apply/un-apply items, freely until
   they hit a single final "Confirm" that commits everything atomically. Only
   the confirm commits to `SavedRun`.

## New in this session: the New-Balance feature flag

The user asked (mid-plan) for V3+V4 to be **opt-in**, bundled into one game
setting, so players can choose "New Balance" vs. the current experience. This
flag is introduced here in V3 (V4 reuses it — see `game-balance-v4.md`).

### Settings — `src/app/services/settings-service/settings.service.ts`
- Add `newBalanceMode: boolean` to the `GameSettings` interface, default
  `false` in `defaultSettings` (existing players keep today's behavior with no
  action needed).
- Add `toggleNewBalanceMode(): void`, following the exact shape of
  `toggleSkipShinyRolls()` (read `currentSettings`, spread + flip the field,
  call `updateSettings`).

### Settings UI — `src/app/settings/settings.component.ts` / `.html`
- Add `onToggleNewBalanceMode(): void { this.settingsService.toggleNewBalanceMode(); }`.
- Add a toggle row in the template bound to `(settings$ | async)?.newBalanceMode`,
  with i18n copy that explicitly warns it's a major difficulty/mechanics change
  (new key `settings.newBalanceMode.description`, e.g. "Adds pre-battle
  choices and higher stakes. Changes take effect on your next run.").

### Locking the flag for the duration of a run
The global setting can change any time, but an **in-progress run must not
retroactively gain or lose these mechanics** — that would let a player dodge a
lead-doubled loss by flipping the setting mid-run, or surprise a Classic-mode
player with a new mechanic they didn't opt into. Snapshot it once, at run
start, the same way `generationId` is snapshotted today.

- `GameStateService` (`src/app/services/game-state-service/game-state.service.ts`):
  add `private newBalanceMode = new BehaviorSubject<boolean>(false);` and
  `newBalanceModeObserver = this.newBalanceMode.asObservable();`.
  - Change `resetGameState()` to `resetGameState(newBalanceMode: boolean): void`,
    setting `this.newBalanceMode.next(newBalanceMode)` alongside the existing
    stack/round reset. Both call sites — `main-game.component.ts:201` and
    `settings.component.ts`'s `onRestartGame()` — pass
    `this.settingsService.currentSettings.newBalanceMode` as the argument (read
    fresh from Settings at the moment a **new run** starts; this is the only
    place the live setting is sampled into a run).
  - Add `restoreNewBalanceMode(value: boolean): void` (sets the BehaviorSubject
    without touching the stack/round) for `RunPersistenceService` to call on
    restore.
  - Add a synchronous getter `get isNewBalanceMode(): boolean { return this.newBalanceMode.value; }`
    for components that need a one-off read (e.g. inside `calcVictoryOdds()`,
    which isn't reactive).
- `RunPersistenceService` (`src/app/services/run-persistence-service/run-persistence.service.ts`):
  - Add `newBalanceMode: boolean` to `SavedRun`.
  - In the `combineLatest` save pipeline, add
    `this.gameStateService.newBalanceModeObserver` as a new source and include
    `newBalanceMode` in the `persistRun(...)` call.
  - In `restoreRun`, call `this.gameStateService.restoreNewBalanceMode(run.newBalanceMode ?? false)`
    (default `false` for saves from before this field existed — old saves are
    always Classic, never silently upgraded to New Balance).
  - In `isValidSavedRun`, accept `run.newBalanceMode === undefined || typeof run.newBalanceMode === 'boolean'`
    (same optional-field tolerance pattern already used for `pendingTypeBiases`).

**Every mechanic below (and everything in V4) is gated behind
`gameStateService.isNewBalanceMode`.** When `false`, every touched component
must behave exactly as it does today — this is the acceptance bar for every
phase.

## Philosophy / constraints (from the roadmap, unchanged)

- **Steering, not escaping.** The lead pick and item step are decisions that
  change *your* odds through knowledge/timing, not an escape hatch.
- **Commit-and-persist the instant a choice is confirmed** — mirrors
  `PendingSpinService`: a reload after Confirm must re-show the exact
  already-computed odds/wheel, never a fresh draft.
- Canon untouchable; the per-Pokémon matchup delta depends only on that
  Pokémon (`TypeMatchupService`), never team composition — V3 doubles an
  existing member's delta, it doesn't invent a new formula.

---

# Part A — Choose your lead

## A1. Expose the per-member signed delta (`TypeMatchupService`)

File: `src/app/services/type-matchup-service/type-matchup.service.ts`

The private `getMemberDeltaSigned(member, opponentTypes)` (line 102) already
computes exactly what "doubling the delta" needs — the signed, magnitude-scaled
contribution of one team member. Rename it to a public method
`getMemberSignedDelta(member: PokemonItem, opponentTypes: PokemonType[]): number`
(update the one internal call site in `calcTeamMatchupTotals`). No behavior
change — this only widens its visibility so `buildVictoryOdds` can call it for
the chosen lead.

## A2. `PendingBattlePrep` + `BattlePrepService` (new)

File: `src/app/services/battle-prep-service/battle-prep.service.ts` (new)

```ts
export interface PendingBattlePrep {
  battleKey: string;       // e.g. 'gym-battle', 'battle-rival', 'elite-four-battle', 'champion-battle'
  leadIndex: number;       // index into trainerTeam at the moment of commit
  xAttackUsed: boolean;
  potionUsed: RegularItemName | null; // 'potion' | 'super-potion' | 'hyper-potion' | null
}
```

- Depends on `TrainerService` directly (unlike `PendingSpinService`, which stays
  dependency-free only because `WheelComponent` is shared by every wheel in the
  app — this service is battle-specific, no such constraint applies).
- `commitPrep(prep: PendingBattlePrep): void` — the **only** mutating entry
  point:
  1. If `prep.xAttackUsed`, remove one `x-attack` from `trainerService`'s items
     (`trainerService.removeItem(...)`, same call `usePotion` already uses).
  2. If `prep.potionUsed`, call the existing potion-consumption path (see A5 —
     this reuses `BaseBattleRouletteComponent.usePotion`, invoked from the
     battle component, not from this service, since `usePotion` needs the
     component's modal-opener callback).
  3. Persist `prep` via a `pendingBattlePrepSubject` (`BehaviorSubject<PendingBattlePrep | null>`),
     which `RunPersistenceService` reads the same way it reads
     `pendingTypeBiases` (see A4).
- `getPendingPrep(): PendingBattlePrep | null` — synchronous read, for a battle
  component that mounts and finds a prep already committed (reload mid-battle,
  after Confirm but before the spin).
- `clearPrep(): void` — called by the battle component once the battle result
  is known (win emitted, or loss fully resolved including any V4 faint), so a
  finished battle's prep can't leak into the next one.
- `restorePrep(prep: PendingBattlePrep | null): void` — for `RunPersistenceService.restoreRun`.

## A3. `buildVictoryOdds` — lead doubling

File: `.../base-battle-roulette/base-battle-roulette.component.ts`

Add an optional parameter and apply the lead's delta a second time:

```ts
protected buildVictoryOdds(
  opponentTypes: PokemonType[] | undefined,
  textPrefix: string,
  baseNoCount: number,
  currentRound: number,
  leadIndex?: number          // NEW
): WheelItem[] {
  ...
  const { yesPower, noBonus, advantageDelta, disadvantageDelta } =
    this.typeMatchupService.calcTeamMatchupTotals(this.trainerTeam, types);

  let leadAdvantageDelta = 0;
  let leadDisadvantageDelta = 0;
  if (leadIndex != null && types.length && this.trainerTeam[leadIndex]) {
    const leadDelta = this.typeMatchupService.getMemberSignedDelta(this.trainerTeam[leadIndex], types);
    if (leadDelta > 0) leadAdvantageDelta = leadDelta;
    else if (leadDelta < 0) leadDisadvantageDelta = -leadDelta;
  }

  const effectivePower = yesPower + leadAdvantageDelta + this.plusModifiers();
  ...
  this.matchupAdvantageDelta = advantageDelta + leadAdvantageDelta;
  this.matchupDisadvantageDelta = disadvantageDelta + leadDisadvantageDelta;
  ...
  const noOdds: WheelItem[] = [];
  const roundThreat = Math.ceil(currentRound * BaseBattleRouletteComponent.ROUND_THREAT_MULT);
  for (let i = 0; i < baseNoCount + roundThreat + noBonus + leadDisadvantageDelta; i++) {
    ...
  }
```

`leadIndex` defaults to `undefined` so every existing call site (and Classic
mode) is unaffected until a caller passes it. The matchup-strip display
(`matchupAdvantageDelta`/`matchupDisadvantageDelta`) already includes the
doubled amount, so the UI stays truthful without separate wiring.

## A4. Persistence wiring (`run-persistence.service.ts`)

- Add `pendingBattlePrep: PendingBattlePrep | null` to `SavedRun`.
- Add `battlePrepService.getPendingPrepObservable()` (a
  `BehaviorSubject.asObservable()`) to the `combineLatest` save pipeline;
  include it in `persistRun(...)`.
- In `restoreRun`, call `this.battlePrepService.restorePrep(run.pendingBattlePrep ?? null)`.
  (Requires injecting `BattlePrepService` into `RunPersistenceService`'s
  constructor.)
- In `isValidSavedRun`, accept `run.pendingBattlePrep === undefined || run.pendingBattlePrep === null || typeof run.pendingBattlePrep === 'object'`.

## A5. Shared prep UI — `BattlePrepPanelComponent` (new, presentational)

Directory: `src/app/main-game/roulette-container/battle-prep-panel/`

One component reused by all four battle screens (DRY — avoids duplicating the
lead-picker/item-picker four times).

Inputs: `team: PokemonItem[]`, `opponentTypes: PokemonType[] | undefined`,
`items: ItemItem[]`.
Output: `confirmed = new EventEmitter<{ leadIndex: number; xAttackUsed: boolean; potionUsed: RegularItemName | null }>()`.

Behavior:
- Renders the team as a pickable list (radio-button semantics — exactly one
  lead selected at all times; **default the selection to index 0** so
  "mandatory" never starts in an unselected state).
- For each team member, show its own `typeMatchupService.getMemberSignedDelta(member, opponentTypes)`
  read (via a small pipe or component method) **before** the pick is made —
  this is what makes "reward reading the opponent's type" an actual, informed
  decision rather than a blind pick. Reuse the existing type-icon rendering
  from `MatchupStripComponent` for visual consistency.
- Item row: an x-attack button (disabled/hidden if the player holds none) and
  a potion button showing the strongest available tier (reuses
  `BaseBattleRouletteComponent.hasPotions()`'s ranking — weakest-first is
  wrong here since this is a *proactive* spend, not exhausting weak potions
  first; show whichever tier the player picks via a small tier selector, or
  just the strongest by default with a way to pick a lower tier — implementer's
  call, not gameplay-load-bearing).
- Both the lead radio and the item buttons are freely re-clickable — nothing
  commits until **Confirm**, which emits `confirmed` with the current draft
  state. No local persistence inside this component; it's a dumb form.

## A6. Wiring into each of the four battle components

Pattern (shown for gym; identical for rival/Elite Four/Champion — same
`BaseBattleRouletteComponent` parent, same shape):

File: `.../gym-battle-roulette/gym-battle-roulette.component.ts`

- Add `prepPhase = true;` and inject `BattlePrepService`.
- In `onGameStateChange` (`state === 'gym-battle'`): after
  `this.getCurrentLeader()`, check
  `gameStateService.isNewBalanceMode`:
  - **Classic mode:** skip straight to today's behavior —
    `prepPhase = false`, `this.calcVictoryOdds()` with no `leadIndex`, open the
    leader-presentation modal, show the wheel. **No behavior change.**
  - **New Balance mode:**
    - If `battlePrepService.getPendingPrep()` already has an entry for this
      `battleKey` (reload after Confirm) — skip the panel, set
      `prepPhase = false`, recompute `calcVictoryOdds()` using the restored
      `leadIndex`, open the leader-presentation modal, show the wheel exactly
      as if Confirm had just been clicked.
    - Otherwise — open the leader-presentation modal as today, but on close,
      show the `BattlePrepPanelComponent` (`prepPhase = true`) instead of the
      wheel.
- Add `onPrepConfirmed(prep: { leadIndex: number; xAttackUsed: boolean; potionUsed: RegularItemName | null }): void`:
  1. `this.battlePrepService.commitPrep({ battleKey: 'gym-battle', ...prep })`
     (persists immediately — anti-reroll).
  2. If `prep.potionUsed`, call the existing `this.usePotion(...)` with the
     matching item from `trainerItems` (banks a retry proactively — identical
     mechanics to today's post-loss potion use, just timed earlier).
  3. `prepPhase = false`; `this.calcVictoryOdds()` (now passes `prep.leadIndex`
     into `buildVictoryOdds`).
- `calcVictoryOdds()` becomes:
  ```ts
  const prep = this.gameStateService.isNewBalanceMode ? this.battlePrepService.getPendingPrep() : null;
  this.victoryOdds = this.buildVictoryOdds(
    this.currentLeader?.types, 'game.main.roulette.gym', 1, this.currentRound,
    prep?.leadIndex
  );
  ```
- On battle resolution (`onItemSelected`, both the win branch and the final
  loss branch after retries are exhausted): call
  `this.battlePrepService.clearPrep()`.

Template (`gym-battle-roulette.component.html`): wrap the existing
`<app-wheel>` block —
```html
@if (prepPhase) {
  <app-battle-prep-panel
      [team]="trainerTeam"
      [opponentTypes]="currentLeader?.types"
      [items]="trainerItems"
      (confirmed)="onPrepConfirmed($event)" />
} @else {
  <app-wheel ...>
}
```

Repeat identically for `rival-battle-roulette` (`battleKey: 'battle-rival'`,
no `retries`/`usePotion` machinery today — see A7), `elite-four-battle-roulette`
(`battleKey: 'elite-four-battle'`), `champion-battle-roulette`
(`battleKey: 'champion-battle'`).

## A7. x-attack behavior change — gated, New-Balance-only

File: `.../base-battle-roulette/base-battle-roulette.component.ts`

Today `plusModifiers()` scans **all** x-attack items in inventory and applies
every one, every battle, **without ever consuming them** (line 82-88) — an
existing quirk, not something V1/V2 touched. Under New Balance, x-attack
becomes an explicit, consumed, pre-spin choice (A6 step 2 removes it from
inventory on use). Change `plusModifiers()`:

```ts
protected plusModifiers(): number {
  if (this.gameStateService.isNewBalanceMode) {
    return 0; // New Balance: x-attack bonus comes from the committed prep instead — see A3's leadIndex-adjacent handling below
  }
  // Classic mode: unchanged passive scan-all-and-apply, never consumed.
  let power = 0;
  const xAttacks = this.trainerItems.filter(item => item.name === 'x-attack');
  ...
}
```

And in `buildVictoryOdds`, add the committed x-attack bonus alongside the lead
doubling (New Balance only): if the calling battle component's `calcVictoryOdds()`
found `prep?.xAttackUsed`, compute the same mean-team-power bonus
`plusModifiers()` used to compute for one x-attack, and add it to
`effectivePower` — pass it as another optional parameter (`xAttackBonus?: number`)
alongside `leadIndex`, computed by the caller as:
```ts
const xAttackBonus = prep?.xAttackUsed
  ? this.trainerTeam.reduce((sum, p) => sum + p.power, 0) / this.trainerTeam.length
  : 0;
```
**Classic mode is untouched**: `plusModifiers()` keeps scanning-and-applying
every x-attack in inventory forever, exactly as today.

---

## Phases (checkpoint after each; `npm run test:local` green each time)

1. **Feature flag plumbing.** `GameSettings.newBalanceMode`, `SettingsService`
   toggle, settings UI row, `GameStateService` snapshot/restore, persistence
   wiring. *Checkpoint: toggling in Settings persists across reload; starting a
   new run snapshots the current value; an in-progress run is unaffected by
   later toggling the global setting.*
2. **`TypeMatchupService.getMemberSignedDelta` + `BattlePrepService` + `buildVictoryOdds` doubling (A1-A4).**
   Unit tests: doubling math for an advantage lead, a disadvantage lead, a
   neutral lead (delta 0, no-op); persistence round-trip of `PendingBattlePrep`.
   No UI yet — drive `buildVictoryOdds` directly in specs with a manual
   `leadIndex`. *Checkpoint: doubled delta shows correctly in
   `matchupAdvantageDelta`/`matchupDisadvantageDelta`.*
3. **`BattlePrepPanelComponent` (A5).** Presentational only, own spec file
   with a fake team/opponentTypes, asserting the per-member delta preview and
   the `confirmed` payload shape. *Checkpoint: panel renders, lead defaults to
   index 0, Confirm emits the right shape.*
4. **Wire into gym (A6, A7), then rival/Elite Four/Champion.** One battle type
   at a time; each gets its own checkpoint. Verify Classic mode is byte-for-byte
   unchanged (existing specs for each battle component must still pass
   unmodified when `newBalanceMode` is `false`). *Checkpoint per battle type:
   New-Balance prep → confirm → wheel odds reflect doubled lead + x-attack;
   reload mid-prep re-shows the panel; reload after confirm skips straight to
   the wheel with the same odds.*
5. **Docs.** README feature entry (agency section). Update this file's status
   once all four battle types are wired; move to `docs/plans/done/`.

## Validation

- `npm run test:local` green throughout.
- **Persistence tests are mandatory**: commit a prep, reload, assert the exact
  same panel state or (if already confirmed) the exact same wheel odds —
  the anti-reroll invariant is the highest-risk part, same as V2's pattern.
- Manual playtest, both modes:
  - Classic mode (setting off): every battle screen behaves exactly as before
    this plan — no prep panel, x-attack still passively always-on.
  - New Balance mode (setting on): every battle opens with the prep panel;
    picking a favorable-type lead visibly raises the Yes share more than a
    non-doubled advantage would; picking a bad-type lead visibly worsens odds
    more than today; x-attack is spent and gone after one use; a pre-committed
    potion shows up as a banked retry.

## Explicitly deferred to V4 (do NOT add in V3)

- Abilities.
- The faint/revive mechanic — V3's lead pick is just odds math; V4 is what
  makes the lead "the mon at risk."
- Any new battle-specific items beyond x-attack/potions (abilities cover that
  ground in V4 instead).
