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

  /** True if pokemonType takes half damage (0.5x) from opponentType. */
  resists(pokemonType: PokemonType, opponentType: PokemonType): boolean {
    return typeMatchups[pokemonType]?.resists.includes(opponentType) ?? false;
  }

  /** True if pokemonType takes no damage (0x) from opponentType. */
  isImmuneTo(pokemonType: PokemonType, opponentType: PokemonType): boolean {
    return typeMatchups[pokemonType]?.immuneTo.includes(opponentType) ?? false;
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

  private getMemberTypes(member: PokemonItem): PokemonType[] {
    return ([member.type1, member.type2] as Array<PokemonType | null | undefined>)
      .filter((t): t is PokemonType => !!t);
  }

  /**
   * Worst-case defensive read of a member against the opponent's types, folding
   * in resistance and immunity (not just raw "is SE against me"):
   * - 'immune': any of the member's types is immune to any opponent type — the
   *   strongest possible defensive result, dominates everything else.
   * - 'doubleWeak': either a single opponent type is super-effective through
   *   BOTH of the member's types at once (the double-type-weakness case, akin
   *   to 4x), or the member is unresistedly weak to two distinct opponent
   *   types — either way, there's no defensive out.
   * - 'weak': unresistedly super-effective against exactly one opponent type.
   * - 'safe': neutral, or the member's other type resists/cancels out the hit
   *   (double-typing providing coverage instead of just canceling).
   */
  private getDefenseTier(memberTypes: PokemonType[], opponentTypes: PokemonType[]): 'immune' | 'doubleWeak' | 'weak' | 'safe' {
    const isImmune = memberTypes.some(mt => opponentTypes.some(ot => this.isImmuneTo(mt, ot)));
    if (isImmune) return 'immune';

    let weakOpponentTypeCount = 0;
    let hasDoubleStack = false;

    for (const ot of opponentTypes) {
      let exponent = 0;
      for (const mt of memberTypes) {
        if (this.isWeakAgainst(mt, ot)) exponent++;
        else if (this.resists(mt, ot)) exponent--;
      }
      if (exponent >= 2) hasDoubleStack = true;
      if (exponent >= 1) weakOpponentTypeCount++;
    }

    if (hasDoubleStack || weakOpponentTypeCount >= 2) return 'doubleWeak';
    if (weakOpponentTypeCount === 1) return 'weak';
    return 'safe';
  }

  /**
   * Buckets a member's overall matchup into one of four tiers by combining
   * offense (does it hit the opponent super-effectively?) with the graded
   * defense read from `getDefenseTier`. An immune member is always 'strong'
   * (a defensive wall). An offensively-strong member that is also weak on
   * defense cancels out to 'neutral', matching the existing cancel behavior.
   * A member that's weak on defense with no offensive answer and no way out
   * (double-stacked or hit by two distinct opponent types) is 'hard-countered'.
   */
  getMemberTier(member: PokemonItem, opponentTypes: PokemonType[]): 'strong' | 'neutral' | 'weak' | 'hard-countered' {
    if (!opponentTypes.length) return 'neutral';

    const memberTypes = this.getMemberTypes(member);
    const isOffenseStrong = memberTypes.some(mt => opponentTypes.some(ot => this.isStrongAgainst(mt, ot)));
    const defenseTier = this.getDefenseTier(memberTypes, opponentTypes);

    if (defenseTier === 'immune') return 'strong';
    if (isOffenseStrong && (defenseTier === 'weak' || defenseTier === 'doubleWeak')) return 'neutral';
    if (isOffenseStrong) return 'strong';
    if (defenseTier === 'doubleWeak') return 'hard-countered';
    if (defenseTier === 'weak') return 'weak';
    return 'neutral';
  }

  /**
   * Delta magnitude for a member's tier, in wheel tickets:
   * - 'strong' / 'weak': the base power-derived unit (`getMemberDelta`,
   *   `ceil(power/2)`) — an advantage's worth of green, or a plain weakness's
   *   worth of red.
   * - 'hard-countered': double that base. A hard counter (4x, or hit two
   *   different ways with no answer) hurts twice as much as a plain weakness,
   *   and — like the base unit — keeps scaling with power instead of
   *   plateauing, so a hard counter is always a strictly worse matchup than a
   *   plain 'weak', at every power (even power 1: weak 1 red vs hard 2) and
   *   every team size. Deliberately uncapped: the value is already bounded by
   *   the 1..8 power range (max 8 red), and an earlier flat cap only served to
   *   flatten high-power hard counters back down toward 'weak'.
   * Sign / which pool it feeds is applied by the caller.
   */
  getTierDeltaMagnitude(member: PokemonItem, tier: 'strong' | 'weak' | 'hard-countered'): number {
    const base = this.getMemberDelta(member);
    return tier === 'hard-countered' ? base * 2 : base;
  }

  /**
   * Aggregates the whole team's matchup against the opponent's types in one pass:
   * - yesPower: total power feeding the Yes pool — each member's raw power, plus
   *   its own `ceil(power/2)` delta for 'strong'-tier members (an advantage grows
   *   Yes). 'strong' covers both an unresisted offensive advantage and a
   *   defensive immunity (a wall the opponent simply can't touch).
   * - noBonus: extra No tickets from 'weak' and 'hard-countered' members (a
   *   disadvantage grows No, instead of shrinking Yes — makes a bad matchup
   *   visibly show up as more red slices on the wheel rather than a smaller
   *   green pool). 'hard-countered' (double-stacked or hit by two distinct
   *   opponent types with no resist/offense to fall back on) contributes double
   *   a plain 'weak' (see `getTierDeltaMagnitude`), so a hard counter always
   *   reads as a clearly worse matchup than a plain weakness, at any power.
   *   The member still keeps its full power in the Yes pool either way — the
   *   penalty is extra red, never lost green, so its bulk always shows.
   * - advantageDelta / disadvantageDelta: the same two contributions broken out
   *   for the matchup-strip UI, so the displayed number always matches what was
   *   actually applied to the odds (same single computation, no drift).
   * A member whose offense and defense cancel out (e.g. strong against one
   * opponent type but unresistedly weak against another) lands on 'neutral'
   * and contributes to neither total — see `getMemberTier`.
   */
  calcTeamMatchupTotals(
    team: PokemonItem[],
    opponentTypes: PokemonType[]
  ): { yesPower: number; noBonus: number; advantageDelta: number; disadvantageDelta: number } {
    let yesPower = 0;
    let advantageDelta = 0;
    let disadvantageDelta = 0;

    for (const member of team) {
      const tier = this.getMemberTier(member, opponentTypes);
      yesPower += member.power;

      if (tier === 'strong') {
        const delta = this.getTierDeltaMagnitude(member, tier);
        yesPower += delta;
        advantageDelta += delta;
      } else if (tier === 'weak' || tier === 'hard-countered') {
        disadvantageDelta += this.getTierDeltaMagnitude(member, tier);
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
