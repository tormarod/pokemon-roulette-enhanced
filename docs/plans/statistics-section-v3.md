# Plan: Player Statistics — V3

Status: **DRAFT — early. Blocked on V2 completion (see §2). Awaiting scope
decisions (§8).**
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
- *achievements key* — created by V2 Group B (unlocked-id set). TBD name; expect
  it to follow the `pokemon-roulette-*` convention.

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

Replace V2's stats-only JSON with a **namespaced profile bundle**:

```jsonc
{
  "kind": "pokemon-roulette-profile",
  "bundleVersion": 1,
  "exportedAt": "<ISO timestamp>",
  "stores": {
    "stats":        { "version": <n>, "data": { /* PlayerStats blob */ } },
    "pokedex":      { "version": <n>, "data": { /* PokedexData blob */ } },
    "achievements": { "version": <n>, "data": { /* unlocked set   */ } }
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

**Phase 1 — Pokédex normalizer.** Add versioning + `normalizePokedexData()` to
`PokedexService` (safe default-on-load), with tests. Prereq for safe import; no
user-visible change. *Checkpoint: existing dex still loads.*

**Phase 2 — Unified export/import.** `ProfileBackupService` + bundle
format; wire export/import UI, superseding V2's stats-only buttons; bundle-guard
+ per-store normalize on import. Tests for round-trip, partial bundle, wrong
`kind`, and newer-`bundleVersion` rejection. *Checkpoint: export on one profile,
import on a cleared one, verify stats+dex+achievements restored.*

**Phase 3 — Per-generation breakdown.** Run-log-derived per-gen stats +
additive per-gen counters for species/types/nemesis + `generationId | 'all'`
selector arg + a generation filter on the stats screen. *Checkpoint: 'all'
matches today's numbers; a per-gen view reconciles against the run-log.*

**Phase 4 — Docs.** README entry; update all three plan statuses.

## 8. Open decisions (settle before implementation)

1. **Preferences in the backup?** Include `settings`/`theme` in the profile
   bundle, or profile-progress stores only (stats/pokedex/achievements)?
   (Recommend: progress-only; prefs are device-local.)
2. **Import mode** — whole-profile replace, or per-store merge? (Recommend:
   replace-per-store for v1.)
3. **Per-gen retroactivity** — accept that per-gen species/type/nemesis start
   empty and fill going forward (additive, no migration), or pay for a lossy
   migration to re-key existing counters? (Recommend: additive, no migration.)
4. **Old stats-only files** — keep importing V2's stats-only JSON, or only
   accept the new bundle? (Recommend: accept both.)
5. **Per-gen UI** — a filter dropdown on the existing screen, or a separate
   per-generation view/tab?
