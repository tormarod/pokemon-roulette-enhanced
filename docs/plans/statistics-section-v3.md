# Plan: Player Statistics — V3

Status: **All V3 phases (1-4) shipped 2026-07-16: Pokédex normalizer,
unified profile export/import (ProfileBackupService), per-generation
breakdown, and docs (this update + README).**
Owner: tormarod
Last updated: 2026-07-16
Builds on: `docs/plans/statistics-section.md` (V1) and
`docs/plans/statistics-section-v2.md` (V2). Carries the two items V2 §8 deferred.

> Handoff note: the "Persistence landscape" section is ground truth as of this
> date — verify keys/shapes still hold, then implement phase by phase, pausing
> for review after each (see CLAUDE.md workflow notes).

---

## 1. Goal

Two features carried over from V2 §8:

1. **Per-generation breakdown** — view the stats filtered by generation, not just
   global lifetime totals.
2. **Unified profile export / import** — one file that backs up and restores the
   player's whole local profile (stats **+ Pokédex + achievements**), so it can
   move between browsers/devices. Generalizes V2's stats-only JSON export.

Everything stays local; no network, no accounts.

## 2. Prerequisites (V3 is blocked until these V2 pieces land)

- **Achievements store must exist** (V2 Phase 3 / Group B) — the unified export
  can't include achievements until there's an achievements store to include.
- **Stats-only JSON export/import shipped** (V2 Phase 4 / Group E) — V3 §7
  *generalizes* that code rather than inventing a parallel path; don't build the
  unified exporter before the single-store one exists to build on.
- **Run-history log shipped** (V2 Phase 2 / Group C) — the per-generation work
  leans on it heavily (see §5); without it, much more would need migration.

If V3 starts before these are done, re-scope or wait.

## 3. Persistence landscape (ground truth)

Every `localStorage` key in the app today, by category:

**Profile (durable player identity — the export target):**
- `pokemon-roulette-stats` — `StatsService`. Versioned (`PLAYER_STATS_VERSION`),
  has `normalizePlayerStats()` per-field defaulting.
- `pokemon-roulette-pokedex` — `PokedexService`, shape `PokedexData`.
  **Not versioned**; load only sanity-checks `parsed.caught` is a non-array.
- **Correction (verified 2026-07-16, V2 shipped this differently than assumed
  here): there is no separate achievements key.** `unlockedAchievementIds` is a
  field *inside* `PlayerStats` itself (`src/app/interfaces/player-stats.ts`),
  persisted under the existing `pokemon-roulette-stats` key. §5's bundle only
  needs two real stores — `stats` (already carries achievements) and
  `pokedex` — not three.

**Preferences (maybe include — see §8):**
- `pokemon-roulette-settings` — `SettingsService`.
- `pokemon-roulette-theme` (+ legacy `dark-mode`) — `ThemeService`.

**Transient run state (exclude from profile export):**
- `pokemon-roulette-run` — `RunPersistenceService`.
- `pokemon-roulette-pending-spin` — `PendingSpinService`.

## 4. Feature 1 — Per-generation breakdown

Goal: let the stats screen show "All generations" (today's view) plus a
per-generation filter.

**Key insight — this is mostly additive, thanks to V2's run-log.** The naive
approach (re-key every counter by generation) forces a `PLAYER_STATS_VERSION`
bump and a lossy migration (existing global counts can't be split by generation
retroactively). Avoid that by splitting the work:

- **Derive per-gen run/win/loss/streak/record stats from the V2 run-history
  log** — each run summary already stores `generationId`, so per-gen runs,
  victories, defeats, win-rate, fastest/longest can be computed *retroactively*
  from the log with **no schema change**.
- **Add per-gen counters only for the counter-based stats** the log can't
  reconstruct (species-owned, types, nemesis) — as **new nested fields** (e.g.
  `speciesOwnedByGen: Record<genId, Record<pokemonId, number>>`) that default to
  `{}`. These are additive → covered by `normalizePlayerStats`, **still no
  version bump**. They populate going forward; historical per-gen splits for
  these simply start empty (acceptable — globals stay intact as "All").
- **Selectors** gain a `generationId | 'all'` argument; `'all'` returns today's
  behavior. UI adds a generation filter control on the stats screen.

Net: no migration required after all — a real improvement over the V2 §8
assumption. (Only if we later want *retroactive* per-gen species/type/nemesis
would a migration be unavoidable, and it'd be lossy — recommend not.)

## 5. Feature 2 — Unified profile export / import

Replace V2's stats-only JSON with a **namespaced profile bundle**. Two stores
only — achievements ride inside `stats` already (see §3 correction):

```jsonc
{
  "kind": "pokemon-roulette-profile",
  "bundleVersion": 1,
  "exportedAt": "<ISO timestamp>",
  "stores": {
    "stats":   { "version": <n>, "data": { /* PlayerStats blob, incl. unlockedAchievementIds */ } },
    "pokedex": { "version": <n>, "data": { /* PokedexData blob */ } }
  }
}
```

Design:
- **Each store keeps its own version inside the bundle**, so a bundle stays
  partially restorable and forward-compatible. On import, hand each store's
  `data` to that store's **existing normalize/default-on-load path** (add a tiny
  versioned normalizer to `PokedexService`, which lacks one today) — never trust
  the blob raw.
- **Bundle-level `kind`/`bundleVersion` guard**: reject a wrong `kind`; refuse a
  `bundleVersion` newer than the app understands with a clear message rather than
  a silent partial import.
- **Import mode** (decision §8): whole-profile **replace** (simplest, matches
  "restore a backup") vs per-store **merge**. Recommend replace-per-store for v1
  of this feature.
- **Exclude transient run state** (`…-run`, `…-pending-spin`) — a backup should
  restore identity/progress, not resurrect a half-finished run.
- **Preferences** (settings/theme): include or not is a §8 decision.
- Provide export (download `.json`) and import (file picker) on the stats screen,
  superseding V2's stats-only buttons. Keep the V2 stats-only import working for
  old files, or migrate old files into the bundle reader.

## 6. Architecture notes

- **Generalize, don't fork.** The unified exporter should subsume V2's
  stats-only export path, not sit beside it.
- **Give `PokedexService` a versioned normalizer** mirroring
  `normalizePlayerStats` — needed for safe import and good hygiene regardless.
- **Per-gen stays additive** (§4) — keep any lossy re-key out of scope.
- **A small `ProfileBackupService`** could own bundle assemble/parse/apply,
  delegating to each store's load/save, rather than spreading localStorage
  knowledge across the UI.

## 7. Implementation phases (checkpoint after each)

**Phase 1 — Pokédex normalizer. SHIPPED 2026-07-16.** Added `version`,
`createDefaultPokedexData()`, `normalizePokedexData()` in a new
`src/app/interfaces/pokedex-data.ts` (mirroring `player-stats.ts`'s pattern);
`PokedexService` now imports from there (re-exporting the types for existing
consumers) and its load path (`getPokedexFromStorage`) uses
`normalizePokedexData()` instead of the old ad-hoc `parsed.caught &&
!Array.isArray(...)` check — malformed individual entries are now dropped
rather than discarding the whole Pokédex on any shape mismatch.
`updatePokedex()` now takes just the `caught` record and stamps the current
version internally, so every write site (`markSeen`/`markWon`/`markMega`) stays
untouched. No user-visible change. *Checkpoint: existing dex still loads; new
tests cover malformed-entry dropping, missing-field defaulting, forced version
on load, and a save/load round-trip; 491/491 tests pass, `ng build` succeeds.*

**Phase 2 — Unified export/import. SHIPPED 2026-07-16.** New
`ProfileBackupService` (`src/app/services/profile-backup-service/`) owns
`exportProfile()`/`importProfile()` around a two-store bundle
(`{ kind: "pokemon-roulette-profile", bundleVersion: 1, exportedAt,
stores: { stats, pokedex } }`) — reuses `StatsService.exportStats()`/
`importStats()` internally rather than duplicating normalize/persist logic
("generalize, don't fork"); added `PokedexService.replacePokedex()` as the
Pokédex-side equivalent (normalizes + re-runs the existing shiny-family
fixup). Import rejects a wrong `kind`, a `bundleVersion` newer than
understood, or invalid JSON — old V2 stats-only export files are **not**
accepted (plan §8.4), each rejection distinguishable in the UI
(`success` / `invalid` / `unsupported-version`). Stats screen's export/import
buttons now call `ProfileBackupService` instead of `StatsService` directly;
i18n updated across all 6 locales (relabeled Stats→Profile, added
`stats.import.unsupportedVersion`). `StatsService.exportStats()`/
`importStats()` kept as-is (still unit-tested directly, now also reused
internally). *Checkpoint: round-trip export→import tested (stats + Pokédex
both restored), wrong-kind/invalid-JSON/newer-bundleVersion/malformed-store-data
all covered; 499/499 tests pass, `ng build` succeeds. UI not eyeballed in a
live browser this session — no browser-automation tool was available.*

**Phase 3 — Per-generation breakdown. SHIPPED 2026-07-16.** Three additive
`PlayerStats` fields, all `Record<generationId, Record<innerKey, number>>`,
defaulting to `{}` (no version bump): `speciesOwnedCountsByGen`,
`typeCountsByGen`, `nemesisDefeatsByGen` — normalized via a new
`nestedRecordOr()` helper mirroring `recordOr()`. `StatsService.recordRunEnd`/
`recordBattleLoss` fold into these alongside their existing lifetime
counterparts, keyed by `this.currentRunGenerationId` (already tracked since
V2). New `computeGenerationStatsSummary(stats, generationId)` in
`stats-selectors.ts` (returns `PlayerGenerationStatsSummary`) derives
runs/wins/losses/win-rate/best-streak/fastest-victory/longest-run from
`runHistory` filtered by `generationId` — **no schema change needed for
those**, since `RunLogEntry` already carries `generationId` (V2 Phase 2) — and
reads species/type/nemesis top entries from the new `*ByGen` counters, which
are empty for any generation played entirely before this phase shipped
(expected, not a bug — the plan's "additive, no migration" decision, §8.3).
`StatsService.getGenerationSummaryObservable(generationId)` added alongside
the existing (unchanged) `getSummaryObservable()`. Stats screen gained a
generation filter `<select>` in a new "Per-Generation" section between Run
History and Achievements — selecting a generation reveals its stats inline;
"All Generations" (default) leaves the rest of the screen exactly as before.
i18n added across all 6 locales. *Checkpoint: new selector/service tests cover
per-gen filtering, chronological best-streak-within-generation, fastest/
longest within a generation, reading from `*ByGen` not the lifetime counters,
and the empty-breakdown-for-pre-V3-generations case; 512/512 tests pass, `ng
build` succeeds. UI not eyeballed in a live browser this session — no
browser-automation tool was available; worth checking the dropdown's contrast
across all three themes.*
**Post-checkpoint iteration (same day):** first pass had an "All Generations"
dropdown option that fell through to a blank panel (`generationSummary$`
emitted `null`, template rendered nothing). Rather than patch that in, the
user asked to drop "All Generations" entirely — the lifetime totals are
already shown in the sections above, so the per-gen panel doesn't need to
duplicate them. Simplified: `selectedGenerationId$` is a plain
`BehaviorSubject<number>` defaulting to the first generation in
`GenerationService`'s list, the dropdown only lists real generations, and
`generationSummary$` always resolves through
`StatsService.getGenerationSummaryObservable()` — no branching, no null case.
512/512 tests pass, `ng build` succeeds.

**Phase 4 — Docs. SHIPPED 2026-07-16.** README "New features" entry expanded
to mention the per-generation breakdown and the unified profile export/import
(replacing the old "export/import your stats as JSON" wording). This plan's
status header and phase sections updated as each phase shipped (including two
post-checkpoint iterations on Phase 3 — see its entry above). V1/V2 plans were
already marked shipped from prior sessions; no further changes needed there.

## 8. Decisions (settled 2026-07-16)

1. **Preferences in the backup?** **Progress-only** (stats incl. achievements +
   Pokédex). Settings/theme excluded, stay device-local.
2. **Import mode** — **replace-per-store**. Import overwrites stats and Pokédex
   wholesale; no merge logic.
3. **Per-gen retroactivity** — **additive only, no migration**. New per-gen
   counters (species/types/nemesis) start empty and populate going forward. No
   `PLAYER_STATS_VERSION` bump. Lifetime "All" totals stay untouched/authoritative.
4. **Old stats-only files** — **bundle format only, not accepted**. Import
   rejects a bare V2 stats-only JSON with a clear "unsupported format" error
   rather than silently partial-restoring. (Deliberately dropped the draft's own
   "accept both" recommendation — simpler code path, acceptable for a low-stakes
   local feature.)
5. **Per-gen UI** — filter dropdown on the existing stats screen (not a separate
   tab/view), consistent with how the screen already organizes sections.

Net: implement §4 and §5 as designed, phases per §7, with the two corrections
above (achievements has no separate key; bundle-only import, no V2 back-compat).
