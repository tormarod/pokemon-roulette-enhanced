# Plan: PC Corruption (ambient Danger-meter mechanic)

Status: **Draft — needs decisions before this is executable.** Not started.
Owner: tormarod
Last updated: 2026-07-19

## Why

`docs/plans/done/adventure-threats-rework.md` originally added a `pcBreakIn`
threat (steal a random Pokémon from PC storage) to the New Experience
choose-between adventure's threat pool. It shipped, then was **removed**
(2026-07-19): with empty PC storage it degraded to a costless no-op message,
and a threat-pool entry needs a real, luck-independent cost every time it's
drawn — a "sometimes there's just no downside" threat isn't acceptable.

While discussing a fix, the idea changed shape entirely: instead of another
threat-wheel entry, tie a new mechanic directly to the **Danger meter**
(`DangerMeterService`) — an ambient, escalating risk that exists alongside
the choose-between adventure rather than as one of its 3 candidate picks.
Concept: hackers corrupt one of your existing team Pokémon. It becomes
unstable — you're pressured to actually battle with it before some deadline,
or it degrades permanently. This has real teeth regardless of PC contents,
since it never touches PC storage at all.

**This document is deliberately not a finished, executable plan.** The
mechanic's core rules (how it clears, what the deadline unit is, what the
lapse penalty is) are still open — see "Decisions needed" below. Don't start
implementation until those are resolved and this file is updated with the
chosen answers (and this Status line changed to "Approved").

## Current system context (for whoever picks this up)

- **`DangerMeterService`**
  (`src/app/services/danger-meter-service/danger-meter.service.ts`) already
  runs every adventure step via `rollStep(round)`, which decides
  reward-vs-threat and adjusts `dangerPercent`/`consecutiveThreats`. This is
  the natural hook point for an ambient "does corruption trigger this step"
  check — it's called exactly once per adventure step, already has access to
  the current danger level, and is New-Experience-only (Classic mode's
  adventure step never calls it).
- **Badge pattern for per-Pokémon state**: `PokemonItem` already carries
  optional per-run flags — `fainted`, `retreatLocked`, `ability` — each
  rendered as a badge in `storage-pc.component.html` and (for `ability`) also
  in the team view. A `corrupted?: boolean` (or richer) field on `PokemonItem`
  following this exact pattern is the obvious way to mark the afflicted
  Pokémon. See `src/app/interfaces/pokemon-item.ts`.
- **Forcing/barring a lead pick**: `BattlePrepPanelComponent`
  (`src/app/main-game/roulette-container/battle-prep-panel/`) already has a
  `disabledIndex` input (added for the `markedTarget` threat) that *forbids*
  picking a given team index as lead. Forcing a pick (the corrupted mon
  *must* lead) is the inverse of that same mechanism — likely a new
  `requiredIndex` input, or repurposing `disabledIndex` to disable every
  *other* index. `selectLead()` and the `ngOnChanges` default-lead logic
  would both need updating for whichever approach is chosen.
- **Permanent per-run debuff precedent**: `badOmen` (see `roulette-container.
  component.ts`, `battleDebuffService.setDebuff()`) is the closest existing
  "lasting cost" pattern, but it's a *global* battle-odds debuff, not
  per-Pokémon and not permanent (it clears after one battle). A permanent
  *per-Pokémon* power reduction has no existing precedent — closest analog is
  `PokemonItem.power` being read-only elsewhere (type-matchup math keys off
  it directly), so mutating it needs care around where else `power` is read
  (Pokédex display, matchup delta calc, wheel weighting).
- **Persistence**: any new pending/timed state needs wiring into
  `RunPersistenceService` the same way `MarkedTargetService`,
  `CatchRiskService`, etc. were — see those two services
  (`src/app/services/marked-target-service/`,
  `src/app/services/catch-risk-service/`) as the shape to mirror for a new
  service, and `run-persistence.service.ts`'s `SavedRun` interface /
  `combineLatest` wiring / `isValidSavedRun` for the persistence pattern.

## Decisions needed (ask the user — do not decide these unilaterally)

1. **Trigger.** A flat per-round chance? A chance that scales with
   `dangerPercent` (so it gets more likely as danger climbs, same shape as
   `rollStep`'s threat roll)? A guaranteed trigger at some `dangerPercent`
   threshold? Can it trigger while a corruption is already pending (stacking
   allowed / blocked)?
2. **Clearing.** The user was explicit they're unsure here — needs a real
   answer before this is buildable:
   - Must the corrupted Pokémon **lead and win** a real battle (gym/rival/E4/
     champion) before the deadline? Just **lead** (win or lose)? Just **stay
     on the team** (not benched/traded) for N rounds?
   - Is clearing even possible, or is corruption always terminal (skip the
     deadline/forced-use framing entirely and just apply the penalty
     immediately, with the "corrupted" state being purely cosmetic/flavor
     until then)?
3. **Deadline unit and length**, if there is one — real battles (3?) or
   adventure rounds (5?). Real battles matches difficulty pacing better;
   rounds reuses the existing `currentRoundValue` counter already read
   elsewhere.
4. **Lapse penalty**, if uncleared — options discussed so far, roughly
   ascending invasiveness:
   - Permanent power debuff on that one Pokémon (self-contained, bounded).
   - PC locked for the rest of the round (temporary, reuses an
     unavailable-modal pattern already in `StoragePcComponent.showPCModal`
     for the `team-rocket-encounter` state).
   - Permanent team-slot loss (6 → 5) — **rejected as most invasive**: every
     team-capacity check in the codebase (`addToTeam`, trade, evolution,
     catch overflow) hardcodes 6 today; this would need a new `maxTeamSize`
     concept threaded through all of them. Only revisit if the simpler
     options are judged too weak.
5. **Can corruption target a Pokémon that's fainted/retreatLocked/already
   corrupted?** Needs an exclusion rule so it doesn't stack nonsensically
   with the Phase 1 (`forcedRetreat`) or game-balance-v4 (`fainted`)
   mechanics.
6. **Visual/flavor**: badge text, whether the corrupted Pokémon's sprite gets
   any visual treatment (the "glitched" framing suggests something more than
   a plain badge, but that's a nice-to-have, not a blocker).

## Suggested shape (recommendation, not yet approved)

Smallest-surface-area version, to react to rather than a blank slate:

- Trigger: small per-round chance scaling with `dangerPercent` (e.g.
  `dangerPercent * 0.15%` per adventure step), checked inside
  `DangerMeterService.rollStep()` right alongside the existing threat/reward
  roll — no interaction with the threat-pool draw itself. Only one Pokémon
  can be corrupted at a time (skip the roll if one's already pending).
- Target: one random team Pokémon that isn't already `fainted`,
  `retreatLocked`, or `corrupted`; no-op (skip silently, no wasted trigger)
  if no eligible Pokémon exists.
- Clear condition: must **lead a real battle** (win or lose — losing doesn't
  compound the punishment) within the next 3 real battles.
- Lapse penalty: permanent `-1` power (floor 1) on that Pokémon, corrupted
  flag clears either way (on clear via battle lead, or on lapse via penalty)
  so it never lingers indefinitely.
- New `CorruptionService` (mirrors `MarkedTargetService`/`CatchRiskService`
  shape) tracking `{ pokemonRef-or-index, battlesRemaining }`, wired into
  `RunPersistenceService` the same way.

This recommendation is a starting point for the "Decisions needed" answers,
not a final design — update this section (and the Status line) once the user
has actually decided, then flesh out concrete phases/files/line-numbers
before implementation, per this repo's plan-writing convention.
