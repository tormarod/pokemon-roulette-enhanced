# Plan: PC Corruption (New Experience threat)

Status: **Approved — decisions settled 2026-07-19. Do not start until
`docs/plans/threat-single-draw-rework.md` ships** (corruption is designed as
a normal `threatPool` entry drawn through that new single-draw flow; building
it against the old 3-choice picker would be throwaway work).
Owner: tormarod
Last updated: 2026-07-19

## Why

`pcBreakIn` (steal a random Pokémon from PC storage) shipped as a threat,
then was removed: with empty PC storage it degraded to a costless no-op
message, and every threat needs a real, luck-independent cost. The
replacement: hackers corrupt one of your **team** Pokémon (never PC storage,
so it's never state-dependent) — it becomes unstable and needs to be led
into (and win) a real battle before a deadline, or it takes a permanent
penalty.

## Decisions (settled — do not re-litigate without a new conversation)

1. **It's a normal `threatPool` entry**, not a separate ambient/ Danger-meter-
   linked service. Drawn exactly like `forcedRetreat`/`spooked`/etc. through
   the single-draw flow from the rework plan.
2. **Trigger/availability**: only eligible to be drawn once
   `dangerMeterService.currentDangerPercent` is at or above a threshold
   (recommendation: **30** — a tunable balance number, not a locked design
   decision; adjust freely during implementation/playtesting). Below the
   threshold, this entry is filtered out of the pool entirely for that draw
   (see "Pool eligibility filtering" below) — it never gets weight-diluted
   into the pool only to silently do nothing.
3. **Clearing**: the corrupted Pokémon must **lead and win** a real battle
   (gym/rival/Elite Four/Champion) — a loss does **not** clear it.
4. **Deadline**: **3 real battles** (gym/rival/E4/Champion — not adventure
   rounds) from the moment it's applied. Counting only real battles matches
   difficulty pacing; adventure rounds can pass with no battle at all.
5. **Lapse penalty** (deadline passes without a lead-and-win): **PC storage
   is locked for the rest of the round** — reuses the existing "unavailable"
   modal pattern in `StoragePcComponent.showPCModal()` (currently gated on
   `currentGameState === 'team-rocket-encounter'`), just keyed off a new
   pending-lock flag instead. "Rest of the round" = until
   `gameStateService.currentRoundValue` changes (same round-boundary concept
   used elsewhere) — confirm the exact round-advance signal before wiring
   (see `GameStateService`).
6. **Target exclusion**: only a team Pokémon that is **not** `fainted`,
   `retreatLocked`, or already `corrupted` is eligible. If no team member is
   eligible, this threat is excluded from the pool for that draw (same
   filtering mechanism as the danger-threshold gate, not a drawn-then-no-op).
7. **Visual**: plain badge, same treatment as `fainted`/`retreatLocked` —
   `"Corrupted"` label on the team/PC card, no new CSS/visual system.

## Current system context

- **`DangerMeterService.currentDangerPercent`**
  (`src/app/services/danger-meter-service/danger-meter.service.ts`) — already
  a public getter, no changes needed to read it for the availability check.
- **Badge pattern for per-Pokémon state**: `PokemonItem`
  (`src/app/interfaces/pokemon-item.ts`) already has `fainted?: boolean`,
  `retreatLocked?: boolean` following this exact shape, each rendered as a
  `.fainted-badge` in `storage-pc.component.html`. Add `corrupted?: boolean`
  the same way. **Also needs showing on the *team* view**, not just PC
  storage — check wherever the team roster renders (`trainerTeam` template,
  likely alongside the `ability-badge` shown in both `storage-pc.component.html`'s
  `trainerTeam` loop and PC loop) since a corrupted Pokémon is usually still
  on the active team, not benched.
- **Forcing a lead pick**: `BattlePrepPanelComponent`
  (`src/app/main-game/roulette-container/battle-prep-panel/battle-prep-panel.component.ts`)
  has a `disabledIndex` input (added for `markedTarget`) that *forbids* one
  index from being picked as lead, enforced in `selectLead()` and defaulted
  around in `ngOnChanges()`. Forcing the corrupted Pokémon to lead is the
  inverse: add a `requiredIndex: number | null = null` input; when set,
  `selectLead()` should refuse any index other than `requiredIndex` (or
  simplest: don't let the player change the lead at all while a required
  index is set — pre-select it and disable every other card, mirroring how
  `disabledIndex` already disables one card, just inverted to disable all
  *but* one). Confirm which of these two UX shapes before implementing (both
  are reasonable; "disable all others, pre-select the required one" is
  probably the least surprising — the player still sees why via the card
  styling instead of a click doing nothing unexplained).
- **Win/loss detection for clearing**: each of the 4 battle roulette
  components (`gym-battle-roulette`, `rival-battle-roulette`,
  `elite-four-battle-roulette`, `champion-battle-roulette`) already has the
  win/loss branches used to wire `clearForcedRetreatLock()` and
  `clearMark()` (see `onItemSelected()` in each, e.g.
  `gym-battle-roulette.component.ts` lines ~68-88). Clearing corruption
  needs the **battle-prep-committed lead's identity** (to check "was the
  corrupted Pokémon actually the one that led") plus the **win/loss
  outcome** (only a win clears it) — `BattlePrepService`'s committed prep
  (`getPendingPrepObservable()`/`leadIndex`) already tracks the committed
  lead index at prep-confirm time, same source `disabledIndex`/
  `requiredIndex` would use.
- **PC lockout modal precedent**: `StoragePcComponent.showPCModal()`
  (`src/app/trainer-team/storage-pc/storage-pc.component.ts`, ~line 87)
  already branches on `currentGameState === 'team-rocket-encounter'` to show
  an "unavailable" info modal instead of the real PC modal. Add a second
  condition (a new pending-lock service's flag) using the same branch shape.
- **Persistence pattern**: mirror `MarkedTargetService`
  (`src/app/services/marked-target-service/marked-target.service.ts`) and
  `CatchRiskService` (`src/app/services/catch-risk-service/catch-risk.service.ts`)
  for shape; wire into `RunPersistenceService`
  (`src/app/services/run-persistence-service/run-persistence.service.ts`)
  the same way (`SavedRun` field, `combineLatest` entry, `isValidSavedRun`
  clause) — see how `markedTeamIndex`/`pendingCatchEscapeChance` were added
  there for the exact pattern.

## New: pool eligibility filtering (needed for this threat specifically)

`MainAdventureRouletteComponent.threatPool` is currently drawn from
unconditionally (aside from `weight`). This threat needs **conditional
eligibility** (danger threshold + an eligible team target existing), which
today's `drawDistinct`/`drawWeightedOne` (from the rework plan) don't
support — they draw from the pool as given, with no per-draw filtering hook.

Add a filter step in `initializeDraw()`'s threat branch, before calling
`drawWeightedOne`:
```ts
const eligibleThreatPool = this.threatPool.filter(candidate =>
  candidate.id !== 'pcCorruption' || this.isCorruptionEligible()
);
const drawn = this.drawWeightedOne(eligibleThreatPool);
```
where `isCorruptionEligible()` checks
`dangerMeterService.currentDangerPercent >= CORRUPTION_DANGER_THRESHOLD` AND
at least one team Pokémon is not `fainted`/`retreatLocked`/`corrupted`.
(`MainAdventureRouletteComponent` needs `TrainerService` injected to check
team eligibility — it currently doesn't depend on it; confirm this doesn't
create a circular/unwanted coupling, or move the eligibility check to
`roulette-container.component.ts` and have it own the final routing decision
instead — needs a design call at implementation time, not blocking the rest
of this plan.)

As flagged in the rework plan's "Related consideration": this is also the
right fix for `forcedRetreat`/`markedTarget`'s existing team-size-2 no-op —
consider generalizing this filter to an `isEligible?: (ctx) => boolean`
field on `AdventureCandidate` rather than a corruption-specific special
case, if doing both in the same pass.

## Implementation sketch (flesh out exact file/line detail once the rework plan ships and this is picked up)

1. `PokemonItem`: add `corrupted?: boolean`.
2. New `CorruptionService` (mirror `MarkedTargetService` shape): tracks
   `{ teamIndex: number, battlesRemaining: number } | null`, persisted via
   `RunPersistenceService`.
3. `main-adventure-roulette.component.ts`: add `pcCorruption` to
   `threatPool`, wire its `@Output()`/`actionHandlers` entry, implement pool
   eligibility filtering (see above).
4. `roulette-container.component.ts`: `pcCorruption()` handler — pick an
   eligible team Pokémon, set `pokemon.corrupted = true`, call
   `corruptionService.setCorruption(teamIndex, 3)`, show an info modal
   (flavor text), `doNothing()`.
5. `BattlePrepPanelComponent`: add `requiredIndex` input (see "Current
   system context" above for the UX-shape decision needed).
6. Each of the 4 battle roulette components: pass
   `[requiredIndex]="corruptionService.isPending && trainerTeam[?].corrupted ? index : null"`
   (exact binding TBD) to `<app-battle-prep-panel>`; on **win only**, if the
   committed lead was the corrupted Pokémon, clear `corrupted` + call
   `corruptionService.clearCorruption()`; on any battle resolve (win or
   loss) where the lead wasn't the corrupted one, decrement
   `battlesRemaining` and apply the lapse penalty at 0.
7. `StoragePcComponent.showPCModal()`: add the lapse-lockout branch.
8. `PokedexService`/team-view templates: add the `corrupted` badge
   (mirroring `fainted`/`retreatLocked`).
9. i18n: `actions.pcCorruption`, `threats.pcCorruption.{title,description}`,
   lockout modal text, badge label — across all 6 locales per repo
   convention.
10. `RunPersistenceService` wiring for the new service.
11. Specs throughout, mirroring the Phase 1-5 pattern from
    `docs/plans/done/adventure-threats-rework.md`.

## Open implementation-time calls (small, not full re-decisions)

- `CORRUPTION_DANGER_THRESHOLD` exact value (recommend 30, tune freely).
- Exact deadline-decrement point: does a battle where the corrupted Pokémon
  *isn't* the lead still count against the 3-battle deadline, or only
  battles fought at all (regardless of lead)? Recommendation: **every real
  battle counts**, led by the corrupted mon or not — otherwise the player
  could stall indefinitely by avoiding leading it, with zero cost, which
  defeats "pressured to actually use it."
- `requiredIndex` UX shape (see above).
- Where `isCorruptionEligible()`'s team check lives (component coupling
  question above).

## Checklist

- [ ] Confirm `docs/plans/threat-single-draw-rework.md` has shipped
- [ ] Resolve "Open implementation-time calls" above (can be decided by the
      implementer without going back to the user — they're small/reversible)
- [ ] Implement per "Implementation sketch," expanding each step to concrete
      file/line detail as work proceeds
- [ ] i18n across all 6 locales
- [ ] Specs
- [ ] README update (New Experience Mode threat-list sentence, pool size
      7 → 8)
- [ ] Release notes entry
- [ ] Move to `docs/plans/done/` once shipped
