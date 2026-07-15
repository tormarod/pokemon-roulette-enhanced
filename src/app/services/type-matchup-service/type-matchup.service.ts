import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { typeMatchups } from './type-matchups-data';

@Injectable({ providedIn: 'root' })
export class TypeMatchupService {

  /** True if pokemonType is super-effective against opponentType. */
  isStrongAgainst(pokemonType: PokemonType, opponentType: PokemonType): boolean {
    return typeMatchups[pokemonType]?.strongAgainst.includes(opponentType) ?? false;
  }

  /** True if opponentType is super-effective against pokemonType. */
  isWeakAgainst(pokemonType: PokemonType, opponentType: PokemonType): boolean {
    return typeMatchups[opponentType]?.strongAgainst.includes(pokemonType) ?? false;
  }

  /**
   * Per-Pokémon power delta: half its own power, rounded up, uncapped — grows
   * linearly with power instead of plateauing, so type matchup stays meaningful
   * even for a maxed-out team. Rounding up (not down) means it's never zero:
   * even a power-1 Pokémon gets a real ±1, so its matchup always matters.
   * Depends only on the Pokémon itself — never on team size or which other
   * Pokémon are on the roster, so adding/removing an unrelated teammate can
   * never change what this one contributes.
   */
  getMemberDelta(member: PokemonItem): number {
    return Math.ceil(member.power / 2);
  }

  private getMemberMatchup(member: PokemonItem, opponentTypes: PokemonType[]): { isStrong: boolean; isWeak: boolean } {
    const memberTypes = ([member.type1, member.type2] as Array<PokemonType | null | undefined>)
      .filter((t): t is PokemonType => !!t);

    const isStrong = memberTypes.some(mt => opponentTypes.some(ot => this.isStrongAgainst(mt, ot)));
    const isWeak = memberTypes.some(mt => opponentTypes.some(ot => this.isWeakAgainst(mt, ot)));
    return { isStrong, isWeak };
  }

  /**
   * Aggregates the whole team's matchup against the opponent's types in one pass:
   * - yesPower: total power feeding the Yes pool — each member's raw power, plus
   *   its own capped delta for strong-only members (an advantage grows Yes).
   * - noBonus: extra No tickets from weak-only members (a disadvantage grows No,
   *   instead of shrinking Yes — makes a bad matchup visibly show up as more red
   *   slices on the wheel rather than a smaller green pool).
   * - advantageDelta / disadvantageDelta: the same two contributions broken out
   *   for the matchup-strip UI, so the displayed number always matches what was
   *   actually applied to the odds (same single computation, no drift).
   * Members that are both strong and weak (a mixed-type Pokémon with one type
   * favorable and one unfavorable) cancel out and contribute to neither total.
   */
  calcTeamMatchupTotals(
    team: PokemonItem[],
    opponentTypes: PokemonType[]
  ): { yesPower: number; noBonus: number; advantageDelta: number; disadvantageDelta: number } {
    let yesPower = 0;
    let advantageDelta = 0;
    let disadvantageDelta = 0;

    for (const member of team) {
      const { isStrong, isWeak } = this.getMemberMatchup(member, opponentTypes);
      yesPower += member.power;

      if (isStrong && !isWeak) {
        const delta = this.getMemberDelta(member);
        yesPower += delta;
        advantageDelta += delta;
      } else if (isWeak && !isStrong) {
        disadvantageDelta += this.getMemberDelta(member);
      }
    }

    return { yesPower, noBonus: disadvantageDelta, advantageDelta, disadvantageDelta };
  }

  /**
   * Returns the unique PokemonType values from the team that are strong or weak
   * against the given opponent types. Used by the inline matchup strip to render
   * type icon rows.
   *
   * advantageTypes: unique types from team members where the type is SE against
   *   ANY opponent type. Order: type1 before type2, team order preserved, deduplicated.
   *
   * disadvantageTypes: unique types from team members where ANY opponent type is
   *   SE against that member type. Same ordering and dedup rules.
   *
   * A type may appear in both arrays (same member could have one of each on its
   * two types). Returns empty arrays when team or opponentTypes is empty.
   */
  getMatchupTypes(
    team: PokemonItem[],
    opponentTypes: PokemonType[]
  ): { advantageTypes: PokemonType[]; disadvantageTypes: PokemonType[] } {
    if (!team.length || !opponentTypes.length) {
      return { advantageTypes: [], disadvantageTypes: [] };
    }

    const advantageTypes: PokemonType[] = [];
    const disadvantageTypes: PokemonType[] = [];
    const seenAdvantage = new Set<PokemonType>();
    const seenDisadvantage = new Set<PokemonType>();

    for (const member of team) {
      const memberTypes = ([member.type1, member.type2] as Array<PokemonType | null | undefined>)
        .filter((t): t is PokemonType => !!t);

      for (const mt of memberTypes) {
        if (!seenAdvantage.has(mt) && opponentTypes.some(ot => this.isStrongAgainst(mt, ot))) {
          advantageTypes.push(mt);
          seenAdvantage.add(mt);
        }
        if (!seenDisadvantage.has(mt) && opponentTypes.some(ot => this.isWeakAgainst(mt, ot))) {
          disadvantageTypes.push(mt);
          seenDisadvantage.add(mt);
        }
      }
    }

    return { advantageTypes, disadvantageTypes };
  }
}
