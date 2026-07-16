# Plan: Player Statistics Section

Status: **Done — all 5 phases shipped (store & schema, instrumentation,
derived selectors, UI, reset control + docs). Luck/wheel stats deferred past
v1 (see §8.1) — the only work intentionally left out of this pass.**
Owner: tormarod
Last updated: 2026-07-16

> Handoff note for the execution session: everything you need is in this file.
> The "Current system" section is ground truth as of this date — verify the
> line references still hold, then implement phase by phase, pausing for review
> after each phase (see CLAUDE.md workflow notes).

---

## 1. Goal

Add a persistent, player-facing **statistics section** that tracks activity
across runs — runs played, victories, and a set of useful *and* fun derived
stats (top-owned Pokémon, nemesis enemies, streaks, luck, etc.) — surfaced on
its own screen. All data stays local (localStorage); nothing is sent anywhere.

## 2. Current system (ground truth)

- **No cross-run history exists today.** `RunPersistenceService`
  (`src/app/services/run-persistence-service/run-persistence.service.ts`)
  persists only the *current* run under the key `pokemon-roulette-run`, and
  **clears it** when the game reaches a terminal state (`game-over` or
  `game-finish`, see `TERMINAL_STATES` and the `combineLatest` subscription).
  So there is nothing that accumulates across runs — a stats store must be new
  and independent.
- **`AnalyticsService`** (`services/analytics-service/`) is only a Google
  Analytics `gtag` wrapper — not player-facing, not a data source for this.
- **Run lifecycle signals** (`services/game-state-service/game-state.ts`):
  `game-start` begins a run; `game-finish` = beat the Champion (victory);
  `game-over` = defeat. These are the accumulation triggers.
- **Per-opponent win/loss is observable at clean hook points** in
  `roulette-container.component.ts`: separate handlers for gym (`~:506`), rival,
  elite-four (`~:789`), and champion (`~:804`) battle results, each with the
  current opponent (`currentLeader` / `currentRival` / `currentElite` /
  `currentChampion`) in scope — so "which enemy beat you" is capturable at the
  moment of the `setNextState('game-over')` transition.
- **Existing per-Pokémon tracking**: `PokedexService` already records `markWon`
  / seen / captured state (a lifetime dex). Stats should *complement* it, not
  duplicate it — link to it where useful rather than re-counting captures.
- **Data available per run**: `trainerTeam`, `storedPokemon`, `trainerItems`,
  `trainerBadges`, `generationId`, `currentRound`, `gender`, `pendingTypeBiases`
  (see `SavedRun`).

## 3. Design principles

- **Separate, additive store.** New key (e.g. `pokemon-roulette-stats`), never
  touched by `RunPersistenceService.clearRun()`. Stats accumulate for the life
  of the browser profile until the player explicitly resets them.
- **Store raw counters + small histories; derive on display.** Keep the
  persisted blob small and cheap to write on every relevant event. Compute
  "top 3", rates, and streaks at render time from the counters — don't persist
  derived values that can drift.
- **Forward-compatible schema.** Version the blob and default every missing
  field on load (same resilience pattern `SavedRun`/`isValidSavedRun` uses), so
  adding a stat later never invalidates an existing player's history.
- **Cosmetic, not gameplay.** Stats never affect odds or run state, so they
  don't need the anti-reload-cheese rigor `PendingSpinService` has. Record at
  natural transitions; a player reloading to fudge a stat only fools themselves.
- **Record at the terminal transition, before the run is cleared.** The stats
  hook must run independently of (and not rely on) the run blob still existing.

## 4. Proposed stat set (review & trim this)

Grouped by theme. v1 need not ship all of these — mark which to cut in §8.

### Lifetime totals
- Runs played; victories (Champion beaten); win rate.
- Defeats; current win/loss streak; best win streak.
- Total gym leaders / Elite Four / Champions defeated (all-time).
- Total Pokémon caught; shinies caught; legendaries/paradox caught
  (some may be read from `PokedexService` instead of re-counted).
- Total wheel spins (needs a hook in the spin flow — see §8).

### Records / bests
- Fastest victory (fewest rounds — `currentRound` at `game-finish`).
- Longest run (max round reached, win or loss).
- Favorite generation (most-played `generationId`).

### Pokémon-centric (the "fun" tier)
- **Top 3 most-owned Pokémon across runs** — species that most often appear in
  a run (see ownership definition in §8).
- Most-chosen starter.
- **Signature Pokémon** — species present in the most *victorious* runs.
- Team type distribution — which types the player gravitates toward.

### Enemy / battle ("nemesis" tier)
- **Most defeats to a specific enemy** — the leader/rival/Elite-Four/Champion
  who has ended the most runs.
- Win rate per battle type (gym vs rival vs elite vs champion) — reveals "the
  wall".
- How often runs end at the Champion specifically (heartbreak counter).

### Luck / flavor (roulette-appropriate)
- Overall Yes-landing rate vs the expected rate — a "luck index" (needs the
  spin hook).
- Potions/retries used as clutch saves; Team Rocket steals suffered.

## 5. Proposed architecture

- **`StatsService`** (`services/stats-service/`): owns the persisted `PlayerStats`
  blob (load/save/reset), exposes `record*` methods for each event, and exposes
  derived selectors (or a single `getSummary()`) for the UI. Injectable
  singleton like the other services.
- **`PlayerStats` interface** (`interfaces/player-stats.ts`): versioned; raw
  counters + capped histories (e.g. per-species run counts as a
  `Record<pokemonId, number>`, per-opponent defeat counts keyed by a stable
  opponent id).
- **Instrumentation** wired from `roulette-container.component.ts` at the
  existing transitions (run start; each battle result with its opponent;
  `game-finish`; `game-over`) and from team/catch events for ownership.
- **`StatsComponent`** (`app/stats/`): a new screen, following the existing
  `credits` / `coffee` page pattern, reachable from the same menu those use.
- **i18n**: new keys in `assets/i18n/en.json` (+ other locales where practical).

## 6. Implementation phases (checkpoint after each)

**Phase 1 — Store & schema.** `PlayerStats` interface + `StatsService` with
load/save/reset against a new localStorage key, versioned with defaulting on
load. Unit tests for persistence, defaulting of missing fields, and reset. No
instrumentation yet. *Checkpoint: confirm it never collides with the run key.*

**Phase 2 — Instrumentation.** Add `record*` calls at the run lifecycle and
battle-result hook points, and at team/ownership events. Keep each hook a
one-liner into `StatsService`; no logic in the components. Unit-test the service
methods with simulated event sequences. *Checkpoint: verify counters move
correctly across a scripted run.*

**Phase 3 — Derived selectors.** Top-N owned, signature Pokémon, nemesis,
streaks, rates, favorite generation — computed from counters, with tests for
tie-breaking and empty-history cases. *Checkpoint: review numbers against a
hand-built fixture.*

**Phase 4 — UI.** `StatsComponent` + route + menu entry + i18n, matching the
credits/coffee visual pattern. Empty-state ("play a run to see stats") handled.
*Checkpoint: eyeball it in the app.*

**Phase 5 — Reset & docs.** "Reset statistics" control with confirm; README
feature-list entry; update this plan's status. *Checkpoint: confirm reset
clears only stats, not the active run or Pokédex.*

## 7. Testing / validation

- Service unit tests per phase (persistence, each recorder, each selector),
  run via `npm run test:local`.
- A scripted end-to-end fixture: simulate two runs (one win, one loss to a
  named leader) and assert the summary (runs=2, victories=1, nemesis=that
  leader, streak reset, top-owned reflects both teams).
- Manual check that a completed run updates stats and that
  `RunPersistenceService` clearing the run does **not** wipe stats.

## 8. Decisions (settled 2026-07-16)

1. **v1 scope** — ship **Lifetime totals + records**, **Pokémon fun stats**, and
   **Nemesis / battle stats**. **Luck/wheel stats are deferred past v1** (they
   need a spin-outcome hook); do NOT add that plumbing now. Structure the schema
   so the luck group can be added later without migration.
2. **"Owned" definition** for top-3 — count a species **once per run if it was
   ever on the team or in storage** during that run (not just the end-of-run
   snapshot). Implementation: track a per-run set of species that appeared, and
   fold it into lifetime counts when the run ends.
3. **Breakdown** — **global for v1** (one combined lifetime view across all
   generations). Keep per-generation breakdown possible later, but don't build
   the filter now.
4. **Wheel/luck stats** — deferred (see #1).
5. **Entry point** — Stats screen lives **alongside the Credits/Coffee pages**,
   reachable from the same menu those use. Follow their component/route pattern.
6. **Reset** — **yes**, provide a "reset statistics" control gated by a confirm
   modal. It must clear only the stats key, never the active run or the Pokédex.
