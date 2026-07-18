import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { TypeMatchupService } from '../type-matchup-service/type-matchup.service';
import { AbilityDefinition, AbilityId, abilitiesById } from './abilities-data';

@Injectable({ providedIn: 'root' })
export class AbilityService {

  constructor(private typeMatchupService: TypeMatchupService) {}

  /** Resolve an ability definition from its stable id. */
  getAbilityById(id: AbilityId | undefined): AbilityDefinition | undefined {
    return id ? abilitiesById[id] : undefined;
  }

  /** The ability the player assigned to this member, if any. */
  getMemberAbility(member: PokemonItem): AbilityDefinition | undefined {
    return this.getAbilityById(member.ability);
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
   * Folds every team member's assigned-ability effect into a single yes/no odds
   * adjustment plus a free-retry flag. Only "Sturdy" (faint-immune-lead, see
   * `abilitiesById`) is lead-specific and handled separately by the faint
   * mechanic (Part B) via `getMemberAbility` — every other effect applies per
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
      const ability = this.getMemberAbility(member);
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
        // ── New mechanics (§4b + §4c) ─────────────────────────────────────
        case 'double-edged':
          // +value Yes and +value No — pure variance, net-neutral in expectation.
          yesBonus += ability.value;
          noBonus += ability.value;
          break;
        case 'defensive-synergy': {
          // -value No per team member sharing a type (defensive mirror of team-synergy).
          const synergyCount = team.filter(other => this.sharesType(other, member)).length;
          noBonus += -ability.value * synergyCount;
          break;
        }
        case 'punish-disadvantage':
          // +value Yes when this member is at a type disadvantage.
          if (opponentTypes.length && delta < 0) yesBonus += ability.value;
          break;
        case 'low-team-offense':
          // +value Yes while the team has <= 2 members (desperation buff).
          if (team.length <= 2) yesBonus += ability.value;
          break;
        case 'neutral-bonus':
          // +value Yes on an exactly-neutral matchup (opponent types present).
          if (opponentTypes.length && delta === 0) yesBonus += ability.value;
          break;
        case 'dual-type-offense':
          // +value Yes if this member is dual-typed.
          if (member.type2) yesBonus += ability.value;
          break;
        case 'mono-type-offense':
          // +value Yes if this member is single-typed.
          if (!member.type2) yesBonus += ability.value;
          break;
        case 'scale-with-advantage':
          // +Yes equal to the advantage, capped at value.
          if (opponentTypes.length && delta > 0) yesBonus += Math.min(delta, ability.value);
          break;
        case 'scale-with-disadvantage':
          // +Yes equal to |disadvantage|, capped at value.
          if (opponentTypes.length && delta < 0) yesBonus += Math.min(-delta, ability.value);
          break;
      }
    }

    return { yesBonus, noBonus, extraRetry };
  }
}
