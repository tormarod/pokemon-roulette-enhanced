import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { TypeMatchupService } from '../type-matchup-service/type-matchup.service';
import { AbilityDefinition, abilitiesData } from './abilities-data';

@Injectable({ providedIn: 'root' })
export class AbilityService {

  constructor(private typeMatchupService: TypeMatchupService) {}

  getAbility(pokemonId: number): AbilityDefinition | undefined {
    return abilitiesData[pokemonId];
  }

  private memberTypes(member: PokemonItem): PokemonType[] {
    return ([member.type1, member.type2] as Array<PokemonType | null | undefined>)
      .filter((t): t is PokemonType => !!t);
  }

  private sharesType(a: PokemonItem, b: PokemonItem): boolean {
    const bTypes = this.memberTypes(b);
    return this.memberTypes(a).some(t => bTypes.includes(t));
  }

  /**
   * Folds every team member's ability effect into a single yes/no odds
   * adjustment plus a free-retry flag. Only "Sturdy" (faint-immune-lead, see
   * `abilitiesData`) is lead-specific and handled separately by the faint
   * mechanic (Part B) via `getAbility` — every other effect applies per
   * member same as the base matchup math, regardless of `leadIndex`.
   */
  applyTeamAbilities(
    team: PokemonItem[],
    opponentTypes: PokemonType[]
  ): { yesBonus: number; noBonus: number; extraRetry: boolean } {
    let yesBonus = 0;
    let noBonus = 0;
    let extraRetry = false;

    for (const member of team) {
      const ability = this.getAbility(member.pokemonId);
      if (!ability) continue;

      const delta = opponentTypes.length
        ? this.typeMatchupService.getMemberSignedDelta(member, opponentTypes)
        : 0;

      switch (ability.effect) {
        case 'flat-yes':
          yesBonus += ability.value;
          break;
        case 'flat-no':
          noBonus += ability.value;
          break;
        case 'offense-if-positive':
          if (delta > 0) yesBonus += ability.value;
          break;
        case 'soak-if-negative':
          if (delta < 0) noBonus += ability.value;
          break;
        case 'zero-own-negative':
          if (delta < 0) noBonus += delta;
          break;
        case 'team-synergy': {
          const synergyCount = team.filter(other => this.sharesType(other, member)).length;
          yesBonus += synergyCount * ability.value;
          break;
        }
        case 'extra-retry':
          extraRetry = true;
          break;
        case 'faint-immune-lead':
          // Handled by the faint mechanic (Part B), not the odds computation.
          break;
      }
    }

    return { yesBonus, noBonus, extraRetry };
  }
}
