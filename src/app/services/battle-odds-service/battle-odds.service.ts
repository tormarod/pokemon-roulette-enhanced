import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { TypeMatchupService } from '../type-matchup-service/type-matchup.service';
import { AbilityService } from '../ability-service/ability.service';

export const ROUND_THREAT_MULT = 1.25;

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

/**
 * Single source of truth for battle-odds arithmetic — both the wheel builder
 * (buildVictoryOdds) and the prep-panel preview call computeOdds() with the
 * same inputs, so the two can never drift apart (see docs/plans/battle-odds-transparency.md).
 */
@Injectable({ providedIn: 'root' })
export class BattleOddsService {
  constructor(
    private typeMatchupService: TypeMatchupService,
    private abilityService: AbilityService,
  ) {}

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
