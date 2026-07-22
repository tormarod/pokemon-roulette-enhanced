# Plan: Buff X-Attack (round-scaled bonus)

**Status:** Done (shipped in v3.10.0).
**Scope:** New Experience Mode only. Classic mode's passive X-Attack is deliberately left unchanged (see Decision 2).
**Out of scope:** Market/drop pricing of X-Attack and Potions — a separate agent owns `economy-config.ts` pricing. Do **not** touch `MARKET_PRICES` in this work.

## Why

In New Experience Mode, committing an X-Attack in the prep panel adds `meanTeamPower()` (the team's *average* power) as flat Yes tickets. That average is a tiny slice of a Yes pool that already holds the team's *total* power, so it moves win chance only ~+3–4 percentage points at every stage — and it never grows to keep pace with the round-threat term (`ceil(round × 1.5)`) that inflates the No pool late-game. For a consumed, purchasable item that felt underwhelming.

The fix: add a round-scaled term so the bonus stays relevant when it matters most (Elite Four / Champion). New bonus = `meanPower + round`. This preserves today's early-game feel (round 0–1 ≈ unchanged) and climbs to roughly +10–12pp by the Champion. Worked numbers (team power P, cumulative `round = leadersDefeatedAmount`):

| Run point | round | old Δwin (mean only) | new Δwin (mean + round) |
|---|---|---|---|
| Gym 3 | 2 | +4.1 | +7.2 |
| Gym 6 | 5 | +3.9 | +7.9 |
| E4 #2 | 9 | +3.2 | +10.6 |
| Champion | 12 | +3.6 | +11.7 |

This keeps X-Attack well below a Potion's retry value (+21–25pp), so it stays "useful, not crazy."

## Current system (what exists today)

- **Bonus is applied via `BattleOddsService.computeOdds()`** (`src/app/services/battle-odds-service/battle-odds.service.ts`). Its input `xAttackBonus?: number` is summed into `effectivePower` → `yesTickets = round(effectivePower) + 1`. This service is the single source of truth for battle-odds arithmetic; both the wheel builder and the prep-panel preview call it with the same inputs so they can't drift (see `docs/plans/done/battle-odds-transparency.md`). **This service is where the new formula belongs.**
- **Two call sites compute the `xAttackBonus` value and must stay in sync:**
  1. **Wheel builder** — `BaseBattleRouletteComponent.calcVictoryOdds()` (`src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts:293`):
     ```ts
     const xAttackBonus = prep?.xAttackUsed ? this.meanTeamPower() : 0;
     ```
     `meanTeamPower()` is a private helper at line ~340, used **only** here.
  2. **Prep-panel live preview** — `BattlePrepPanelComponent.recomputePreview()` (`src/app/main-game/roulette-container/battle-prep-panel/battle-prep-panel.component.ts:62,69`):
     ```ts
     const meanPower = this.team.reduce((sum, p) => sum + p.power, 0) / this.team.length;
     ...
     xAttackBonus: this.xAttackSelected ? meanPower : 0,
     ```
  Both sites already have the round in scope: `this.currentRound` on the base battle component and `@Input() currentRound` on the prep panel.
- **Classic mode** applies X-Attack passively in `BaseBattleRouletteComponent.plusModifiers()` (same file, line ~138): it scans inventory and adds `meanPower` **per X-Attack in the bag, every battle, never consumed**, and feeds the sum in through `computeOdds`'s separate `classicPlusModifiers` input. This path returns 0 in New Experience Mode.

## Decisions (already made — do not re-open)

1. **Formula: `meanPower + round`** (round coefficient 1.0). `round` is `leadersDefeatedAmount`, an integer, cumulative across the whole run (gyms → Elite Four → Champion, reaching ~12 at the Champion), so no `ceil` is needed and the bonus is naturally largest at the hardest fights.
2. **New Experience Mode only. Classic's `plusModifiers()` stays exactly as-is.** Round-scaling a passive that is *never consumed* and *stacks per copy* would multiply the round term by every X-Attack in the bag, every battle — e.g. 3 X-Attacks at the Champion would add `3 × (mean + 12)`, ballooning far past intent and trivializing Classic. The buff targets the consumed, one-shot New-Experience item; Classic keeps its documented legacy quirk untouched.

## Steps

### 1. Add the shared formula to `BattleOddsService`
File: `src/app/services/battle-odds-service/battle-odds.service.ts`

Add a public method (pure, no state) so both call sites derive the value from one place:
```ts
/**
 * The Yes-ticket bonus a committed X-Attack grants in New Experience Mode:
 * the team's mean power (its historical value) plus a flat round-scaled term
 * so the boost keeps pace with the round-threat No tickets late-game. `round`
 * is leadersDefeatedAmount (integer, cumulative across the run). Returns 0 for
 * an empty team. Classic mode does NOT use this — see plusModifiers().
 */
xAttackBonus(team: PokemonItem[], round: number): number {
  if (!team.length) return 0;
  const meanPower = team.reduce((sum, p) => sum + p.power, 0) / team.length;
  return meanPower + round;
}
```
(`PokemonItem` is already imported in this file.)

### 2. Wheel builder uses the shared formula
File: `.../base-battle-roulette.component.ts`

- In `calcVictoryOdds()` (line ~293), replace:
  ```ts
  const xAttackBonus = prep?.xAttackUsed ? this.meanTeamPower() : 0;
  ```
  with:
  ```ts
  const xAttackBonus = prep?.xAttackUsed
    ? this.battleOddsService.xAttackBonus(this.trainerTeam, this.currentRound) : 0;
  ```
  (`this.battleOddsService` is already injected — it's used in `buildVictoryOdds`.)
- Delete the now-unused private `meanTeamPower()` helper (line ~340). Confirm no other reference remains (grep `meanTeamPower` — should hit only its definition before deletion). `plusModifiers()` computes its own mean inline and is **not** affected.

### 3. Prep-panel preview uses the shared formula
File: `.../battle-prep-panel/battle-prep-panel.component.ts`

In `recomputePreview()`, remove the local `meanPower` line and change the `xAttackBonus` field to:
```ts
xAttackBonus: this.xAttackSelected
  ? this.battleOddsService.xAttackBonus(this.team, this.currentRound) : 0,
```
(`battleOddsService` and `this.currentRound` are already available.)

### 4. Tests
- **`battle-odds.service.spec.ts`** — add a unit test for `xAttackBonus()`:
  - empty team → `0`.
  - team of two power-4 mons, round `0` → `4` (mean only; matches old behavior).
  - same team, round `5` → `9` (mean 4 + round 5).
- **Existing battle-roulette specs are safe:** the current "consume the x-attack" tests (gym/rival/elite-four/champion `.component.spec.ts`) all set `currentRound = 0`, so `mean + 0 = mean` and their `yes = 9` assertions still hold. Leave them as-is.
- **Add one round-scaled regression test** (gym spec is fine, mirror the existing "should consume the x-attack…" test): same power-4 lone team + one X-Attack, but `component.currentRound = 3`; expect Yes count `base(1) + power(4) + bonus(mean 4 + round 3 = 7) = 12`.
- **`battle-prep-panel.component.spec.ts`** — if a preview test asserts the X-Attack contribution, add/extend one with `currentRound > 0` to confirm the preview matches the wheel (both now route through `xAttackBonus()`).

### 5. Player-facing release (per CLAUDE.md)
- Bump `version` in `package.json`: `3.8.0` → `3.9.0`.
- Add a newest-first entry to `RELEASE_NOTES` (`src/app/data/release-notes.ts`) for `3.9.0` with one note key, e.g. `whatsNew.v3_9_0.0`, dated appropriately.
- Add the `whatsNew.v3_9_0.0` string **and** a `v3_9_0` version label to **all six** locale files (`src/assets/i18n/{en,de,es,fr,it,pt}.json`) — real English in `en.json`, English placeholder in the others. Suggested `en` copy: *"X Attack is stronger in tougher fights — its power boost now scales with how far you've progressed."*
- Update the `README.md` "New Experience Mode" X-Attack bullet (the "Pre-spin X Attack" line under Battle balancing / New Experience) to note the bonus now scales with round. One sentence; don't rewrite the section.

## Acceptance tests (input → expected)

1. New Experience, lone power-4 team, one X-Attack, **round 0**, no matchup: confirm prep with `xAttackUsed: true` → Yes tickets = `1 + 4 + 4 = 9`. (Unchanged from today.)
2. Same, **round 3** → Yes tickets = `1 + 4 + (4 + 3) = 12`.
3. Same, **round 10** → Yes tickets = `1 + 4 + (4 + 10) = 19`.
4. Prep-panel `oddsPreview.yes.xAttack` for a given team + round equals the Yes-side X-Attack contribution the wheel is built with for the same team + round (no drift).
5. Classic mode, bag with 2 X-Attacks, any round: Yes contribution is unchanged from before this work (`2 × meanPower`, no round term).
6. `npm run test:local` passes; production build (`npm run build`) succeeds.

## Notes for the executor

- Keep the round coefficient as a bare `+ this.currentRound` / `+ round`; don't introduce a tuning constant unless asked (pricing agent owns economy dials, not this term).
- The whole point of routing both call sites through `BattleOddsService.xAttackBonus()` is the no-drift invariant — do not inline the formula in either component.
