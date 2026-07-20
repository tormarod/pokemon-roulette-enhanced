# Plan: [BUG] Empty/stuck wheel states not recovering on reload (rival battle + Go Straight)

Status: **Cause A (rival) confirmed and fixed. Cause B (Go Straight) investigated
extensively, not reproduced — see findings below.**
Owner: tormarod
Last updated: 2026-07-17
(Supersedes `bug-rival-wheel-disappears.md`.)

## Findings (2026-07-17)

**Cause A — rival battle: root cause was different from the original hypothesis,
and is fixed.** Reproduced deterministically via Playwright by seeding a restored
run at `battle-rival` for generation 6 + male trainer gender: the wheel and
matchup strip render nothing, with a repeating `TypeError: Cannot read properties
of undefined (reading 'id')` thrown from `MatchupStripComponent.getTypeIconUrl`.
It was **not** the generation-subscription race the plan originally guessed (that
race doesn't actually occur — `GenerationService`/`GameStateService` are both
`BehaviorSubject`s that emit synchronously on subscribe, and the base
component's `ngOnInit` subscribes to generation before game state). The real bug:
`rival-battle-roulette.component.ts`'s `getCurrentRival()` gen-6 branch (Calem/
Serena) indexed `types` by the same gender-derived `selectedIndex` used for
`sprite`/`quotes`/`name` — but unlike those, `types` is a **single shared
one-element array** (`['normal']`), not one entry per gender variant. For the
male index (`1`), `rivalTypes[1]` was out of bounds → `types: [undefined]` →
crash on render, every time (fully deterministic, not a race, which is why
reload never recovered it). **Fixed**: use `rivalTypes` directly, unindexed.
Regression tests added in `rival-battle-roulette.component.spec.ts` for both
genders. Verified via Playwright before/after (crash → clean render, 0 errors).

**Cause B — "Go Straight": could not reproduce.** Tested extensively:
- All 3 Go Straight buttons (`start-adventure`, `adventure-continues`,
  `elite-four-preparation`), both via direct state-restore reload and via
  actually clicking the button after a fresh page load.
- Every gym-trio/duo special-case round across gen 5/7/8 (the closest analogue
  to the rival bug's gender-indexing pattern) — `getCurrentLeader()`'s async
  rebuild indexes `types`/`sprite`/`quotes` by `randomIndex = random() *
  leaderNames.length`, and unlike the rival case, `types` for every trio/duo
  entry has the **same length** as `sprite`/`quotes`/the translated name's
  `/`-split count (verified against `gym-leaders-by-generation.ts` and
  `en.json` for all 4 special-case entries) — so this path is safe by
  construction, no analogous out-of-bounds risk.
- `adventure-continues`/`elite-four-battle`/`champion-battle` direct reloads at
  various rounds.

None of these produced a blank page or console error. **Found instead**: a
separate, minor, dev-mode-only `NG0100: ExpressionChangedAfterItHasBeenChecked`
warning on the gym-trio async path (`fromLeaderChange.emit()` mutating a
two-way-bound `@Input` after the current CD cycle already ran) — logged to
`docs/todo/backlog.md`, not fixed here since it doesn't affect production
behavior or cause a blank screen.

**Recommendation**: close cause B as "investigated, not reproduced" rather than
guess at a fix for a symptom that couldn't be confirmed in current code. If it
recurs, capture the exact round/generation/prior actions (items used, which
wheel was spun beforehand) — that's what made cause A tractable.
**Step 3 (universal self-heal)** below is still a reasonable defensive
investment in general, but wasn't implemented — it's a standalone architectural
addition, not a fix for a confirmed bug, and out of scope for this pass.

## The shared symptom

Two triggers land the player on an **empty page/wheel**, and **reloading doesn't
recover** it:
- **A. Rival battle** — the rival wheel sometimes doesn't render.
- **B. "Go Straight"** — the skip button lands on an empty page/wheel.

Both share a class: a game state is entered/restored whose component renders
nothing, and because `state` + `stateStack` are **persisted** (`RunPersistenceService`),
reload restores the same dead state → hard-stuck. The worst part isn't the empty
render, it's the **no recovery**.

## Mechanisms (from the code)

**Go Straight** (`start-adventure` / `main-adventure` / `elite-four-prep` templates):
the button emits `doNothingEvent` → `roulette-container.doNothing()` →
`GameStateService.finishCurrentState()`, which **pops the stack to the next state**
(no push). So Go Straight advances into whatever's underneath — a `gym-battle`,
`elite-four-battle`, etc. If that state's component can't build its wheel (missing
opponent/generation data, or an inconsistent stack after the pop), you get a blank
that then persists. Which state it lands on per trigger needs repro (adventure →
next `gym-battle`; elite-four-prep → `elite-four-battle`).

**Rival battle** (`rival-battle-roulette`): `onGameStateChange('battle-rival')` →
`getCurrentRival()` (uses `this.generation.id`) → then an **async**
`translate.get(currentRival.name).subscribe(...)` rebuild. On restore, if
`getCurrentRival` runs before the `generation` subscription has emitted,
`rivalByGeneration[undefined]` → `currentRival` undefined → the async
`translate.get(undefined.name)` throws → wheel setup aborts → blank, deterministic
on every reload.

## Step 1 — Reproduce + instrument (both)

- Repro via the dev panel: jump to `battle-rival`, and separately drive an adventure
  wheel and hit **Go Straight**; reload after each. Try multiple generations (the
  rival async path only runs for some).
- When the page is empty, log:
  ```ts
  console.debug('stuck?', { state: currentState, stack: getStateStack(),
    gen: this.generation?.id, rival: this.currentRival, leader: this.currentLeader, oddsLen: this.victoryOdds?.length });
  ```
  and check the console for a thrown error (reading `.name`/`.types` of undefined
  pinpoints the rival case; a state with no `@case` match pinpoints Go Straight).

## Step 2 — Per-cause fixes (apply what the logs confirm)

- **Rival / any battle state, data-not-built-on-restore:** ensure the opponent is
  derived only once `generation` is available — guard `if (!this.generation) return;`
  and re-run setup when the generation subscription emits; build `victoryOdds`
  (needs only `types`, present on the base rival/leader object) *before* the async
  translate, so the wheel always renders even mid-translation; wrap the
  `translate.get(...)` rebuild so a missing field can't throw and abort setup.
- **Go Straight landing on a bad state:** confirm which state `finishCurrentState()`
  reaches and why it renders empty (missing data vs no `@case`). Fix the same way
  (rebuild data on entry/restore), or if the pop leaves the stack inconsistent, fix
  the transition so Go Straight lands on a fully-set-up state.

## Step 3 — Universal self-heal (do regardless of Step 2)

The core failure is being **stuck**. Add a safety net in the container / state
machine: if the current state renders no wheel (no matching `@case`, or a battle
state with no derivable opponent after setup), **recover** instead of persisting a
dead screen — e.g. re-derive the opponent, or advance past it (a rival is a no-loss
encounter; an unrenderable adventure state can skip forward). This converts a hard
lock into, at worst, a skipped step, for *any* future variant of this bug — not
just these two triggers.

## Tests / validation
- After the fix, reload at the rival battle and after Go Straight, across a few
  generations — a wheel (or a graceful advance) every time, never a stuck blank.
- If feasible, a spec that restores a `battle-rival` / post-Go-Straight `SavedRun`
  with `generation` set and asserts the target component builds a non-empty
  `victoryOdds` (or self-heals).
