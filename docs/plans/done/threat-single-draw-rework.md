# Plan: Threats become a single random draw (no more 3-choice picker)

Status: **Implemented and playtested.**
Owner: tormarod
Last updated: 2026-07-19
Depends on: nothing. **Blocks** `docs/plans/pc-corruption-mechanic.md`
(corruption is designed as a normal threat-pool entry drawn through this new
flow — don't start that plan until this one ships).

## Why

Today, `MainAdventureRouletteComponent.initializeDraw()` handles reward and
threat steps identically: draw 3 distinct weighted candidates from whichever
pool (`rewardPool` or `threatPool`), show them as clickable cards, and let
the player pick one (`onCandidatePicked`). For rewards this is the intended
"choose-between" design. For **threats**, this is a bug in the game design,
not just a balance nit: the player gets to see all 3 threats that could
happen and **picks the least-bad one** — a "threat" that the player controls
isn't a threat. (This is also almost certainly why `pcBreakIn`'s empty-PC
no-op felt so costless — the player would just never pick it when an empty
PC was known, though the real fix there was removing it, already done.)

Fix: **reward steps are unchanged** (still 3-candidate choose-between).
**Threat steps become a single weighted-random draw**, auto-resolved with no
player choice — presented as an event that happens to you, not a menu.

## Current system (read this before touching code)

- `MainAdventureRouletteComponent`
  (`src/app/main-game/roulette-container/roulettes/main-adventure-roulette/main-adventure-roulette.component.ts`):
  - `initializeDraw()` (~line 229): rolls `dangerMeterService.rollStep(round)`
    → `'reward' | 'threat'`, draws 3 distinct via `drawDistinct(pool, 3)`
    (~line 268, weighted sample without replacement), sets `this.candidates`,
    commits the draw via `AdventureDrawService.commitDraw(stepType, ids)`.
  - `onCandidatePicked(index)` (~line 219): commits the pick
    (`adventureDrawService.commitPick`), then `routeCandidate(id)`.
  - `routeCandidate(id)` (~line 259): clears the draw, looks up `id` in
    `actionHandlers` (a `Record<string, () => void>` mapping every
    reward/threat id to its output `EventEmitter`), calls it.
  - Reload-safety in `initializeDraw()`: if a draw is already pending
    (survived a reload), and `picked !== null`, it **replays**
    `routeCandidate` directly — this path already exists and needs no
    changes; a single-item threat draw that's auto-picked the instant it's
    drawn gets this reload safety for free.
  - `main-adventure-roulette.component.html`: the `@if (isNewExperienceMode)`
    branch renders the danger meter, a `"choose one"` label, and an
    `adventure-card-row` of buttons (one per `candidates` entry, `(click)`
    → `onCandidatePicked(i)`), then the "Go Straight" button.
- `AdventureDrawService`
  (`src/app/services/adventure-draw-service/adventure-draw.service.ts`):
  `PendingAdventureDraw { stepType, candidates: string[], picked: number | null }`.
  No interface changes needed — a threat draw just uses a 1-element
  `candidates` array with `picked` set to `0` immediately.
- **Most threat handlers already present themselves as a self-contained
  "event"** — `roulette-container.component.ts`'s `itemTheft()`, `badOmen()`,
  `spooked()`, `pcBreakIn()` (now removed), `markedTarget()`, and
  `pokeballMalfunction()` all set `infoModalTitle`/`infoModalMessage` and
  call `this.modalQueueService.open(this.infoModal, ...)` **after** applying
  their effect, then call `this.doNothing()`. `forcedRetreat()` instead
  transitions into the `select-from-pokemon-list` picker state (the "which
  Pokémon retreats" choice **is** the effect resolving, not a threat-choice
  menu — unaffected by this rework). `teamRocketAmbush` routes to the
  existing Team Rocket mini-wheel screen (also unaffected — its own
  resolution flow, not this picker). **So the actual UI change needed here
  is narrow**: stop showing 3 threat cards and stop waiting for a click;
  everything downstream of "which threat got picked" already behaves like a
  single event.

## Implementation

1. **`main-adventure-roulette.component.ts`**:
   - Add a new private helper `drawWeightedOne(pool: AdventureCandidate[]): AdventureCandidate`
     — same weighted-random logic as `drawDistinct(pool, 1)` already produces
     (in fact, simplest correct implementation: `return this.drawDistinct(pool, 1)[0];`
     — no need to duplicate the sampling logic, `drawDistinct` already handles
     `count === 1` correctly since its loop is bounded by
     `count && remaining.length > 0`).
   - Add a `stepType: AdventureStepType | null = null;` field (import
     `AdventureStepType` from `danger-meter.service.ts`, already imported
     indirectly via `DangerMeterService`) — needed so the template can gate
     the card-row UI to reward steps only.
   - In `initializeDraw()` (~line 229), after computing `stepType`:
     ```ts
     const stepType = this.dangerMeterService.rollStep(this.gameStateService.currentRoundValue);
     this.stepType = stepType;

     if (stepType === 'threat') {
       const drawn = this.drawWeightedOne(this.threatPool);
       this.adventureDrawService.commitDraw('threat', [drawn.id]);
       this.adventureDrawService.commitPick(0);
       this.routeCandidate(drawn.id);
       return;
     }

     const pool = this.isGeneration9 ? [...this.rewardPool, this.areaZeroCandidate] : this.rewardPool;
     const drawnCandidates = this.drawDistinct(pool, 3);
     this.candidates = drawnCandidates;
     this.adventureDrawService.commitDraw('reward', drawnCandidates.map(c => c.id));
     ```
     (This replaces the existing single `const pool = stepType === 'threat' ? ... : ...` /
     `drawDistinct(pool, 3)` / `this.candidates = drawn` / `commitDraw` block.)
   - In the **reload branch** at the top of `initializeDraw()` (the
     `if (existing) { ... }` block, ~line 230): it already replays via
     `routeCandidate` when `existing.picked !== null`, which now covers both
     "reward picked, reload before routed" (existing case) and "threat
     auto-picked, reload before routed" (new case) — no changes needed there.
     But also set `this.stepType = existing.stepType;` right after entering
     the `if (existing)` block (before the `picked !== null` check), so a
     reload before a *reward* pick is made still renders the card row
     correctly (the existing `this.candidates = this.resolveCandidates(...)`
     line stays for the reward-not-yet-picked case).
2. **`main-adventure-roulette.component.html`**: gate the `"choose one"`
   label and `adventure-card-row` div with `@if (stepType === 'reward')`
   instead of the current unconditional rendering inside
   `@if (isNewExperienceMode)`. Structure becomes:
   ```html
   @if (isNewExperienceMode) {
       <app-danger-meter ... />
       @if (stepType === 'reward') {
           <p class="choose-one-label">...</p>
           <div class="adventure-card-row"> ... </div>
       }
       <div class="roulette-action-row"> <!-- Go Straight button, unchanged --> </div>
   }
   ```
   For a threat step, this means the screen briefly shows just the danger
   meter and the Go Straight button before the threat handler's own modal
   opens (synchronous call chain from `ngOnInit`'s state subscription →
   `initializeDraw()` → `routeCandidate()` → handler → `modalQueueService.open()`,
   so there should be no visible flash — verify this visually per the
   acceptance test below, and if there *is* a visible flash, that's an
   acceptable follow-up polish item, not a blocker).
3. **`onGoStraight()`**: no changes needed — it already just clears whatever
   draw is pending, which now includes an already-auto-picked-but-not-yet-
   routed threat draw only in the reload-race-condition window, which is
   already a pre-existing edge case handled the same way rewards are.
4. **Threat handlers that no-op via `doNothing()` with no modal**
   (`forcedRetreat()`'s and `markedTarget()`'s `team.length < 2` branches):
   unaffected by this rework — they were already silent no-ops when picked
   from the 3-card menu (nothing visible happened besides the state
   advancing), and remain silent no-ops when auto-drawn. Not a regression.
5. **Specs** (`main-adventure-roulette.component.spec.ts`):
   - Update the existing "should draw from the threat pool when rollStep
     returns 'threat'" test: it currently asserts
     `component.candidates.length === 3` for a threat step — change to
     assert the draw auto-routes instead: spy on the relevant output event
     (or on `actionHandlers` indirectly via one of the `*Event` emitters,
     matching the existing "should route ... threat picks" test's pattern)
     and assert it fires **without** calling `onCandidatePicked` — i.e. purely
     from `createFixture()`/`initializeDraw()` running.
   - Update/remove the existing "should route .../teamRocketAmbush threat
     picks to their matching output events" test's reliance on
     `onCandidatePicked(0)` — threats no longer go through that method at
     all; rewrite it to assert `initializeDraw()`'s auto-draw routes
     correctly for each threat id (mock `Math.random` or drive it
     statistically the same way `drawDistinct`'s existing weighted-sample
     tests already do, if any — check `adventure-draw.service.spec.ts` and
     this component's spec for the existing pattern before inventing a new
     one).
   - Add a test asserting `stepType` is set to `'reward'` after a reward
     draw and `'threat'` after a threat draw (drives the template gating).
   - Add a reload-mid-threat test: `adventureDrawService.restoreDraw({ stepType: 'threat', candidates: ['itemTheft'], picked: 0 })`
     before `createFixture()`, assert the corresponding event fires on init
     (mirrors the existing reward reload-replay test if one exists).
6. **`roulette-container.component.spec.ts`**: no changes expected — every
   threat handler method (`itemTheft()`, `badOmen()`, etc.) is still called
   directly in those specs, unaffected by *how* the candidate id reached
   `routeCandidate`.

## Related consideration (not a blocker, flagging for awareness)

Under the old 3-choice system, a threat that happens to have no real effect
right now (`forcedRetreat` or `markedTarget` with team size < 2, both of
which just call `doNothing()` silently) was rarely a problem — the player
usually had 2 other drawn candidates to pick instead. Under a single random
draw, drawing one of these **is** the whole event, and a silent no-op reads
as "nothing happened" with no feedback. This was always possible before
(if all 3 draws happened to be no-ops) but is now far more likely per-draw.
Not fixing this here — `docs/plans/pc-corruption-mechanic.md` introduces the
concept of filtering `threatPool` to eligible entries *before* the weighted
draw (rather than drawing-then-no-op), which would also be the right fix for
`forcedRetreat`/`markedTarget`'s existing team-size-2 guard. Worth doing in
the same pass as corruption, or as a quick follow-up — not required for this
rework to ship.

## Bug found + fixed during manual playtest

Live-testing via a scripted Playwright run (forcing a threat draw at the
first `adventure-continues` entry) surfaced a real bug in the initial
implementation, not just a cosmetic flash: routing a threat **synchronously**
from inside `ngOnInit`'s `gameStateService.currentState` subscription is
reentrant when the threat handler itself triggers another state transition
(`teamRocketAmbush`, `forcedRetreat`, and in fact every threat handler, since
even the modal-based ones end in `doNothing()` → `finishCurrentState()`).
Angular is still mid-render for the component issuing that change, and the
parent's `@switch` was left permanently stuck on the old `adventure-continues`
screen — `gameStateService`'s internal state had already moved on (confirmed
via `ng.getComponent` inspection), but the DOM never updated, even after a
1.5s settle and a forced `resize` event. Fixed by deferring both
`routeCandidate` calls in `initializeDraw()` (fresh threat draw, and the
reload-replay branch) to a microtask via `queueMicrotask()` — the same pattern
already used in `character-select.component.ts` for an analogous reentrancy
("Defer event emission to next microtask to ensure parent is ready to
listen"). Re-ran the same live scenario after the fix: the threat (drawn as
`teamRocketAmbush`) now transitions cleanly through to its mini-wheel screen
with no stuck view and no card flash. Specs updated to `await
Promise.resolve()` after triggering the draw, to flush the now-async routing
before asserting on it.

## Acceptance tests

- New Experience run, reward step: unchanged — 3 cards shown, click routes,
  matches today's behavior exactly.
- New Experience run, threat step: **no cards shown**; the corresponding
  threat's effect applies and its modal (or, for `forcedRetreat`, the
  Pokémon picker; for `teamRocketAmbush`, the mini-wheel) appears
  immediately, with no way for the player to have influenced which threat it
  was.
- Reload mid-threat-resolution (after auto-pick, before the handler's modal
  is dismissed): resolves to the same threat on reload, doesn't re-roll.
- `npm run test:local` stays green.

## Checklist

- [x] Implement `drawWeightedOne` + `initializeDraw()` branch + `stepType`
      field in `main-adventure-roulette.component.ts`
- [x] Update `main-adventure-roulette.component.html` template gating
- [x] Update/add specs per "Specs" section above
- [x] Manual playtest: confirm no visible card flash on a threat step
- [x] Update README's adventure-step description if it implies threats are
      pickable (check the "choose-between" paragraph in the New Experience
      Mode section)
