# Plan: Battle-odds transparency (win-chance % + threat breakdown)

Status: **Done — all 4 phases shipped.**
Owner: tormarod
Last updated: 2026-07-20

**Post-completion refinement (2026-07-20):** the `roundThreat` breakdown row
now displays `odds.no.base + odds.no.roundThreat` (not `roundThreat` alone),
and always renders (not gated on `> 0`) — the base No ticket was previously
invisible in the breakdown, so the row's number didn't sum to the wheel's
actual No count. See `MatchupStripComponent`/`BattlePrepPanelComponent`
templates and their specs.

## Why

The battle wheel is honest — `getRandomWeightedIndex()` picks uniformly over the
exact weight-1 slice array that is drawn, so on-screen green/red share = real win
probability (audited 2026-07-20; 200k-spin Monte Carlo drift 0.04pp). But the
player can't *see* the true win chance, and the matchup strip explains only the
**type** portion of the odds. It stays silent about the No tickets from
round-threat, bad-omen, and abilities — which dominate late game (at the Champion,
`ceil(12×1.5)+3 = 21` red slices exist that the strip never mentions). Result: the
strip shows a proud "+12 advantage" on a battle that's actually ~60/40, and the
game feels rigged when it isn't.

Abilities are a sharp case of this: verified 2026-07-20 that an equipped ability
(e.g. Torrent's -2 No tickets) computes and applies correctly in every scenario
tested — assigned before the battle starts, reassigned mid-battle to an already-
active team member, wheel redraw included — but the effect is invisible anywhere
in the current UI (`matchupAdvantageDelta`/`matchupDisadvantageDelta`, the only
numbers the strip shows, are pure type-matchup and never include `abilityYesBonus`/
`abilityNoBonus`; no battle screen or the prep panel mentions abilities at all).
Indistinguishable, from the player's seat, from the ability silently doing nothing.

Fix: show a **win-chance % headline** (read from the real odds, drift-proof) plus a
**breakdown of every Yes and No contribution**, on both the pre-spin prep panel
(where lead/item decisions are made) and the spin screen (the matchup strip).

## Locked design decisions (from the owner, 2026-07-20)

- **Form:** both a win-chance % headline **and** a contribution breakdown.
- **Placement:** both the pre-spin `battle-prep-panel` **and** the spin-screen
  `matchup-strip`.
- **Drift-proofing (author's call, aligned with the codebase's existing
  "same single computation, no drift" invariant in `TypeMatchupService`):** the
  win % and the wheel must be computed from the *identical* numbers. Achieve this
  by extracting the odds arithmetic into a new `BattleOddsService.computeOdds()`
  that both `buildVictoryOdds()` and the prep panel call. The prep panel's preview
  therefore always equals the wheel that will be built on confirm.

## Current system (read before touching code)

- **`BaseBattleRouletteComponent`**
  (`src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts`):
  `buildVictoryOdds(opponentTypes, textPrefix, baseNoCount, currentRound, leadIndex?, xAttackBonus?)`
  (line ~114) computes, inline:
  - `{ yesPower, noBonus, advantageDelta, disadvantageDelta } = typeMatchupService.calcTeamMatchupTotals(team, types)`
  - lead deltas via `typeMatchupService.getMemberSignedDelta(team[leadIndex], types)` → `leadAdvantageDelta` / `leadDisadvantageDelta`
  - abilities (New Experience only) via `abilityService.applyTeamAbilities(team, types)` → `abilityYesBonus` / `abilityNoBonus` / `extraRetry` (the retry seeds `this.retries`)
  - `effectivePower = yesPower + leadAdvantageDelta + (xAttackBonus ?? 0) + plusModifiers() + abilityYesBonus`
  - `yesTickets = Math.round(effectivePower) + 1`
  - `roundThreat = Math.ceil(currentRound * ROUND_THREAT_MULT)` (`ROUND_THREAT_MULT = 1.5`, line 38)
  - `badOmenBonus = battleDebuffService.currentDebuff`
  - `rawNoCount = baseNoCount + roundThreat + noBonus + leadDisadvantageDelta + badOmenBonus + abilityNoBonus`
  - `noCount = Math.max(baseNoCount, rawNoCount)`
  - builds `yesTickets` green + `noCount` crimson `WheelItem`s, `interleaveOdds(...)`.
  It also sets the display fields `matchupSuperEffectiveTypes/ResistTypes/DisadvantageTypes`
  (via `typeMatchupService.getMatchupTypes`), `matchupAdvantageDelta = advantageDelta + leadAdvantageDelta`,
  `matchupDisadvantageDelta = disadvantageDelta + leadDisadvantageDelta`.
- **`plusModifiers()`** (line ~93): Classic-only passive x-attack; returns 0 in New
  Experience. Keep calling it inside `buildVictoryOdds` (not the new service) so the
  service stays free of component/inventory state.
- **`MatchupStripComponent`** (`src/app/main-game/matchup-strip/matchup-strip.component.ts`):
  dumb `OnPush` component. Inputs: `opponentTypes`, `superEffectiveTypes`,
  `resistTypes`, `weakTypes`, `advantageDelta`, `disadvantageDelta`. Rendered in each
  battle component's `roulette-header` when `opponentTypes?.length`.
- **`BattlePrepPanelComponent`** (`src/app/main-game/roulette-container/battle-prep-panel/`):
  `Eager` CD. Inputs: `team`, `opponentTypes`, `items`, `forcedIndex`. State:
  `selectedLeadIndex`, `xAttackSelected`. Shows per-member `getMemberDelta()` only —
  **no aggregate**. Injects only `TypeMatchupService`. Rendered by gym/elite/champion/
  rival templates during `prepPhase` (New Experience only).
- **Each battle component's `calcVictoryOdds()`** builds `xAttackBonus` from committed
  prep and calls `buildVictoryOdds(...)` with its own `baseNoCount` (gym 1, elite 2,
  champion 3, rival 1). The prep panel is bound in each `*.component.html` as
  `<app-battle-prep-panel [team] [opponentTypes] [items] [forcedIndex] (confirmed)>`.
- **i18n**: `src/assets/i18n/{en,de,es,fr,it,pt}.json`; matchup keys live under
  `game.main.roulette.matchup.*`.

## Interaction with `docs/plans/battle-roulette-dedup.md` (Not started)

That plan hoists `calcVictoryOdds`/`buildVictoryOdds` wiring into the base with
hooks, but does **not** change the odds arithmetic. This plan extracts the
*arithmetic* into `BattleOddsService`. The two are orthogonal and may land in
either order:
- If dedup lands first, apply this plan's `buildVictoryOdds` edit to the base's
  (unchanged) `buildVictoryOdds` body, and pass `baseNoCount`/`currentRound` to the
  prep panel from the base template binding instead of four per-subclass ones.
- If this plan lands first, dedup proceeds unchanged (it doesn't touch arithmetic).

No hard dependency either way. Do not block on dedup.

## New shared service

Create `src/app/services/battle-odds-service/battle-odds.service.ts`:

```ts
import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { TypeMatchupService } from '../type-matchup-service/type-matchup.service';
import { AbilityService } from '../ability-service/ability.service';

export const ROUND_THREAT_MULT = 1.5;

export interface BattleOddsBreakdown {
  yesTickets: number;
  noTickets: number;
  winChance: number;          // yesTickets / (yesTickets + noTickets), 0..1
  extraRetry: boolean;        // ability-granted free retry (consumed by the component)
  yes: {
    base: number;             // always 1 (the single base Yes ticket)
    teamPower: number;        // Σ member.power
    typeAdvantage: number;    // advantageDelta + leadAdvantageDelta
    xAttack: number;          // xAttackBonus + classicPlusModifiers
    ability: number;          // abilityYesBonus
  };
  no: {
    base: number;             // baseNoCount
    roundThreat: number;      // ceil(round * ROUND_THREAT_MULT)
    typeDisadvantage: number; // disadvantageDelta + leadDisadvantageDelta
    badOmen: number;
    ability: number;          // abilityNoBonus (may be negative)
    floored: boolean;         // true if Math.max(baseNoCount, raw) clamped upward
  };
}

export interface BattleOddsInput {
  team: PokemonItem[];
  opponentTypes: PokemonType[];   // [] when the opponent has no configured types
  baseNoCount: number;
  currentRound: number;
  leadIndex?: number;
  xAttackBonus?: number;          // committed/selected x-attack mean power, else 0
  classicPlusModifiers?: number;  // BaseBattleRouletteComponent.plusModifiers() result, else 0
  badOmen?: number;               // battleDebuffService.currentDebuff, else 0
  abilitiesActive: boolean;       // gameStateService.isNewExperienceMode
}

@Injectable({ providedIn: 'root' })
export class BattleOddsService {
  constructor(
    private typeMatchupService: TypeMatchupService,
    private abilityService: AbilityService,
  ) {}

  computeOdds(input: BattleOddsInput): BattleOddsBreakdown {
    const { team, opponentTypes, baseNoCount, currentRound } = input;
    const teamPower = team.reduce((s, p) => s + p.power, 0);

    const { yesPower, advantageDelta, disadvantageDelta } =
      this.typeMatchupService.calcTeamMatchupTotals(team, opponentTypes);

    let leadAdvantageDelta = 0;
    let leadDisadvantageDelta = 0;
    if (input.leadIndex != null && opponentTypes.length && team[input.leadIndex]) {
      const d = this.typeMatchupService.getMemberSignedDelta(team[input.leadIndex], opponentTypes);
      if (d > 0) leadAdvantageDelta = d; else if (d < 0) leadDisadvantageDelta = -d;
    }

    let abilityYes = 0, abilityNo = 0, extraRetry = false;
    if (input.abilitiesActive) {
      const a = this.abilityService.applyTeamAbilities(team, opponentTypes);
      abilityYes = a.yesBonus; abilityNo = a.noBonus; extraRetry = a.extraRetry;
    }

    const xAttack = (input.xAttackBonus ?? 0) + (input.classicPlusModifiers ?? 0);
    const badOmen = input.badOmen ?? 0;
    const typeAdvantage = advantageDelta + leadAdvantageDelta;
    const typeDisadvantage = disadvantageDelta + leadDisadvantageDelta;

    const effectivePower = yesPower + leadAdvantageDelta + xAttack + abilityYes;
    const yesTickets = Math.round(effectivePower) + 1;

    const roundThreat = Math.ceil(currentRound * ROUND_THREAT_MULT);
    const rawNo = baseNoCount + roundThreat + disadvantageDelta + leadDisadvantageDelta + badOmen + abilityNo;
    const noTickets = Math.max(baseNoCount, rawNo);

    return {
      yesTickets, noTickets,
      winChance: yesTickets / (yesTickets + noTickets),
      extraRetry,
      yes: { base: 1, teamPower, typeAdvantage, xAttack, ability: abilityYes },
      no: { base: baseNoCount, roundThreat, typeDisadvantage, badOmen, ability: abilityNo, floored: rawNo < baseNoCount },
    };
  }
}
```

**Parity note:** the arithmetic above reproduces `buildVictoryOdds` exactly.
`yes.teamPower` is Σ power; the positive type advantage is already folded into
`yesPower` by `calcTeamMatchupTotals`, so `effectivePower` uses `yesPower` (not
`teamPower + typeAdvantage`) — do NOT double-add. The breakdown's `yes.teamPower`
and `yes.typeAdvantage` are for *display* and together describe `yesPower + leadAdv`.

## Phased steps

Checkpoint after each phase; keep `npm run test:local` green between phases.

- [x] **Phase 1 — Extract `BattleOddsService` + rewire `buildVictoryOdds`.**
  Create the service above with its own spec (`battle-odds.service.spec.ts`)
  porting the numeric cases from `base-battle-roulette.component.spec.ts` (empty
  team, mutual-advantage, mutual-disadvantage, lead doubling both directions,
  badOmen, x-attack) as direct `computeOdds` assertions. Then refactor
  `buildVictoryOdds` to: inject `BattleOddsService` (via `inject()`); call
  `computeOdds({... , classicPlusModifiers: this.plusModifiers(), badOmen: this.battleDebuffService.currentDebuff, abilitiesActive: this.gameStateService.isNewExperienceMode})`;
  keep the `extraRetry` seeding (`if (odds.extraRetry && !this.abilityRetryGranted) { this.abilityRetryGranted = true; this.retries = Math.max(this.retries, 2); }`);
  build `odds.yesTickets` green + `odds.noTickets` crimson items and `interleaveOdds`;
  set `matchupAdvantageDelta = odds.yes.typeAdvantage`, `matchupDisadvantageDelta = odds.no.typeDisadvantage`,
  and keep the `getMatchupTypes(...)` icon block as-is. Store the breakdown in a new
  field `currentOdds: BattleOddsBreakdown | null = null` (set to `null` when
  `!types.length`, else the result). The existing `base-battle-roulette.component.spec.ts`
  must stay green **unchanged** — this proves the refactor is behavior-neutral.

- [x] **Phase 2 — Matchup strip: win % headline + breakdown.**
  Add to `MatchupStripComponent`: `@Input() odds: BattleOddsBreakdown | null = null;`
  (import the interface). In the template, when `odds` is non-null, render above the
  existing type sections:
  - a headline `{{ 'game.main.roulette.odds.winChance' | translate }}: {{ (odds.winChance * 100) | number:'1.0-0' }}%`
    (import `DecimalPipe` via `CommonModule`, already imported);
  - a compact breakdown list showing each **non-zero** contribution, Yes in green /
    No in red, e.g. rows for `odds.no.roundThreat` (`odds.roundThreat` label),
    `odds.no.badOmen`, `odds.no.ability`, `odds.yes.ability`, `odds.yes.xAttack`.
    Reuse existing `.matchup-delta-positive/negative` classes; add a `.odds-winchance`
    class in the CSS. Keep it terse (icon/label + signed number), one row per non-zero
    source. Do **not** duplicate the type advantage/disadvantage rows — those already
    render below from `advantageDelta`/`disadvantageDelta`.
  In each battle component template (`gym`/`elite-four`/`champion`/`rival` `.html`),
  bind `[odds]="prepPhase ? null : currentOdds"` on `<app-matchup-strip>` (during prep,
  the prep panel owns the % so the strip suppresses its headline). Add a strip spec
  asserting the headline renders for a non-null `odds` and is absent for `null`.

- [x] **Phase 3 — Prep panel: live win-chance preview.**
  In `BattlePrepPanelComponent`: add `@Input() baseNoCount = 1;` and
  `@Input() currentRound = 0;`; inject `BattleOddsService`, `BattleDebuffService`,
  `GameStateService`. Add a cached field `oddsPreview: BattleOddsBreakdown | null = null;`
  and a private `recomputePreview()` that sets it via
  `battleOddsService.computeOdds({ team, opponentTypes: this.opponentTypes ?? [], baseNoCount, currentRound, leadIndex: this.selectedLeadIndex, xAttackBonus: this.xAttackSelected ? meanPower : 0, classicPlusModifiers: 0, badOmen: battleDebuffService.currentDebuff, abilitiesActive: gameStateService.isNewExperienceMode })`
  (meanPower = Σpower/length; guard length 0 → preview null). Call `recomputePreview()`
  in `ngOnChanges`, at the end of `selectLead()`, and at the end of `toggleXAttack()`.
  Render the same headline + breakdown block above the confirm button (extract a shared
  presentational sub-template or just repeat the terse markup — your call; keep it one
  place if trivial). In each battle `*.component.html`, add `[baseNoCount]="<1|2|3|1>"`
  and `[currentRound]="currentRound"` to `<app-battle-prep-panel>`. Add prep-panel spec
  cases: win % updates when `selectLead` switches to an advantaged vs disadvantaged
  member, and when `toggleXAttack` flips.

- [x] **Phase 4 — i18n + release notes + docs.**
  Add keys to `en.json` (real) and the other five locales (English placeholder):
  `game.main.roulette.odds.winChance` ("Win chance"), `.roundThreat` ("Round threat"),
  `.badOmen` ("Bad omen"), `.ability` ("Ability"), `.xAttack` ("X Attack"),
  and a header `.title` ("Odds") if the breakdown needs a label. Bump
  `package.json` version `3.5.0` → `3.6.0`; add a newest-first `RELEASE_NOTES` entry
  (`src/app/data/release-notes.ts`) with `whatsNew.v3_6_0.{0,1}` note keys (e.g. "See
  your exact battle win chance before every spin" / "Battle screen now shows every
  hidden threat that shapes the odds"); add those keys + a `v3_6_0` version label to
  **all six** locale files. Update `README.md`'s "New features added on top of the
  original" list with a one-line entry. Do not restate the audit here.

## Acceptance tests (input → expected)

1. **Drift-proof.** For any team/round/lead/ability config, the prep-panel
   `oddsPreview.winChance` computed with a given `selectedLeadIndex` equals
   `currentOdds.winChance` after that lead is confirmed and `buildVictoryOdds` runs
   (same `computeOdds` inputs → same output). Assert in a spec by feeding identical
   inputs to both paths.
2. **Headline correctness.** Champion (`baseNoCount=3`, `round=12`), 6× power-3 all
   Water vs Fire: `winChance ≈ 0.596` → headline renders "60%". `matchupDisadvantageDelta = 0`.
3. **Breakdown reveals hidden No.** Same scenario: breakdown shows a `roundThreat` row
   of `18` even though the type section shows only `+12` advantage.
4. **Ability effect visible.** A team member with `ability: 'torrent'` (soak-if-negative,
   -2) at a type disadvantage: the breakdown renders a non-zero `odds.no.ability` row
   (`-2`), distinct from and in addition to the `typeDisadvantage` row — the two must
   not be conflated into one number.
5. **Prep updates live.** Switching the selected lead from an advantaged member to a
   disadvantaged one lowers `oddsPreview.winChance` (lead-disadvantage doubling shows).
   Toggling X Attack raises it.
6. **Strip suppresses headline during prep.** With `prepPhase=true` the strip receives
   `odds=null` and renders no win %; with `prepPhase=false` it renders the %.
7. **Behavior-neutral refactor.** The unchanged `base-battle-roulette.component.spec.ts`
   and all four component specs stay green.

## Risks

- **Double-adding type advantage** in the breakdown vs `yesPower` — see the parity
  note; `effectivePower` uses `yesPower`, breakdown fields are display-only.
- **Prep/wheel divergence** if any `computeOdds` input differs between the two call
  sites (e.g. prep passes `classicPlusModifiers: 0` but prep only shows in New
  Experience, where `plusModifiers()` is 0 anyway — consistent). Acceptance test 1 pins it.
- **`Eager` CD in the prep panel** recomputes the cached preview only on the three
  explicit calls; confirm no other input mutation path needs a `recomputePreview()`
  (there isn't one today).
- **UI clutter** — keep the breakdown to non-zero rows only; four+ simultaneous
  sources are rare but must wrap cleanly on mobile (verify `.matchup-strip` CSS).
```
