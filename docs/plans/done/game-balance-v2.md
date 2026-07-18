# Plan: Game balance V2 — Steering

Status: **Done.** All 6 phases implemented and checkpointed (Part A gated behind
`isNewExperienceMode`; Part B ungated per 2026-07-18 decision — see "Feature
flag gating" below). Full test suite green (694 specs). README updated with
Danger-meter/choose-between-adventure and bias-visual-feedback coverage.
Owner: tormarod
Last updated: 2026-07-18
Rationale + roadmap: `docs/research/game-balance-research.md`.
Gated behind the **New Experience Mode** feature flag introduced in V3
(`docs/plans/done/game-balance-v3.md`) — see "Feature flag gating" below. This
supersedes this plan's original "Rationale" framing, which predates the flag.

## Philosophy / constraints (unchanged)

- Luck + type knowledge; **steering, not escaping** (no reroll/escape tools here).
- **Every reload-sensitive choice must commit-and-persist the instant it's made**,
  mirroring `PendingSpinService` (a reload must never let a player re-roll a drawn
  choice, un-use an item, or dodge a threat). This is called out per phase.
- Canon untouchable (leader types, real-Pokémon relations).
- Deferred: pre-spin battle mechanics → **V3** (done); abilities + defeat mechanic → **V4**.

## Feature flag gating (added 2026-07-18, post-V3)

V3 introduced `GameSettings.newExperienceMode` (`settings.service.ts`), snapshotted
per-run into `GameStateService` (`isNewExperienceMode` / `newExperienceModeObserver`
/ `restoreNewExperienceMode`) and persisted via `RunPersistenceService`. **All of
V2 — Part A and Part B — is gated behind this same flag**, following the exact
pattern V3 established:

- **Classic mode (`isNewExperienceMode === false`): every touched screen behaves
  byte-for-byte as it does today.** The main adventure stays a single spin over
  `baseActions` (no Danger meter, no choose-between, no new threats). Bias items
  keep today's single-entry (non-stacking) behavior. This is the acceptance bar
  for every phase, exactly as in V3.
- **New Experience mode (`isNewExperienceMode === true`):** the choose-between
  adventure, Danger meter, new threats, and bias stacking/in-wheel-use/visual
  feedback all apply. Reuses V3's already-snapshotted flag — no new setting, no
  new snapshot/restore plumbing needed for the flag itself.
- Read the flag the same way V3's battle components do: reactively via
  `gameStateService.newExperienceModeObserver` where a component needs to react
  to it, or synchronously via `gameStateService.isNewExperienceMode` in one-off
  checks (mirroring `calcVictoryOdds()`'s pattern in V3), e.g. inside
  `MainAdventureRouletteComponent`/`roulette-container` branch logic.
- New persisted state this plan adds (`dangerPercent`, `consecutiveThreats`,
  `pendingAdventure`, `pendingBattleDebuff`, bias `stacks`) is written/read
  unconditionally in `RunPersistenceService` (same pattern as `pendingBattlePrep`
  in V3 — the field always exists in `SavedRun`, defaulted for old saves), but
  is only ever mutated away from its default when `isNewExperienceMode` is true.
  A Classic-mode run simply never touches these fields, so restoring one is a
  no-op read of defaults.
- `DangerMeterService.rollStep` and all new threat/reward routing in
  `roulette-container` must not be invoked at all when `isNewExperienceMode` is
  false — `MainAdventureRouletteComponent` branches at the top (mirroring V3
  A6's per-battle-component branch) between "Classic: render `<app-wheel>` with
  `baseActions` as today" and "New Experience: meta-roll → draw 3 → render
  pick-cards."
- Part B (bias stacking) is gated too, per explicit instruction — a Classic-mode
  run's bias items keep their current one-entry-replaces-previous behavior
  (`setTowardBias`/`setAwayBias` unchanged when the flag is off); stacking logic
  in B1 only activates under New Experience mode.

## What V2 delivers

1. **Adventure = choose-between** (pick 1 of 3) instead of a passive spin, split into
   a **reward** step and a **threat** step, paced by a **Danger meter**.
2. **New threats** (3 new + Team Rocket reused) to stock the threat step.
3. **Bias-item rework**: stacking, use-in-wheel, visual feedback.

---

# Part A — Danger meter + choose-between adventure

## A1. `DangerMeterService` (new, `services/danger-meter-service/`)

The cadence engine. Holds two persisted numbers and decides each adventure step.

Constants (all tunable):
```
BASE = 5;  CURVE = 5;  CAP = 70;   // base(round) = min(CAP, BASE + CURVE * round^2)
RELIEF = 20;  RECOVERY = 10;  FLOOR = 5;  PITY = 3;
```
State (persisted — see A5): `dangerPercent: number` (init 5), `consecutiveThreats: number` (init 0).

`base(round) = Math.min(CAP, BASE + CURVE * round * round)` → 5,10,25,50,70,70,…

`rollStep(round): 'reward' | 'threat'`:
```
if (consecutiveThreats >= PITY) { consecutiveThreats = 0; recover(round); return 'reward'; } // hard pity
const isThreat = Math.random() * 100 < dangerPercent;
if (isThreat) {
  dangerPercent = Math.max(FLOOR, dangerPercent - RELIEF);
  consecutiveThreats++;
  return 'threat';
} else {
  recover(round); consecutiveThreats = 0; return 'reward';
}
// recover(round): dangerPercent = Math.min(base(round), dangerPercent + RECOVERY)
```
Expose `dangerPercent$` (BehaviorSubject) for the meter UI. On a new run, reset to
init. **Do NOT call `rollStep` until the outcome is about to be committed** (see A2)
— rolling must be the committed action, not a preview.

## A2. Choose-between flow (`main-adventure-roulette` + `roulette-container`)

Replace "spin one wheel → emit outcome" with: **meta-roll → draw 3 → player picks**.

- On entering an adventure step: call `dangerMeterService.rollStep(currentRound)`
  to get `stepType`. Draw **3 distinct** candidates from the matching pool
  (weighted by the current adventure weights):
  - **reward pool** = the existing `main-adventure` reward/neutral outcomes
    (catchPokemon, catchTwoPokemon, findItem, buyPotions, mysteriousEgg, legendary,
    fossil, fishing, daycare, exploreCave, tradePokemon, snorlax, multitask,
    areaZero) **plus "Track down Team Rocket"** (A3).
  - **threat pool** = `teamRocketAmbush`, `itemTheft`, `toll`, `badOmen` (A3).
- Present the 3 as **pickable cards/buttons** (not a spin). On click, emit that
  outcome's existing event → it executes exactly as today (catch still spins, etc.).
- Keep `catchPokemon` heavily represented in the reward pool (bias the draw so it
  appears often), preserving the core loop.

**Persistence (anti-reroll) — new `pendingAdventure` state in `SavedRun`:**
`{ stepType: 'reward'|'threat', candidates: string[], picked: number | null }`.
- Written the moment the 3 candidates are drawn (so a reload re-shows the **same**
  three — no re-draw for better options) and again when `picked` is set.
- On restore: if `picked === null`, re-present the same candidates; else re-emit the
  picked outcome. Cleared when the step resolves.
- The `dangerMeter` numbers are committed by `rollStep` before candidates are shown,
  and persisted in the same save write.

## A3. New threats + Team Rocket reuse

- **`teamRocketAmbush`** (reuse): opens the existing Team Rocket mini-wheel
  (`team-rocket-roulette`, steal/run/defeat). This is the "high-variance poison"
  (can whiff to run-away). No new code beyond routing the threat card to the
  existing `teamRocketEncounterEvent`.
- **"Track down Team Rocket"** (reward pool, new routing): also opens the existing
  TR mini-wheel, but only offered as a *reward* choice; it's a **gamble** (reuse the
  wheel as-is — it already weights `defeat`/recover to 4 when a stolen mon exists).
  Contextually most valuable after a theft. No new wheel — new event routing +
  i18n label only.
- **`itemTheft`** (new handler in `roulette-container`): remove one random item via
  `trainerService.removeItem(item)` (pick a random entry from `getItems()`; if the
  inventory is empty, fall back to a harmless "they found nothing" — never a
  no-cost card in the pool, but empty inventory is a legit edge). Show a modal.
- **`toll`** (new handler): the player **picks** an item to hand over (a small
  pick-list of current items → `removeItem`). If they hold no items, it costs a
  team Pokémon instead (reuse the inverse-power steal pick so a weak mon goes).
  This adds a decision *within* the threat.
- **`badOmen`** (new handler + new persisted state): set
  `pendingBattleDebuff: number` in `SavedRun` (e.g. `+2`). In
  `base-battle-roulette.buildVictoryOdds`, add `pendingBattleDebuff` to the No-ticket
  count for the **next** battle, then clear it after that battle resolves. Persisted
  so a reload can't shake off the omen.

## A4. Danger meter UI (`main-game/danger-meter/` new component)

- A horizontal bar near the adventure area bound to `dangerMeterService.dangerPercent$`,
  showing the **literal %** with a green→amber→red gradient.
- Animate the bar on every change; **on a drop (after a threat)** show a one-line
  flavor cue (i18n `game.main.danger.relief`, e.g. "You slipped away — the heat's
  off, for now.").
- When `consecutiveThreats >= PITY - 1` and the next is forced safe, show a
  **shielded/greyed** state (i18n `game.main.danger.safe`).
- i18n all strings in the 6 locales. First-run tooltip explaining the system
  (i18n `game.main.danger.help`).

## A5. Persistence wiring (`run-persistence.service.ts`)

Add to `SavedRun`, `isValidSavedRun`, `restoreRun`, `persistRun`:
`dangerPercent`, `consecutiveThreats`, `pendingAdventure`, `pendingBattleDebuff`.
Default all on load (old saves lack them) — same per-field defaulting the run
blob already tolerates. `DangerMeterService` and the debuff read/write through the
same commit-on-mutation path the run already uses.

---

# Part B — Bias-item rework

**Status update (2026-07-18): B1 and B2 turned out to already be shipped** (they
landed via other work before this plan's V2-gating pass), and **B3 is partially
shipped**. See below per-section. **Decision: Part B stays ungated** — unlike
Part A, it is NOT gated behind `isNewExperienceMode`. It's already live for
every player, isn't a difficulty/mechanics change (just clearer bias-item
feedback/QoL), and pulling it back behind the flag would be a regression for
current players. Only Part A (Danger meter / choose-between adventure / new
threats) is gated.

## B1. Stacking (`trainer.service.ts` + `apply-type-bias.ts`) — DONE, different mechanism

Already achieves the same effect the plan wanted, via a different shape than
originally spec'd: `setTowardBias`/`setAwayBias` append a new entry to the
`toward`/`away` arrays on every use (no dedicated `stacks` field), and
`apply-type-bias.ts`'s `countByType` + `softMultiplier` already compound
repeated same-type soft entries by **counting duplicate entries in the array**
rather than incrementing a `stacks` counter on one entry (`TOWARD_SOFT_BASE_MULTIPLIER
= 10` / `AWAY_SOFT_BASE_MULTIPLIER = 0.1`, scaled by count). Functionally "2
Honey = 2× the effect of 1" already holds. **No further work needed for B1** —
do not add a `stacks` field; it would duplicate what counting already does.

## B2. Use bias items inside the obtain wheels — DONE

Already implemented in `roulette-container.component.ts`
(`handleTypeBiasItemUse`/`applyTypeBiasInPlace`, gated only by
`obtainWheelStates.has(currentGameState)` covering catch/trade/fossil/legendary/
cave/fishing/mysterious-egg/area-zero): opens an in-place type-picker, calls
`setTowardBias`/`setAwayBias`, and the wheel redraws live. **No further work
needed for B2.**

## B3. Visual feedback — PARTIALLY done; only the wheel-slice highlight remains

The stack-count indicator (e.g. "×2") next to the Items panel already exists
(`main-game.component.html`). **Still missing:** a highlight/marker/outline on
toward-type wheel slices and a dimmed treatment on away-type slices, so the
bias's effect is legible on the wheel itself before spinning. This is the only
remaining Part B implementation work.
- The existing bias indicator(s) next to the Items panel show the **stack count**
  (e.g. "×2").

---

## Phases (checkpoint after each; `npm run test:local` green each time)

1. **`DangerMeterService` + persistence (A1, A5 partial).** Pure logic + save/restore,
   not yet wired to any component (so no gating branch needed this phase — the
   service just isn't called by anything Classic mode reaches). Unit-test the
   curve, relief, recovery, floor, and hard-pity (drive `rollStep` with a
   seeded/mocked `Math.random`). No UI yet. *Checkpoint: sequences match the spec
   table; persisted fields default correctly for old saves.*
2. [x] **Choose-between flow (A2) + meter UI (A4), gated behind `isNewExperienceMode`.**
   Done: `AdventureDrawService` (new, `services/adventure-draw-service/`) holds
   `PendingAdventureDraw` anti-reroll state; `DangerMeterComponent` (new,
   `main-game/danger-meter/`) shows the %, color gradient, shielded/safe badge,
   relief cue. `MainAdventureRouletteComponent` branches on
   `gameStateService.isNewExperienceMode`: Classic renders the wheel exactly as
   before (unchanged, 8 pre-existing specs pass unmodified); New Experience
   draws 3 distinct weighted candidates from the reward pool as pick-cards.
   Interim note (resolved in phase 3): `rollStep` is called every step so the
   meter/pity always track true history; this phase's threat pool was empty,
   so every step still drew from the reward pool regardless of outcome —
   invisible to the player, self-corrected the moment phase 3 landed real
   threat-pool members.
   *Checkpoint: draws persist and can't be re-rolled on reload (pick-before-reload
   re-shows same 3; pick-after-reload replays the routed event); meter moves
   and reads correctly; Classic mode unaffected.* 666/666 tests green.
3. [x] **New threats (A3) + threat-step.** Done: `threatPool` (4 members —
   `teamRocketAmbush` reusing the existing TR mini-wheel via
   `teamRocketEncounterEvent`; new `itemTheft`, `toll`, `badOmen` handlers in
   `roulette-container.component.ts`) wired into `MainAdventureRouletteComponent`,
   selected instead of the reward pool whenever `rollStep` returns `'threat'`.
   `itemTheft` removes one random item (or shows a "nothing found" modal on an
   empty inventory). `toll` lets the player pick an item to hand over
   (`select-from-item-list`), or — with no items — costs a team Pokémon via a
   new `'toll-pokemon'` GameState (deliberately separate from `'steal-pokemon'`:
   a toll payment must never be recoverable via a Team Rocket defeat the way a
   TR steal is, so it never touches `stolenPokemon`). `badOmen` sets a new
   `BattleDebuffService` (new, `services/battle-debuff-service/`) debuff, read
   by `BaseBattleRouletteComponent.buildVictoryOdds` and added to the next
   battle's No tickets, cleared on that battle's resolution in all four battle
   components (same call site as `battlePrepService.clearPrep()`). Persisted
   via `pendingBattleDebuff` in `SavedRun` (default 0, legacy-safe).
   *Checkpoint: each threat applies its cost; badOmen persists and hits exactly
   the next battle; TR ambush path can whiff; none of this is reachable in
   Classic mode.* 689/689 tests green.
4. **Bias stacking (B1) — already done (2026-07-18 audit), skip.** No code change;
   see "Status update" under Part B above.
5. [x] **Bias visual feedback, remaining piece only (B3's wheel-slice highlight/dim).**
   Done: `WheelItem` gained optional `highlighted?`/`dimmed?` flags;
   `WheelComponent.drawWheel()` draws a gold outline for `highlighted` slices
   and a semi-transparent dark overlay for `dimmed` slices. `applyTypeBias`
   (`apply-type-bias.ts`) tags every returned item against the active
   toward/away type sets (hard and soft both count) in one place, so all 9
   obtain-wheel components that already call it and bind `[items]` to its
   result got the highlight/dim treatment with **zero per-component changes**
   — B2 (in-wheel use) and B3's stack-count indicator were already done.
   **Ungated** — applies in both Classic and New Experience mode, same as the
   rest of Part B. *Checkpoint: toward-type slices show a highlight, away-type
   slices show a dimmed treatment, on every obtain wheel that uses
   `applyTypeBias`.* 694/694 tests green.
6. **Docs.** README feature entries (opponent-agency / steering section); remove the
   two bias backlog items; update this status; move plan → `docs/plans/done/`.

## Tests / validation

- Service unit tests per phase (danger curve, stacking math, threat handlers).
- **Persistence tests are mandatory** for each committed choice: save mid-decision,
  reload, assert the same candidates / used item / omen / meter — the anti-reroll
  invariant is the highest-risk part.
- Manual: run to gym 3–4 and confirm the Danger meter reads ~50% and threats feel
  paced (no death spirals; occasional clusters relieved).

## Explicitly out of scope (later versions)

- Pre-spin "choose your lead" + pre-spin item step → **V3** (with its own commit/persist).
- Abilities + defeat/faint mechanic → **V4** (the defeat mechanic will reuse the
  "threat you can reclaim" shape TR establishes here).
  - **Heads-up for V4:** once a loss can faint a Pokémon, some encounters this plan
    puts in the **reward** pool become real threats — notably the **rival** (and
    **trainer**) battles (today reward-only). At V4 they'll likely need to move to
    the **threat** pool or become TR-style dual-nature entries, and the reward/threat
    pools + Danger-meter tuning here will need revisiting/swapping. Don't design it
    now — just don't treat V2's pool assignments as final once V4 exists.
