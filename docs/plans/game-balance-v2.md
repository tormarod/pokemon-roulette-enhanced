# Plan: Game balance V2 — Steering

Status: **Ready to implement (Sonnet).** Large — 6 phases, checkpoint after each.
Owner: tormarod
Last updated: 2026-07-16
Rationale + roadmap: `docs/research/game-balance-research.md`.

## Philosophy / constraints (unchanged)

- Luck + type knowledge; **steering, not escaping** (no reroll/escape tools here).
- **Every reload-sensitive choice must commit-and-persist the instant it's made**,
  mirroring `PendingSpinService` (a reload must never let a player re-roll a drawn
  choice, un-use an item, or dodge a threat). This is called out per phase.
- Canon untouchable (leader types, real-Pokémon relations).
- Deferred: pre-spin battle mechanics → **V3**; abilities + defeat mechanic → **V4**.

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

## B1. Stacking (`trainer.service.ts` + `apply-type-bias.ts`)

- `TypeBiasEntry` += `stacks: number` (default 1).
- `setTowardBias(entry)` / `setAwayBias(entry)`: if the existing same-direction
  entry has the **same type and mode `soft`**, **increment `stacks`**; otherwise
  replace (new type, or `hard`) with `stacks: 1`. `hard` never stacks (a guarantee
  is absolute).
- `apply-type-bias.ts` soft multipliers scale linearly with stacks (so "2 Honey =
  2× the effect of 1"):
  - toward soft: `weight * (TOWARD_SOFT_WEIGHT_MULTIPLIER * toward.stacks)` (×4, ×8, ×12…)
  - away soft: `weight * (AWAY_SOFT_WEIGHT_MULTIPLIER / away.stacks)` (×0.25, ×0.125…)
- `stacks` rides in `pendingTypeBiases`, already persisted in `SavedRun` — extend
  the shape; default missing `stacks` to 1 on load.

## B2. Use bias items inside the obtain wheels (backlog item)

- On every obtain-wheel screen (catch, trade, fossil, legendary, cave, starter,
  fishing, mysterious-egg, area-zero — all already use `applyTypeBias`), add a small
  **in-wheel item affordance** to use a bias item without leaving the screen.
- On use: call `setTowardBias`/`setAwayBias` (which now stacks), then **rebuild the
  wheel's weighted list** via `applyTypeBias(...)` and **redraw** the wheel live.
- Persistence: using the item commits immediately (it mutates inventory + pending
  bias, both already persisted) — a reload can't un-use it.

## B3. Visual feedback

- After `applyTypeBias`, the biased-**toward** type's slices are already larger
  (weight ×). Add a **highlight** (marker/label/outline) on toward-type slices and a
  dimmed treatment on away-type slices so the effect is legible before spinning.
- The existing bias indicator(s) next to the Items panel show the **stack count**
  (e.g. "×2").

---

## Phases (checkpoint after each; `npm run test:local` green each time)

1. **`DangerMeterService` + persistence (A1, A5 partial).** Pure logic + save/restore.
   Unit-test the curve, relief, recovery, floor, and hard-pity (drive `rollStep` with
   a seeded/mocked `Math.random`). No UI yet. *Checkpoint: sequences match the spec
   table.*
2. **Choose-between flow (A2) + meter UI (A4).** Reward-step first (existing outcomes
   as cards), then the meter. *Checkpoint: draws persist and can't be re-rolled on
   reload; meter moves and reads correctly.*
3. **New threats (A3) + threat-step.** itemTheft, toll, badOmen handlers + TR routing
   into both pools. *Checkpoint: each threat applies its cost; badOmen persists and
   hits exactly the next battle; TR reward path can whiff.*
4. **Bias stacking (B1).** *Checkpoint: 2 Honey → ×8 toward weight; away → ÷; hard
   doesn't stack; stacks persist.*
5. **Bias in-wheel use + visual (B2, B3).** *Checkpoint: using an item mid-wheel
   re-renders live and persists; stack count + highlight show.*
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
