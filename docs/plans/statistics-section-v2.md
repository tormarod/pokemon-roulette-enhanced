# Plan: Player Statistics — V2

Status: **Phase 1 (Luck/wheel, Group A) and Phase 2 (Run-history log, Group C +
playtime timestamps) shipped 2026-07-16. Phase 3 (Achievements) next.**
Per-generation breakdown (Group F) deferred to a future V3.
Owner: tormarod
Last updated: 2026-07-16
Builds on: `docs/plans/statistics-section.md` (V1, shipped in commit `e1bda41`).

> Handoff note: the "V1 as shipped" section is ground truth as of this date —
> verify the line references still hold, then implement phase by phase, pausing
> for review after each (see CLAUDE.md workflow notes).

---

## 1. Goal

Extend the shipped statistics section with the feature groups deferred from V1
plus depth that the V1 infrastructure now makes cheap — chiefly the **luck/wheel
stats**, **achievements/milestones**, a **run-history log** (enabling trends and
"recent form"), and a **shareable stats card**. Everything stays local; no
network, no accounts.

## 2. V1 as shipped (ground truth)

- **Schema** `src/app/interfaces/player-stats.ts`: `PlayerStats` (version 1) is
  raw counters only. Critically, `normalizePlayerStats()` merges a parsed blob
  onto defaults **per field**, so *adding new fields needs no migration and no
  version bump* — only a structural change (e.g. re-keying counters by
  generation) would. Bump `PLAYER_STATS_VERSION` only then.
- **Store** `src/app/services/stats-service/stats.service.ts`: `StatsService`
  (own key `pokemon-roulette-stats`, never cleared by the run blob). Exposes
  `record*` methods and a `BehaviorSubject`. Already tracks a per-run
  `currentRunSpeciesSeen` set (reset each run) — the pattern to copy for any new
  per-run accumulator (e.g. per-run loss count for "perfect runs").
- **Selectors** `stats-service/stats-selectors.ts`: `computeStatsSummary()`
  derives everything for the UI (rates, top-N, nemesis, streaks) — nothing
  derived is persisted.
- **UI**: `src/app/stats/stats.component.*` (screen) + `main-game/stats-button/`
  (entry), reachable alongside Credits/Coffee.
- **Existing record hooks** in `roulette-container.component.ts`:
  `recordRunStart`, `recordCapture`, `recordShiny`, `recordBattleWin`,
  `recordBattleLoss(type, opponentKey?)`, `recordRunEnd(victory, rounds)`.
- **Shipped stat groups**: lifetime totals + records, Pokémon "fun" tier,
  nemesis/battle. **Deferred from V1**: luck/wheel (needs a spin-outcome hook),
  and per-generation breakdown (V1 is global).
- **Available but unused dependency**: `dom-to-image-more` is already in
  `package.json` — usable to render a shareable stats card to PNG with no new
  dependency.

## 3. Proposed V2 feature groups

### A. Luck / wheel stats (the explicit V1 deferral)
The wheel already knows its odds at spin time (`victoryOdds` yes/no counts in
each battle roulette's `onItemSelected`), so a spin hook can record both the
outcome and the *expected* win chance:
- New fields: `totalSpins`, `yesLandings`, `sumExpectedYesProbability` (sum of
  per-spin yes-share). **Luck index** = actual yes-rate − expected yes-rate,
  derived in the selector — "are you lucky or just well-built?".
- `potionsUsed` (clutch saves) — hook `BaseBattleRouletteComponent.usePotion`.
- `teamRocketStealsSuffered` — hook the steal flow.
- New record methods: `recordSpin(landedYes, expectedProb)`,
  `recordPotionUsed()`, `recordStealSuffered()`.

### B. Achievements / milestones
Highest engagement-per-effort — most unlock conditions are **predicates over
the existing `PlayerStats`**, so little new tracking. A declarative
`ACHIEVEMENTS` list (id, i18n name/desc, `isUnlocked(stats)` predicate); persist
an unlocked-id set; fire a toast on new unlock. Examples: first victory; 10/50
wins; 5- and 10-win streak; first shiny; beat a champion in every generation
(*needs a new per-gen champion set*); a "perfect run" (win with zero battle
losses — *needs a per-run loss counter*); catch a legendary.

### C. Run-history log (foundational)
A **capped** array (last ~30 runs) of small summaries: result, generationId,
roundsReached, startedAt/endedAt, starterId. Enables **recent form** (last-10
W/L), **win-rate-over-time**, and a per-run detail list — and is the substrate
many per-generation stats can be derived from without re-keying every counter.

### D. Data-gap fills (small, mostly needed by A–C anyway)
`legendariesCaught` (hook catch-legendary/paradox); `evolutionsPerformed`;
run timestamps (`firstPlayedAt`, `lastPlayedAt`, total playtime from run-log
durations); `perfectRuns` count. Each is an additive field.

### E. Presentation / sharing
- **Shareable stats card** → PNG via the existing `dom-to-image-more`. High fun,
  no new dependency.
- Lightweight **charts** (type distribution bar, win-rate trend from the run
  log) — prefer hand-rolled SVG/CSS over a charting dependency for a static SPA.
- **Export / import stats JSON** (local backup/portability) and **per-section
  reset** (V1 has reset-all only).

### F. Per-generation breakdown (heaviest — likely defer to V3)
True per-gen filtering of every stat means re-keying counters by generation (a
structural schema change → `PLAYER_STATS_VERSION` bump + real migration). A
*lighter* interim: derive a few per-gen views from the run-history log (C)
without touching the counter schema.

## 4. Architecture notes

- **Additive-first.** A, B, C, D, E add fields/records only → covered by
  `normalizePlayerStats` per-field defaulting, **no version bump**. Only F needs
  a bump + a `migratePlayerStats(fromVersion)` step; keep F out of the additive
  phases.
- **Keep the raw-counter / derive-in-selector split.** New summary values
  (luck index, recent form, achievement progress) go in `computeStatsSummary`,
  not the persisted blob.
- **Per-run accumulators in memory**, mirroring `currentRunSpeciesSeen` (e.g.
  per-run loss count for perfect-run detection), reset in `recordRunStart` /
  `recordRunEnd`. Cosmetic → no reload-proofing needed (plan §3).
- **Run-log is capped** (drop oldest past N) so the blob stays small.

## 5. Implementation phases (checkpoint after each)

**Phase 1 — Luck/wheel (Group A). SHIPPED 2026-07-16.** New fields + `recordSpin`/
`recordPotionUsed`/`recordStealSuffered`, wired at the spin/potion/steal hooks;
luck-index selector; UI tiles. Tests for the rate math and empty-history.
`recordSpin` lives on `BaseBattleRouletteComponent` (shared helper reading
`victoryOdds` before it mutates) and is called from each subclass's
`onItemSelected`; `recordPotionUsed` is a single call inside the shared
`usePotion`, so no subclass wiring was needed there. i18n added to all 6
locales. *Checkpoint: unit tests (445/445) and `ng build` pass; UI not
verified in a live browser this session — no browser-automation tool was
available, so eyeball the Luck & Wheel section on the stats screen after a
real run before considering this fully done.*

**Phase 2 — Run-history log (Group C) + timestamps (part of D). SHIPPED
2026-07-16.** `RunLogEntry` + `runHistory` (capped at `RUN_HISTORY_CAP` = 30,
oldest dropped) plus `firstPlayedAt`/`lastPlayedAt` added to `PlayerStats`.
`StatsService` captures the in-progress run's start time/generation/starter in
memory-only fields at `recordRunStart` (mirroring `currentRunSpeciesSeen`) and
folds them into a `RunLogEntry` at `recordRunEnd`; a protected `now()` seam
allows deterministic clock mocking in tests. Selectors added: `recentForm`
(last 10, most-recent-first), `recentFormWinRate`, `winRateTrend` (cumulative,
chronological — substrate for a Phase 4 chart), `totalPlaytimeMs`, and
`runHistory` (most-recent-first for the UI list). Stats screen got a new "Run
History" section (recent-form badges + a scrollable run list) with i18n across
all 6 locales. *Checkpoint: unit tests cover capping (31st run drops the
oldest), chronological ordering, and the no-preceding-`recordRunStart` edge
case; 455/455 tests pass, `ng build` succeeds. UI not verified in a live
browser this session — no browser-automation tool was available.*

**Phase 3 — Achievements (Group B) + remaining data-gaps (D).** Declarative
list + unlocked-set persistence + unlock detection on stats change + toast;
add `legendariesCaught` / `evolutionsPerformed` / `perfectRuns` hooks the
achievements reference. *Checkpoint: review predicates against fixtures.*

**Phase 4 — Presentation (Group E).** Share-to-PNG card, hand-rolled charts,
export/import JSON, per-section reset. *Checkpoint: eyeball card + charts in the
app.*

**Phase 5 — Docs.** README feature-list entry; update both plan statuses.
(Group F / per-gen deferred to a separate V3 plan unless pulled in via §7.)

## 6. Testing / validation

- Service + selector unit tests per phase, via `npm run test:local`.
- Luck math: a fixture of spins with known expected-probabilities → assert the
  derived luck index.
- Achievements: fixtures crossing each unlock threshold, including the
  per-run-dependent ones (perfect run, champion-per-gen).
- Run-log: assert capping (N+1 runs keeps newest N) and recent-form ordering.
- Manual: complete a run and confirm luck tiles, a new run-log entry, and any
  triggered achievement toast; confirm reset/import/export behave.

## 7. Decisions (settled 2026-07-16)

1. **V2 scope** — ship **Group A (Luck/wheel)**, **Group B (Achievements)**, and
   **Group C (Run-history log)**, plus the **Group D** data-gap fills those
   require. **Group F (per-generation breakdown) is deferred to a future V3** —
   do NOT do the counter re-key / migration in V2; keep V2 additive (no
   `PLAYER_STATS_VERSION` bump).
2. **Achievements surface** — a **dedicated achievements section** on the stats
   screen, **with an unlock toast** when one is earned mid-game.
3. **Run-log** — retain the **last ~30 runs** and show a **browsable per-run
   history list** (in addition to the derived trends/recent-form).
4. **Sharing** — **yes**, include the **PNG stats-card** export (via the already
   present `dom-to-image-more`).
5. **Export/import JSON** — **yes**, include local stats backup/portability.
6. **Playtime** — **yes**, track first/last-played timestamps and per-run
   duration (enables playtime totals and trend-over-time).

Net: Phases 1–4 all proceed as written (§5); Phase 5 docs. Group F splits off
into a separate V3 plan when wanted.

## 8. Deferred to V3 (future — not part of V2)

Captured here so the intent survives; a dedicated V3 plan should pick these up.

1. **Per-generation breakdown** (Group F above) — filter every stat by
   generation. Needs a counter re-key + `PLAYER_STATS_VERSION` bump and a real
   `migratePlayerStats()` step, which is exactly why it's out of the additive V2.
2. **Unified export / import** — V2 ships **stats-only** JSON backup (§7.5). V3
   should broaden this into a **single combined backup/restore** covering the
   **Pokédex** (`PokedexService` lifetime dex), **achievements** (the V2 Group B
   unlocked-set), and **stats** together — one file the player can export and
   re-import to move their whole profile between browsers/devices. Design notes
   for whoever picks this up:
   - Each store owns its own localStorage key today (stats
     `pokemon-roulette-stats`, plus the Pokédex and achievements keys). A
     combined format should wrap each store's blob under a namespaced key with
     its own version, so partial/forward-compatible restores stay possible.
     Reuse each store's existing normalize/default-on-load path on import.
   - Consider whether import is merge vs replace per store, and guard against
     importing a newer schema than the running app understands.
