# Plan: Matchup strip — shared component + offensive/defensive split

Status: **Done. Display-only — no odds/tier change.**
Owner: tormarod
Last updated: 2026-07-17
Two goals in one pass: (1) **de-duplicate** the strip (currently copy-pasted into
4 battle templates) into a shared component; (2) split the advantage into
**offensive (super-effective)** vs **defensive (resists)** so a defensive resist
no longer reads as an offensive advantage.

## Why (the odds are already correct)

Grass/Fairy vs a Grass leader is a **real, mild advantage** in actual Pokémon: you
take `0.5×` from their Grass (defense is worst-case, unavoidable) and hit back at
`1.0×` with Fairy (offense is best-case — you skip the resisted Grass move). The
`+1` is right and `getMemberTier` already distinguishes pure-Grass (→ neutral)
from Grass/Fairy (→ resistant). **Do not touch tier logic or deltas.** The only
problem is the label reading a *defensive* resist as generic "Advantage: Grass".

## 1. `getMatchupTypes` — return the split (only service change)

Replace `{ advantageTypes, disadvantageTypes }` with three arrays. Same
per-member, tier-gated iteration; a type may be both SE and resist (Water vs Fire):

```ts
getMatchupTypes(team: PokemonItem[], opponentTypes: PokemonType[]):
    { superEffectiveTypes: PokemonType[]; resistTypes: PokemonType[]; weakTypes: PokemonType[] } {
  const se: PokemonType[] = [], res: PokemonType[] = [], weak: PokemonType[] = [];
  const seenSe = new Set<PokemonType>(), seenRes = new Set<PokemonType>(), seenWeak = new Set<PokemonType>();
  if (!team.length || !opponentTypes.length) return { superEffectiveTypes: se, resistTypes: res, weakTypes: weak };
  for (const member of team) {
    const tier = this.getMemberTier(member, opponentTypes);
    const memberTypes = this.getMemberTypes(member);
    if (tier === 'strong' || tier === 'resistant' || tier === 'hard-resistant') {
      for (const mt of memberTypes) {
        if (opponentTypes.some(ot => this.isStrongAgainst(mt, ot)) && !seenSe.has(mt)) { se.push(mt); seenSe.add(mt); }
        if (opponentTypes.some(ot => this.resists(mt, ot) || this.isImmuneTo(mt, ot)) && !seenRes.has(mt)) { res.push(mt); seenRes.add(mt); }
      }
    } else if (tier === 'weak' || tier === 'hard-countered') {
      for (const mt of memberTypes) {
        if (opponentTypes.some(ot => this.isWeakAgainst(mt, ot)) && !seenWeak.has(mt)) { weak.push(mt); seenWeak.add(mt); }
      }
    }
  }
  return { superEffectiveTypes: se, resistTypes: res, weakTypes: weak };
}
```
(`calcTeamMatchupTotals`, `getMemberTier`, deltas untouched.)

## 2. `base-battle-roulette.component.ts`

- Replace `matchupAdvantageTypes` with `matchupSuperEffectiveTypes: PokemonType[] = []`
  and `matchupResistTypes: PokemonType[] = []`. Keep `matchupDisadvantageTypes`
  (= `weakTypes`) and both delta fields.
- In `buildVictoryOdds`, assign the three arrays from `getMatchupTypes(...)`; clear
  all three in the no-opponent-types branch.

## 3. New shared component `MatchupStripComponent`

Create `src/app/main-game/matchup-strip/matchup-strip.component.{ts,html,css}`.
This **owns the strip markup and CSS** (moved out of the 4 templates).

`.ts` (standalone, OnPush, pure inputs):
```ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';

@Component({
  selector: 'app-matchup-strip',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './matchup-strip.component.html',
  styleUrl: './matchup-strip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchupStripComponent {
  @Input() opponentTypes: PokemonType[] = [];
  @Input() superEffectiveTypes: PokemonType[] = [];
  @Input() resistTypes: PokemonType[] = [];
  @Input() weakTypes: PokemonType[] = [];
  @Input() advantageDelta = 0;
  @Input() disadvantageDelta = 0;
  readonly getTypeIconUrl = getTypeIconUrl;
}
```

`.html` — the full strip, with the offensive/defensive split:
```html
<div class="matchup-strip">
  <div class="matchup-icons-row">
    @for (type of opponentTypes; track $index) { <img [src]="getTypeIconUrl(type)" [alt]="type" height="20"> }
  </div>
  @if (advantageDelta > 0) {
    <div class="matchup-section">
      @if (superEffectiveTypes.length) {
        <span class="matchup-label matchup-label-positive">{{ 'game.main.roulette.matchup.superEffective' | translate }}</span>
        <div class="matchup-icons-row">
          @for (type of superEffectiveTypes; track $index) { <img [src]="getTypeIconUrl(type)" [alt]="type" height="20"> }
        </div>
      }
      @if (resistTypes.length) {
        <span class="matchup-label matchup-label-positive">{{ 'game.main.roulette.matchup.resists' | translate }}</span>
        <div class="matchup-icons-row">
          @for (type of resistTypes; track $index) { <img [src]="getTypeIconUrl(type)" [alt]="type" height="20"> }
        </div>
      }
      <span class="matchup-delta matchup-delta-positive">+{{ advantageDelta }}</span>
    </div>
  }
  @if (disadvantageDelta > 0) {
    <div class="matchup-section">
      <span class="matchup-label matchup-label-negative">{{ 'game.main.roulette.matchup.weak' | translate }}</span>
      <div class="matchup-icons-row">
        @for (type of weakTypes; track $index) { <img [src]="getTypeIconUrl(type)" [alt]="type" height="20"> }
        <span class="matchup-delta matchup-delta-negative">-{{ disadvantageDelta }}</span>
      </div>
    </div>
  }
</div>
```

`.css`: **move** the `.matchup-strip`, `.matchup-icons-row`, `.matchup-section`,
`.matchup-label(-positive/-negative)`, `.matchup-delta(-positive/-negative)` rules
here from the battle components' CSS, and **delete them from those 4 CSS files**
(that's the de-duplication payoff).

## 4. Wire the 4 battle templates (gym / rival / elite-four / champion)

In each `.component.ts`, add `MatchupStripComponent` to `imports`. In each
`.component.html`, replace the whole duplicated `@if (currentX && currentX.types?.length) { <div class="matchup-strip">…</div> }`
block with (using that template's own opponent field — `currentLeader`,
`currentRival`, `currentElite`, `currentChampion`):
```html
@if (currentLeader?.types?.length) {
  <app-matchup-strip
    [opponentTypes]="currentLeader.types"
    [superEffectiveTypes]="matchupSuperEffectiveTypes"
    [resistTypes]="matchupResistTypes"
    [weakTypes]="matchupDisadvantageTypes"
    [advantageDelta]="matchupAdvantageDelta"
    [disadvantageDelta]="matchupDisadvantageDelta" />
}
```

## 5. i18n — shared keys in all 6 locales

Add under `game.main.roulette.matchup` (replaces the per-battle-type
`typeAdvantage.*` labels for these rows; the old keys can be removed):
- `superEffective`: en "Super effective", es "Supereficaz", de "Sehr effektiv", fr "Super efficace", it "Superefficace", pt "Supereficaz"
- `resists`: en "Resists", es "Resiste", de "Resistent", fr "Résiste", it "Resiste", pt "Resiste"
- `weak`: en "Weak", es "Débil", de "Schwach", fr "Faible", it "Debole", pt "Fraco"

## 6. Tests (`type-matchup.service.spec.ts`)

`getMatchupTypes([member], ['grass'])`:
| member | superEffectiveTypes | resistTypes | weakTypes |
|---|---|---|---|
| grass/fairy | [] | ['grass'] | [] |
| grass/poison | ['poison'] | ['grass'] | [] |
| pure grass | [] | [] | [] |
| water (vs ['fire']) | ['water'] | ['water'] | [] |
| fire (vs ['water']) | [] | [] | ['fire'] |

## Steps
1. `getMatchupTypes` (§1) + base component fields/wiring (§2).
2. Create `MatchupStripComponent` (§3); move CSS in, delete the duplicated CSS
   from the 4 battle CSS files.
3. Swap each of the 4 templates to `<app-matchup-strip>` + imports (§4); i18n (§5).
4. Tests (§6); `npm run test:local` green (update specs referencing the old
   `advantageTypes`/`matchupAdvantageTypes`).
5. Manual: a Grass/Fairy team vs Erika shows "Resists: Grass +1"; verify all 4
   battle types render the strip identically.
6. Mark done → `docs/plans/done/`.
