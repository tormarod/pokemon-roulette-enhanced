# Plan: Remove Classic mode — New Experience becomes the only experience

Owner: tormarod
Status: **shipped in 4.0.0**
Target version: **4.0.0** (MAJOR — the mirror of 3.0.0, which introduced the mode)

> Players who want the untweaked original can play
> [zeroxm/pokemon-roulette](https://github.com/zeroxm/pokemon-roulette) directly.
> This fork stops maintaining a second ruleset.

---

## Decisions (settled — do not re-open)

| # | Question | Decision |
|---|---|---|
| D1 | In-flight saves from **any** pre-4.0 version (Classic *and* New Experience) | **Discard on load**, identified by the absence of `runFormat`. The player lands on `character-select` like a first-time visitor. No notice modal. |
| D2 | Version bump | **4.0.0** |
| D3 | The name "New Experience Mode" in README/UI | **Dropped entirely.** Describe the mechanics as how the game plays. Old shipped release notes keep the term (see R1). |
| D4 | "Buy Potions" mislabel on `start-adventure` / `elite-four-prep` wheels | **Fix in this change** — both already award coins in NE, only the adventure wheel got relabelled. Rename the i18n keys *and* every internal identifier (`buyPotionsEvent` → `foundCoinsEvent`, `buyPotions()` → `foundCoins()`) so the names match what the code does. |
| D5 | The persisted `'buyPotions'` adventure candidate id | **Renamed to `'foundCoins'` too** — full consistency, no exceptions. Safe only because D1 discards every save that could contain the old id. |

**R1 — do not touch shipped release notes.** `whatsNew.v3_*` entries in all six
locales mention "Classic mode is unaffected". Per `CLAUDE.md` those are shipped
history; leave every one of them byte-identical. Only the README and the new
`v4_0_0` entry get written.

**On D1:** discarding a save contradicts the run-persistence fairness invariant
in `CLAUDE.md`. That was raised and overruled twice, deliberately, and the scope
widened from "Classic saves only" to "all pre-4.0 saves" once full identifier
consistency was chosen (see D5) — the game is currently played by a small circle
of friends, so a one-time reset is an acceptable price. Recorded here so a later
session doesn't "fix" it back.

**Consequence to keep in mind:** because *no* pre-4.0 save survives, no code
after this change ever has to interpret pre-4.0 data. That is what makes D5
safe, and it also means the `newExperienceMode` field never needs to be read
again — the discard gate keys off `runFormat` alone. If a future decision
narrows D1 back to "keep New Experience saves", D5 must be revisited at the same
time; the two are coupled.

---

## Current system (read this instead of re-researching)

The mode flag lives in **three** layers, deliberately:

1. **`GameSettings.newExperienceMode`** (`settings.service.ts`) — the Settings
   toggle. Already defaults to `true`.
2. **`GameStateService.newExperienceMode`** — a `BehaviorSubject<boolean>`
   holding a **per-run snapshot**, seeded from the setting in the constructor and
   re-snapshotted by `resetGameState(mode)`. This is what all gameplay reads, via
   the synchronous `isNewExperienceMode` getter. The snapshot exists so flipping
   the setting mid-run can't change the run in progress.
3. **`SavedRun.newExperienceMode`** — persisted, restored with `?? false`.

`GameState` (`game-state.ts`) has **no** mode-specific states. The state machine
is untouched by this work.

### Every behavioural fork (not just hidden UI)

| File:line | Classic branch being deleted |
|---|---|
| `base-battle-roulette.component.ts:139` `plusModifiers()` | Passive, never-consumed X Attack: every x-attack in the bag adds team mean power to **every** battle, forever. |
| `base-battle-roulette.component.ts:285` | `prepPhase` forced false → prep panel never shown. |
| `base-battle-roulette.component.ts:297` | `calcVictoryOdds` ignores committed prep. |
| `base-battle-roulette.component.ts:311` + `rival-battle-roulette.component.ts:32` | `skipRetriesInClassicMode`: rival battles emit the result immediately — no retry decrement, no potion check, **no `finishBattleCleanup()`**. |
| `battle-odds.service.ts:38,40,82,89` | `classicPlusModifiers` input; `abilitiesActive` gate that makes assigned abilities inert. |
| `items.service.ts:49,53` | `NE_ONLY_ITEM_NAMES` = revive/repel/max-repel filtered out of the drop pool. |
| `items.service.ts:73` | `getFindableItems()` returns the full unfiltered pool (no Market disjointness). |
| `trainer.service.ts:532` | `resetItems()` skips the starter X Attack. |
| `roulette-container.component.ts:542` `buyPotions()` | Awards a free tiered potion instead of a coin bundle. |
| `roulette-container.component.ts:577,589` | `awardBattleCoins` / `awardCardCoins` no-op. |
| `roulette-container.component.ts:351` | `showDangerMeter` false. |
| `roulette-container.component.ts:871` | `handleThreatShieldUse` no-op (defensive; the item can't drop in Classic anyway). |
| `roulette-container.component.ts:1153` | Empty-team-after-faint never ends the run. |
| `main-adventure-roulette.component.ts` | The **entire single-spin wheel path**: `baseActions` (16 items), `areaZeroAction`, `actions`, the 17-case `onItemSelected` index switch, and the `@else { <app-wheel/> }` template branch. ~120 lines. |
| `market.component.{ts,html}` | Market button + whole panel hidden; `isAvailable` false. |
| `trainer-team.component.{ts,html}` | Coin pill, Market, marked badge, ability pill hidden. |
| `storage-pc.component.{ts,html}` | Ability pills, capsule assignment UI, marked-card styling hidden; two guard clauses. |

### Behaviour-preservation notes for the executor

- **Removing `skipRetriesInClassicMode` does not change rival behaviour in the
  surviving ruleset.** The flag only fired when the mode was off. In NE, rival
  battles already ran the full `onItemSelected` path with `allowPotions = false`.
- **`showDangerMeter` does not become identical to `showOpponentPreview`.** The
  latter also guards on `!this.generation`. Drop *only* the mode clause; do not
  alias the two getters.
- **`foundCoins` is genuinely translated in all six locales** (`Münzen
  gefunden`, `Monedas Encontradas`, `Pièces trouvées`, `Monete Trovate`,
  `Moedas Encontradas`) — so D4 can reuse those strings rather than adding
  English placeholders.

- **D5 — the `'buyPotions'` adventure candidate id IS renamed to `'foundCoins'`,
  and this is only safe because of D1.** The id is **persisted**:
  `PendingAdventureDraw.candidates: string[]` (`adventure-draw.service.ts`) is
  saved by `RunPersistenceService` as `pendingAdventure`, so pre-4.0
  `localStorage` contains the literal string `'buyPotions'`.
  `MainAdventureRouletteComponent.resolveCandidates()` maps stored ids through
  the pool and **silently** drops unknown ones
  (`.filter((c): c is AdventureCandidate => !!c)`) — so a surviving old save
  would restore a 3-candidate draw as 2, and a committed `picked` index would
  then point at the wrong candidate or at nothing. **D1 removes that class of
  save entirely**, so no migration map is needed and no player can reach the
  degraded path. Do **not** implement an id-migration in `restoreDraw`; the
  discard gate is the migration.

---

## Phase 1 — Mode plumbing removal

- [x] **`src/app/services/settings-service/settings.service.ts`**
  - Remove `newExperienceMode: boolean;` from `GameSettings`.
  - Remove `newExperienceMode: true` from `defaultSettings`.
  - Delete `toggleNewExperienceMode()`.
  - *Leave the stale key in existing stored settings JSON alone.*
    `getInitialSettings()` spreads `{...defaults, ...stored}`, so the dead key
    survives at runtime but is no longer on the type. Harmless. Do **not** add a
    key-whitelist filter — out of scope.

- [x] **`src/app/settings/settings.component.ts`**
  - Delete `onToggleNewExperienceMode()`.
  - `onRestartGame()` → `this.runPersistenceService.startFreshRun();`
  - `SettingsService` is still used (`ngOnInit`, the other toggles) — keep it.

- [x] **`src/app/settings/settings.component.html`**
  - Delete the entire `<div class="col-12">…</div>` block containing
    `id="newExperienceModeSwitch"` (currently lines ~149–164, between the
    `fastSpinSwitch` block and `<app-language-selector>`).

- [x] **`src/app/main-game/main-game.component.ts`**
  - `resetGame()` → `this.runPersistenceService.startFreshRun();`
  - Remove the `SettingsService` constructor param (line 78) **and** its import
    (line 29). Verified: `settingsService` appears nowhere else in the `.ts` and
    nowhere in `main-game.component.html`.

- [x] **`src/app/services/game-state-service/game-state.service.ts`**
  - Delete the `newExperienceMode` field, `newExperienceModeObserver`, the
    5-line comment block above them, the `isNewExperienceMode` getter, and
    `restoreNewExperienceMode()`.
  - Constructor → `constructor(private generationService: GenerationService) {`;
    drop the two seeding lines and the `SettingsService` import.
  - Change `Observable` out of the rxjs import — only `BehaviorSubject` remains
    used (`currentState` etc. use `.asObservable()` with inferred types).
  - `resetGameState(newExperienceMode: boolean = false): void` →
    `resetGameState(): void`; delete the trailing
    `this.newExperienceMode.next(newExperienceMode);`.

- [x] **`src/app/services/trainer-service/trainer.service.ts`**
  - `resetItems(newExperienceMode: boolean = false)` → `resetItems()`; make the
    X Attack push unconditional (drop the `if`).
  - Rewrite the `DEFAULT_X_ATTACK` comment (lines 77–81) to drop the Classic
    justification. Suggested: `// Starter item: one consumed pre-spin X Attack
    to soften a rough opening matchup or a bad-omen draw on the first gym.`

- [x] **`src/app/services/run-persistence-service/run-persistence.service.ts`**
  - Add near the top: `/** Bumped when a save's shape changes incompatibly. */`
    `const RUN_FORMAT = 4;`
  - `SavedRun`: replace `newExperienceMode: boolean;` with `runFormat?: number;`.
  - Remove `this.gameStateService.newExperienceModeObserver,` from the
    `combineLatest` array (it currently sits between
    `getPendingTypeBiasesObservable()` and `getPendingPrepObservable()`).
  - The destructure is **positional** — replace it exactly with:
    ```ts
    ]).subscribe(([state, currentRound, trainerTeam, trainerItems, trainerBadges, , generation, pendingTypeBiases, pendingBattlePrep, dangerMeterState, pendingAdventure, pendingBattleDebuff, markedTeamIndex, pendingCatchEscapeChance, coins, scoutingType, pcLocked, marketStock]) => {
    ```
    (18 slots; the empty slot for `getTrainer()` stays where it is.)
  - In the `persistRun({…})` object: remove `newExperienceMode,` and add
    `runFormat: RUN_FORMAT,`.
  - `startFreshRun(newExperienceMode: boolean)` → `startFreshRun()`; inside,
    `this.trainerService.resetItems();` and
    `this.gameStateService.resetGameState();`. Trim the "toggling New Experience
    Mode needs two restarts" sentence out of its doc comment but keep the rest
    (the stale-`battlePrepService` rationale still applies to any restart).
  - `restoreRun()`: delete the
    `this.gameStateService.restoreNewExperienceMode(run.newExperienceMode ?? false);`
    line.
  - `isValidSavedRun()`: delete the
    `(run.newExperienceMode === undefined || typeof run.newExperienceMode === 'boolean') &&`
    line.
  - **D1 discard gate.** Add this method and call it from `loadRun()`:
    ```ts
    /**
     * 4.0.0 discards every save written before it. Two reasons, both hard:
     * Classic-mode runs describe a ruleset that no longer exists (no coin
     * balance, no danger cadence, a passively-applied X Attack), and pre-4.0
     * saves of *any* mode can hold a pending adventure draw referencing the old
     * `buyPotions` candidate id, which resolveCandidates() would silently drop
     * (see D5). Rather than carry a per-field migration for a game with a
     * handful of players, the whole pre-4.0 shape is dropped: a save is kept
     * only if it carries `runFormat`, which only 4.0+ writes.
     */
    private isPreV4Run(value: unknown): boolean {
      const run = value as { runFormat?: unknown };
      return !(typeof run.runFormat === 'number' && run.runFormat >= RUN_FORMAT);
    }
    ```
    Note this reads **only** `runFormat` — the old `newExperienceMode` field is
    never inspected, so nothing in the codebase after this change refers to it.
    In `loadRun()`, inside the `try`, after `const parsed = JSON.parse(...)`:
    ```ts
    if (this.isPreV4Run(parsed)) {
      this.clearRun();
      return null;
    }
    if (this.isValidSavedRun(parsed)) {
      return parsed;
    }
    ```
    Nothing further is needed for the "fresh start" experience: with `loadRun()`
    returning null, `restoreRun()` never runs and `GameStateService`'s
    constructor state (`'game-start'` + a fully initialized stack) is exactly a
    first-ever visit.

**Checkpoint — stop here for review.** After Phase 1 the build will not compile
(every `isNewExperienceMode` call site is now a type error). That is expected;
Phases 2–4 close it. Do not start Phase 2 without a go-ahead.

---

## Phase 2 — Battle path

- [x] **`src/app/services/battle-odds-service/battle-odds.service.ts`**
  - `BattleOddsInput`: delete `classicPlusModifiers?: number;` and
    `abilitiesActive: boolean;`.
  - `BattleOddsBreakdown.yes.xAttack` comment → `// xAttackBonus`.
  - `computeOdds`: `const xAttack = input.xAttackBonus ?? 0;`
  - Replace the conditional abilities block with an unconditional one:
    ```ts
    const a = this.abilityService.applyTeamAbilities(team, opponentTypes,
      { round: currentRound, roundThreat, badOmen });
    const abilityYes = a.yesBonus, abilityNo = a.noBonus, extraRetry = a.extraRetry;
    ```
    (`let abilityYes = 0, abilityNo = 0, extraRetry = false;` goes away.)
  - `xAttackBonus()` doc: drop the final "Classic mode does NOT use this" sentence.

- [x] **`src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts`**
  - Delete `plusModifiers()` entirely (lines 132–150, comment included).
  - Delete `skipRetriesInClassicMode` (lines 93–94).
  - `buildVictoryOdds`: drop `classicPlusModifiers: this.plusModifiers(),` and
    `abilitiesActive: this.gameStateService.isNewExperienceMode,` from the
    `computeOdds` input.
  - `onGameStateChange`: `this.prepPhase = !committed;`
  - `calcVictoryOdds`: `const prep = this.battlePrepService.getPendingPrep();`
  - `onItemSelected`: delete the whole
    `if (this.skipRetriesInClassicMode && !…isNewExperienceMode) { … return; }`
    block (lines 311–314).
  - `gameStateService` is still used (`currentState` subscription) — keep it.
  - `trainerItems` is still used by `hasPotions()` — keep it.

- [x] **`…/roulettes/rival-battle-roulette/rival-battle-roulette.component.ts`**
  - Delete `protected override readonly skipRetriesInClassicMode = true;` (line 32).
  - Keep `allowPotions = false` — that is the surviving rival rule.

- [x] **`…/roulette-container/battle-prep-panel/battle-prep-panel.component.ts`**
  - Delete `classicPlusModifiers: 0,` and
    `abilitiesActive: this.gameStateService.isNewExperienceMode,` (lines 86, 88).
  - `gameStateService` becomes unused here — remove the constructor param
    (line 60) and the import (line 12). **Verify** with a grep first; if the
    template or another method touches it, keep it.

**Checkpoint — stop for review.**

---

## Phase 3 — Adventure step

- [x] **`…/roulettes/main-adventure-roulette/main-adventure-roulette.component.ts`**
  - Delete `baseActions` (lines 77–94), `areaZeroAction` (96–100),
    `actions` (102), `isNewExperienceMode` (108), and the whole
    `onItemSelected(index)` switch (340–394).
  - `ngOnInit` becomes:
    ```ts
    ngOnInit(): void {
      this.generationSubscription = this.generationService.getGeneration().subscribe(generation => {
        this.isGeneration9 = generation.id === 9;
      });

      // Re-draw on every entry into this state, not just component construction.
      // Some actions (e.g. multitask) route back to 'adventure-continues' without
      // the component being destroyed/recreated — Angular's @switch only rebuilds
      // on a genuine case change, so relying on ngOnInit alone missed same-state
      // re-entries and left the already-picked, stale candidates on screen
      // (multitaskEvent fired, the round counter advanced, but nothing visibly
      // happened). currentState is a BehaviorSubject, so this also fires
      // synchronously for the normal first-render case, same as before.
      this.gameStateSubscription = this.gameStateService.currentState.subscribe(state => {
        if (state === 'adventure-continues') {
          this.initializeDraw();
        }
      });
    }
    ```
  - Remove `WheelComponent` from the `imports:` array and its import statement;
    remove the now-unused `WheelItem` import.
  - `actionHandlers` doc comment: replace the "same output event Classic mode's
    `onItemSelected` switch uses" phrasing with e.g. *"Routes a drawn/picked
    candidate id to its output event, keyed by a stable id rather than a list
    index — a draw persisted across reload can't rely on index order."*
  - `isGeneration9` is still read by `initializeDraw()` — keep it.

- [x] **`…/main-adventure-roulette.component.html`**
  - Delete the `@if (isNewExperienceMode) {` wrapper and the whole
    `} @else { <app-wheel …/> }` branch, promoting
    `@if (stepType === 'reward') { … }` to top level. Keep the leading
    `respinReason` block and the trailing `<div class="roulette-action-row">`.

**Checkpoint — stop for review.**

---

## Phase 4 — Items, coins, panels

- [x] **`src/app/services/items-service/items.service.ts`**
  - Delete `NE_ONLY_ITEM_NAMES` and its comment;
    `getRegularItems()` → `return Object.values(this.regularItemsData);`
  - `getFindableItems()`: delete the `if (!…isNewExperienceMode) return regularItems;`
    early return. Update its doc comment (drop the Classic sentence).
  - `GameStateService` becomes unused — delete the constructor entirely and the
    import. (`MARKET_PRICES` and everything else stay.)

- [x] **`src/app/main-game/roulette-container/roulette-container.component.ts`**
  - `showDangerMeter` (≈351): drop only the `!…isNewExperienceMode ||` clause
    from the condition. Rewrite the doc comment (drop the Classic sentence).
  - `buyPotions()` (≈538): delete the classic tail entirely — the method becomes
    just the coin-bundle body, and the early `return` is no longer needed:
    ```ts
    /** A found-coins bundle from the adventure/prep wheels. */
    buyPotions(): void {
      this.coinsFoundAmount = foundCoinsReward();
      this.trainerService.addCoins(this.coinsFoundAmount);
      this.playItemFoundAudio();
      void this.openCoinsFoundModal();
      this.finishCurrentState();
    }
    ```
    After this, check whether the `ItemName` import and
    `this.itemService.getItem(...)` are still used elsewhere in the file; drop
    the import only if genuinely orphaned.

- [x] **D4/D5 rename: every `buyPotions` becomes `foundCoins`.** Once the method
      no longer buys anything, the name is actively misleading. This includes the
      persisted candidate id, which D1's discard gate makes safe (see D5). Do it
      in one pass; the goal is that `grep -rn buyPotions src/` returns **zero
      hits** afterwards:
  - `roulette-container.component.ts`: `buyPotions(): void` → `foundCoins(): void`
    (≈538), and the two `return this.buyPotions();` call sites (≈488, ≈506).
  - `roulette-container.component.html`: all three
    `(buyPotionsEvent)="buyPotions()"` bindings (lines 33, 91, 215) →
    `(foundCoinsEvent)="foundCoins()"`.
  - `@Output() buyPotionsEvent` → `foundCoinsEvent`, plus each `.emit()` call, in
    all three emitting components:
    `main-adventure-roulette.component.ts` (declaration line 50, `actionHandlers`
    line 186, and the `onItemSelected` emit at 349 — the latter disappears with
    Phase 3 anyway), `elite-four-prep-roulette.component.ts` (37, 60),
    `start-adventure-roulette.component.ts` (18, 35).
  - **The `rewardPool` candidate id** (`main-adventure-roulette.component.ts:124`):
    `{ id: 'buyPotions', … }` → `{ id: 'foundCoins', … }`, and the matching
    `actionHandlers` key (186) → `foundCoins: () => this.foundCoinsEvent.emit(),`.
    Replace the two-line comment above it (122–123, "New Experience repurposes
    this card as a coin bundle… the id stays `buyPotions`") with a note that the
    id is persisted in `pendingAdventure`, so changing it again would need the
    same save-discard treatment.
  - Spec fixtures **do** get updated this time — the `candidates: ['catchPokemon',
    'buyPotions', 'findItem']` literals in
    `main-adventure-roulette.component.spec.ts` (195, 196, 206, 215, 219, 223)
    become `'foundCoins'`.
  - Specs referencing the emitter name: `roulette-container.component.spec.ts`
    (415–418, 433–436 — including the two `it('… → buyPotions()')` titles),
    `main-adventure-roulette.component.spec.ts` (83, 193, 200, 208, 227, 232),
    `elite-four-prep-roulette.component.spec.ts` (29),
    `start-adventure-roulette.component.spec.ts` (28).
  - `awardBattleCoins` (≈577) and `awardCardCoins` (≈589): delete the
    `if (!…isNewExperienceMode) return;` guards; drop "(New Experience only)"
    from their doc comments.
  - `handleThreatShieldUse` (≈871): delete the guard; rewrite the trailing
    "NE-only safety net…" sentence out of the comment.
  - `multitask()` (≈909): drop the "No-op in Classic mode…" sentence from the
    comment.
  - `rivalBattleResult` (≈1153): `if (this.trainerService.getTeam().length === 0) {`.

- [x] **`src/app/trainer-team/market/market.component.{ts,html}`**
  - `.ts`: delete the `isNewExperienceMode` getter; in `isAvailable`, the guard
    becomes `if (this.wheelSpinning) { return false; }`. Update the class-level
    doc comment (line ~67) to drop "Hidden in Classic mode (no coins exist there)".
    `gameStateService` stays (used for `currentGameState`).
  - `.html`: delete the outer `@if (isNewExperienceMode) {` / closing `}`,
    dedenting the contents.

- [x] **`src/app/trainer-team/trainer-team.component.{ts,html}`**
  - `.ts`: delete the `isNewExperienceMode` getter (lines 110–113).
  - `.html`: unwrap all three gates — the `utility-right` block (line 15), the
    `i === markedIndex` badge (61 → `@if (i === markedIndex) {`), and the ability
    pill (69 → collapse the outer `@if` into just the inner
    `@if (getMemberAbilityName(...); as abilityName)`).

- [x] **`src/app/trainer-team/storage-pc/storage-pc.component.{ts,html}`**
  - `.ts`: delete the `isNewExperienceMode` getter (188–190) and its comment;
    drop `!this.isNewExperienceMode ||` from `openAbilityPicker`'s guard (209)
    and `!this.isNewExperienceMode ||` from `assignAbility`'s guard (218). Keep
    the "Ability assignment" section header comment but drop "(New Experience
    only)".
  - `.html`: unwrap all six gates (lines 23, 24, 37, 43, 49, 97, 103, 110) —
    `isNewExperienceMode && X` → `X`; a bare `@if (isNewExperienceMode)` wrapper
    → unwrap. Note line 103's compound condition becomes
    `@if ((pokemon.fainted && hasRevive()) || (!pokemon.fainted && ownedCapsules().length)) {`.
  - **`gameStateService` may become unused in both these components — grep before
    removing the injection.**

- [x] **Theme check (required by `CLAUDE.md`).** These unwraps make the coin
  pill, Market button, ability pills, and marked badge render in states they
  never did before *only* for players who were on Classic — the markup and CSS
  are unchanged, so no new styling work is expected. Still confirm the
  trainer-team strip and PC modal in `theme-starters` **and** `theme-plain-light`
  before calling Phase 4 done.

**Checkpoint — stop for review. The build should compile clean at the end of
this phase.** Run `npm run build` and `npx tsc --noEmit` (or the build's type
check) before moving on.

---

## Phase 5 — Specs

Delete the Classic-only tests; convert the mode-setup calls. `resetGameState(true)`
appears 21×, `resetGameState(false)` 5×, `resetGameState()` 13× — every call
becomes `resetGameState()`, and `restoreNewExperienceMode(…)` (16 call sites)
disappears entirely.

- [x] **`settings.service.spec.ts`** — delete all four `newExperienceMode` tests
      (`should default newExperienceMode to true`, `should toggle …`,
      `should persist … across a fresh service instance`, and the one at line 44).
      8 → 4 tests.

- [x] **`game-state.service.spec.ts`** — delete the whole
      `── newExperienceMode snapshot ──` section (4 tests, lines 72–98).
      Retarget any `resetGameState(true|false)` elsewhere to `resetGameState()`.

- [x] **`items.service.spec.ts`** — delete the three Classic tests
      (`excludes revive …`, `excludes repel/max-repel …`,
      `getFindableItems is unchanged …`). Rename the surviving ones to drop
      "in New Experience mode" (e.g. `includes revive in regular items`).
      In `keeps ability capsules OUT of the regular item drop pool (both modes)`
      → drop "(both modes)" and the two `restoreNewExperienceMode` lines,
      keeping one assertion. Remove the `GameStateService` import and the
      `gameStateService` local.

- [x] **`run-persistence.service.spec.ts`** — the biggest sweep (47 tests).
  - Delete `should save the newExperienceMode snapshot taken at run start`,
    `should restore newExperienceMode from a saved run on construction`, and
    `should default newExperienceMode to false when restoring an older save
    without the field`.
  - Strip `newExperienceMode: true,` / `: false,` from every saved-run fixture
    (lines 102, 174, 251, 355, 429, 501, 573, 645, 717, 787, 861, 932, 988, 1079)
    and add `runFormat: 4,` to each fixture that must still restore.
  - Delete the two `isNewExperienceMode` assertions at 1184 and 1201 and the
    Classic-starter-X-Attack test around 1199.
  - **Add these tests for D1** (note the third row is the one that changed when
    D1 widened — a pre-4.0 New Experience save is now discarded too):
    | Input | Expected |
    |---|---|
    | Stored run with `newExperienceMode: false`, no `runFormat` | `loadRun()` returns `null` **and** the `localStorage` key is removed |
    | Stored run with neither field (pre-3.0 save) | `loadRun()` returns `null`, key removed |
    | Stored run with `newExperienceMode: true`, no `runFormat` | `loadRun()` returns `null`, key removed |
    | Stored run with `runFormat: 4` | `loadRun()` returns the run; team/items/round restored |
    | A run persisted by the current code | contains `runFormat: 4`, and `loadRun()` accepts it on a fresh service instance |
    | Stored run with `runFormat: 4` and `pendingAdventure.candidates` containing `'foundCoins'` | restores 3 candidates; none silently dropped |

- [x] **`main-adventure-roulette.component.spec.ts`** — delete the **entire
      first `describe('MainAdventureRouletteComponent')` block** (lines 14–116):
      all five tests in it (`should create`, the two `component.actions` tests,
      and the two `onItemSelected` routing tests) exercise only the deleted
      wheel. Move a plain `should create` into the surviving block. Rename the
      second block from `— New Experience mode` to just
      `MainAdventureRouletteComponent`, change `resetGameState(true)` →
      `resetGameState()`, and delete the `localStorage.clear()` +
      "requires New Experience Mode to be off" comment. Keep the
      `WheelComponent` import **only** if the `expect(…query(By.directive(
      WheelComponent))).toBeFalsy()` assertion at line 174 is kept — it's now
      trivially true, so prefer deleting that one assertion and the import.
      Coverage lost: gen-9 Area Zero on the wheel. Replace it with a test that
      a gen-9 draw can surface `areaZero` (spy `rollStep` → `'reward'`, drive
      the generation subject to 9, assert `areaZeroCandidate` is in
      `component['resolveCandidates'](['areaZero'])` — or simply drop this
      coverage and note it; the reward-pool path is already covered).

- [x] **`base-battle-roulette.component.spec.ts`** — rename
      `does not affect odds when leadIndex is undefined (Classic mode / no lead
      chosen)` → `(no lead chosen)`. Check for any `plusModifiers` /
      `classicPlusModifiers` / `abilitiesActive` references and drop them.

- [x] **`rival-battle-roulette.component.spec.ts`** — delete the
      `── Classic mode: rival's win/loss-only mechanic stays untouched ──`
      section including `should not decrement retries or consult potions in
      Classic mode`.

- [x] **`battle-odds.service.spec.ts`** — delete
      `ignores ability effects when abilitiesActive is false (Classic mode)`;
      remove `abilitiesActive` (and any `classicPlusModifiers`) from every
      `computeOdds` input literal in the file.

- [x] **`roulette-container.component.spec.ts`** — delete
      `is hidden in Classic mode even once the adventure has started`,
      `does not end the run on an empty team in Classic mode …`,
      `a gym win grants no coins in Classic mode`,
      `an exploreCave card grants no coins in Classic mode`. Rename
      `reachStartAdventureNE` → `reachStartAdventure` and its
      `resetGameState(true)` → `resetGameState()`.

- [x] **`storage-pc.component.spec.ts`** — delete
      `does not assign or consume in Classic mode` and
      `hides the marked badge in Classic mode even if a mark is set`; drop the
      four `restoreNewExperienceMode` calls.

- [x] **`trainer-team.component.spec.ts`** — delete
      `hides marked badge / ability pill in Classic mode even if the underlying
      data is set`; drop the two `restoreNewExperienceMode` calls.

- [x] **`market.component.spec.ts`** — delete
      `Classic mode has no stock limits (Market is hidden)` (line 264) or
      rewrite it against `isAvailable`; drop the `restoreNewExperienceMode(false)`
      call.

- [x] `npm run test:local` — **full suite green, zero pending/skipped.**

**Checkpoint — stop for review.**

---

## Phase 6 — i18n, D4 label fix, docs, release

- [x] **Delete from all six locales** (`src/assets/i18n/{en,de,es,fr,it,pt}.json`):
  - `settings.newExperienceMode` (the whole `{ title, description }` object).
  - `game.main.roulette.adventure.actions.buyPotions` — now unused; the adventure
    wheel's coin card uses `…actions.foundCoins`.
  - **Do not** delete `game.main.roulette.start.actions.buyPotions` or
    `game.main.roulette.elite.prep.actions.buyPotions` outright — **rename**
    them (next step).

- [x] **D4 label fix — rename the keys, don't just re-value them.** In all six
      locales, rename
      `game.main.roulette.start.actions.buyPotions` → `…start.actions.foundCoins`
      and `game.main.roulette.elite.prep.actions.buyPotions` →
      `…elite.prep.actions.foundCoins`, giving each that locale's existing
      `game.main.roulette.adventure.actions.foundCoins` string:

  | locale | new value |
  |---|---|
  | en | `Found Coins` |
  | de | `Münzen gefunden` |
  | es | `Monedas Encontradas` |
  | fr | `Pièces trouvées` |
  | it | `Monete Trovate` |
  | pt | `Moedas Encontradas` |

  Then update the two referencing components and their specs:
  - `…/roulettes/start-adventure-roulette/start-adventure-roulette.component.ts:23`
    → `'game.main.roulette.start.actions.foundCoins'`
  - `…/roulettes/elite-four-prep-roulette/elite-four-prep-roulette.component.ts:46`
    → `'game.main.roulette.elite.prep.actions.foundCoins'`
  - `start-adventure-roulette.component.spec.ts:40` and
    `elite-four-prep-roulette.component.spec.ts:42` assert the key string —
    update both.

  After this, grep for `actions.buyPotions` across `src/` — it should return
  **zero** hits (the adventure wheel's key was deleted in the step above, and
  these two are renamed).

- [x] **`package.json`** — `"version": "4.0.0"`.

- [x] **`src/app/data/release-notes.ts`** — prepend, newest-first:
      ```ts
      {
        version: '4.0.0',
        date: '<ship date>',
        noteKeys: [
          'whatsNew.v4_0_0.0',
          'whatsNew.v4_0_0.1',
        ],
      },
      ```
      `CURRENT_VERSION` derives from this automatically.

- [x] **All six locales** — add the top-level version label and the notes.
      (The label is a **top-level** key, not under `whatsNew` — see
      `whats-new.component.html:15`.)
      - top level: `"v4_0_0": "Version 4.0.0"` (translate "Version" per locale,
        matching the existing `v3_*` labels in that file)
      - `whatsNew.v4_0_0.0` (en): `"🎲 One game, one ruleset. Everything that used to be behind the optional mode toggle — battle prep, the Danger meter and threats, abilities, Coins and the Market — is now simply how the game plays, and the Settings toggle is gone. Want the untweaked original? Play zeroxm's version."`
      - `whatsNew.v4_0_0.1` (en): `"🪙 The \"Buy Potions\" card on the pre-adventure and Elite Four prep wheels now says \"Found Coins\", which is what it has actually been awarding."`
        (Player-facing text only — the identifier rename in Phase 4 needs no note.)
      - `whatsNew.v4_0_0.2` (en) — **required, not optional.** D1 now discards
        *every* pre-4.0 save, so anyone mid-run loses it. That must be said:
        `"♻️ One-time reset: runs started before this version can't be carried over and have been cleared, so your next visit starts a fresh run. Runs saved from here on restore as normal."`
      - de/es/fr/it/pt: English placeholder is acceptable per `CLAUDE.md`.
      - Add `'whatsNew.v4_0_0.2'` to the `noteKeys` array in `release-notes.ts`.
      - **Ordering caveat:** the What's New modal only shows to a visitor whose
        stored `last-seen-version` is older than 4.0.0 — which is exactly the set
        of players whose run just got cleared, so the note reaches its audience.
        A brand-new player sees it too and it will read as harmless noise; that's
        an acceptable trade for not silently eating a friend's run.

- [x] **`README.md`** — per D3, drop the mode framing throughout.
  - Feature list (lines 15, 16, 18, 21, 29): rewrite so nothing reads as
    "opt-in", "off by default", or "existing players see no change unless they
    opt in".
  - Rename `## New Experience Mode` (line 48) to something descriptive —
    suggested `## Battle prep, threats & stakes` — and rewrite its body
    (lines 50–64): delete the opt-in/snapshot paragraph at line 50, and strike
    every "Classic mode is unaffected / unchanged / never has …" clause at
    lines 54, 58, 60, 64.
  - Line 70 and 78 (`## Economy & the Market`): drop "Also New Experience
    Mode-only" and "Classic mode has no coins, Market, or item selling".
  - Line 93 (persistence): drop "New Experience Mode's" from the coin-balance
    mention; **add** a sentence that any save written before 4.0.0 — Classic or
    New Experience — is discarded on load, since that is a user-visible
    persistence behaviour and a documented exception to the "a reload never
    wipes your run" guarantee stated in that same paragraph.
  - Add a line to the "New features added on top of the original" list noting
    Classic mode's removal in 4.0.0 (this list is the fork's changelog).

- [x] **`CLAUDE.md`** — line 71 cites "New Experience Mode was 3.0.0" as the
      MAJOR example. Leave the example (it's still true history) but it's fine to
      append "; removing Classic mode was 4.0.0" as a second example.

- [x] **`docs/todo/backlog.md`** — verified: no open entry covers this work, so
      nothing to delete. If the Phase 5 gen-9 Area Zero coverage is dropped
      rather than replaced, add an entry for restoring it.

- [x] Move this file to `docs/plans/done/remove-classic-mode.md`.

---

## Acceptance tests

Automated (`npm run test:local`) — full suite green after Phase 5.

| # | Input | Expected |
|---|---|---|
| A1 | Fresh visitor, no `localStorage` | Game starts at `character-select`; Settings has **no** New Experience toggle; the run has battle prep, the Danger meter, Coins, and Market available |
| A2 | `localStorage` run with `newExperienceMode: false` | Save discarded and the key removed; player lands at `character-select` |
| A3 | `localStorage` run with `newExperienceMode: true`, mid-run (pre-4.0 New Experience save) | **Also** discarded — key removed, player lands at `character-select`. This is the intended one-time reset, not a bug |
| A4 | Save a run in 4.0.0, reload | Persisted JSON contains `runFormat: 4`; run restores fully — team, PC, items, coins, badges, round, screen |
| A5 | Reach a gym battle | Prep panel shown (lead pick + optional X Attack); odds identical to pre-change NE odds for the same inputs |
| A6 | Hold 3 X Attacks, do **not** commit one in prep, spin | Odds show **no** X Attack contribution (the old passive Classic stacking is gone in every case) |
| A7 | Lose a rival battle | Lead faints, goes to PC greyed out; no potion offered; `finishBattleCleanup()` runs (mark/debuff/scouting/PC-lock all cleared) |
| A8 | Empty the team via a rival faint | Run ends (`game-over`) |
| A9 | Reach `adventure-continues` | 3-row picker on a reward step, auto-routed threat on a threat step — **never** the old single wheel |
| A10 | Land the coin card on the pre-adventure and Elite Four prep wheels | Label reads "Found Coins" (localised); coins awarded, no potion |
| A10b | `grep -rn "buyPotions" src/` after Phase 6 | **Zero hits.** Not in i18n, not as an emitter, method, candidate id, `actionHandlers` key, or spec fixture |
| A10c | Start a 4.0 run, reach a reward step, reload before picking | All 3 candidate rows re-render with the same ids; picking the coin row awards coins (guards the D5 rename end-to-end) |
| A11 | Fresh run's starting bag | potion, honey, repel, **and** x-attack |
| A12 | Spin Find Item repeatedly | Pool excludes Market-sold items; revive/repel/max-repel are reachable |
| A13 | Assign an ability capsule from the PC | Badge shows; the ability shifts battle odds |
| A14 | Player whose last-seen version is 3.16.2 loads 4.0.0 | What's New modal opens showing the 4.0.0 entry |
| A15 | Settings → Restart, and sidebar Restart | Both start a clean run with the full ruleset; no stale prep/danger/draw state |

Manual theme pass (`theme-starters` + `theme-plain-light`): trainer-team strip
(coin pill, Market button, ability pill, marked badge) and the PC modal.

---

## Deliberately out of scope

- Purging the stale `newExperienceMode` key from stored *settings* JSON.
- Rewriting shipped `whatsNew.v3_*` notes (see R1).
- Any balance retune. The surviving ruleset's numbers are unchanged; the only
  odds-affecting deletion is Classic's passive X Attack, which never applied in
  the surviving mode anyway.
- `docs/plans/adaptive-utility-rail-labels.md` mentions New Experience Mode in
  passing (lines 38, 229). It's an active plan, not shipped docs — leave it;
  whoever executes it will read the then-current code.
