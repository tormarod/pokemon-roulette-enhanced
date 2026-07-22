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

  /** All types super-effective against `type` (i.e. `type` is weak to them). */
  getSuperEffectiveCounters(type: PokemonType): PokemonType[] {
    return (Object.keys(typeMatchups) as PokemonType[]).filter(t => this.isWeakAgainst(type, t));
  }

  /**
   * Per-net-score-point unit, in wheel tickets: half of the Pokémon's own
   * power, rounded up, uncapped (doubled from the original quarter-power unit —
   * see docs/plans/endgame-rebalance.md Lever B — so type-countering the
   * opponent pays off more). Two mutually-favorable type pairs (e.g. Water vs
   * Fire: SE and resists, netScore 2) reproduces the Pokémon's own power for
   * even powers. Never zero — even a power-1 Pokémon's matchup always matters.
   * Depends only on the Pokémon itself, never on team size or other roster
   * members.
   */
  getMemberDelta(member: PokemonItem): number {
    return Math.ceil(member.power / 2);
  }

  private getMemberTypes(member: PokemonItem): PokemonType[] {
    return ([member.type1, member.type2] as Array<PokemonType | null | undefined>)
      .filter((t): t is PokemonType => !!t);
  }

  /**
   * Offensive contribution of our type `mt` attacking their type `ot`,
   * positive is good for us: +1 if we're super-effective, -2 if they're fully
   * immune to our attack, -1 if they merely resist it, 0 otherwise.
   */
  private offenseContribution(mt: PokemonType, ot: PokemonType): number {
    if (this.isStrongAgainst(mt, ot)) return 1;
    if (this.isImmuneTo(ot, mt)) return -2;
    if (this.resists(ot, mt)) return -1;
    return 0;
  }

  /**
   * Defensive contribution of their type `ot` attacking our type `mt`,
   * positive is good for us: +2 if we're fully immune, +1 if we merely
   * resist it, -1 if they're super-effective against us, 0 otherwise.
   */
  private defenseContribution(mt: PokemonType, ot: PokemonType): number {
    if (this.isImmuneTo(mt, ot)) return 2;
    if (this.resists(mt, ot)) return 1;
    if (this.isWeakAgainst(mt, ot)) return -1;
    return 0;
  }

  /**
   * Symmetric net score for a member against the opponent's types: every one
   * of the member's types is always "active" on both offense and defense — no
   * move/ability system exists, so there's no best-case type to cherry-pick.
   * Positive means the member is a net advantage, negative a net
   * disadvantage, zero neutral.
   *
   * Same-type pairs (`mt === ot`) are skipped: they always contribute exactly
   * 0 (the offense and defense checks read the identical self-relation off
   * the type chart with opposite sign, and no type is super-effective against
   * or weak to itself), so including them would be a no-op for the score but
   * would wrongly make the type look like it's "doing something" in the
   * display breakdown (see `getMatchupTypes`).
   *
   * `opponentTypes` is a trainer's team theme (2-3 types), not one dual-type
   * Pokémon — entries are never multiplied together. A *repeated* type in
   * that list (e.g. Lance's `['dragon', 'dragon']`) is an intentional
   * emphasis lever (see `GymLeader.types`): summing with repetition counts it
   * twice, with no special-casing needed.
   */
  private getMemberNetScore(member: PokemonItem, opponentTypes: PokemonType[]): number {
    const memberTypes = this.getMemberTypes(member);
    let total = 0;
    for (const mt of memberTypes) {
      for (const ot of opponentTypes) {
        if (mt === ot) continue;
        total += this.offenseContribution(mt, ot) + this.defenseContribution(mt, ot);
      }
    }
    return total;
  }

  /** Signed, magnitude-scaled contribution of one team member against the opponent's types. */
  getMemberSignedDelta(member: PokemonItem, opponentTypes: PokemonType[]): number {
    return this.getMemberNetScore(member, opponentTypes) * this.getMemberDelta(member);
  }

  /**
   * Aggregates the whole team's matchup against the opponent's types in one pass:
   * - yesPower: total power feeding the Yes pool — each member's raw power,
   *   plus its signed delta when positive (an advantage grows Yes).
   * - noBonus: extra No tickets from members with a negative delta (a
   *   disadvantage grows No, instead of shrinking Yes — makes a bad matchup
   *   visibly show up as more red slices on the wheel rather than a smaller
   *   green pool). The member still keeps its full power in the Yes pool
   *   either way — the penalty is extra red, never lost green.
   * - advantageDelta / disadvantageDelta: the same two contributions broken
   *   out for the matchup-strip UI, so the displayed number always matches
   *   what was actually applied to the odds (same single computation, no
   *   drift).
   * A member whose net score is exactly 0 contributes to neither total — see
   * `getMemberNetScore`.
   */
  calcTeamMatchupTotals(
    team: PokemonItem[],
    opponentTypes: PokemonType[]
  ): { yesPower: number; noBonus: number; advantageDelta: number; disadvantageDelta: number } {
    let yesPower = 0;
    let advantageDelta = 0;
    let disadvantageDelta = 0;

    for (const member of team) {
      yesPower += member.power;
      const delta = this.getMemberSignedDelta(member, opponentTypes);

      if (delta > 0) {
        yesPower += delta;
        advantageDelta += delta;
      } else if (delta < 0) {
        disadvantageDelta += -delta;
      }
    }

    return { yesPower, noBonus: disadvantageDelta, advantageDelta, disadvantageDelta };
  }

  /**
   * Returns the unique PokemonType values from the team that back the matchup
   * strip, per the SAME net-score read `calcTeamMatchupTotals` uses
   * (`getMemberNetScore`) — not raw per-type super-effectiveness. This keeps
   * the matchup-strip icons in sync with the delta numbers they sit next to.
   *
   * For a member with a positive net score, each of its types goes into
   * superEffectiveTypes if its own offensive sub-score (summed across
   * opponent types, excluding same-type pairs) is positive, and into
   * resistTypes if its own defensive sub-score is positive — a type can land
   * in both (e.g. Water vs Fire: SE and resists).
   *
   * For a member with a negative net score, each of its types goes into
   * weakTypes if either its offensive or defensive sub-score is negative.
   *
   * A member with a net score of exactly 0 (e.g. pure Grass vs Grass, or
   * Grass/Fairy vs Grass — the type doing the resisting is itself equally
   * resisted back) contributes to nothing. Same-type pairs are always
   * excluded from a type's own sub-score (see `getMemberNetScore`), so a
   * type whose only relationship to the opponent is its mirror image never
   * shows an icon for it. Order: type1 before type2, team order preserved,
   * deduplicated across the whole team per array. Returns empty arrays when
   * team or opponentTypes is empty.
   */
  getMatchupTypes(
    team: PokemonItem[],
    opponentTypes: PokemonType[]
  ): { superEffectiveTypes: PokemonType[]; resistTypes: PokemonType[]; weakTypes: PokemonType[] } {
    const superEffectiveTypes: PokemonType[] = [];
    const resistTypes: PokemonType[] = [];
    const weakTypes: PokemonType[] = [];
    if (!team.length || !opponentTypes.length) {
      return { superEffectiveTypes, resistTypes, weakTypes };
    }

    const seenSe = new Set<PokemonType>();
    const seenRes = new Set<PokemonType>();
    const seenWeak = new Set<PokemonType>();

    for (const member of team) {
      const netScore = this.getMemberNetScore(member, opponentTypes);
      if (netScore === 0) continue;

      const memberTypes = this.getMemberTypes(member);

      for (const mt of memberTypes) {
        let off = 0;
        let def = 0;
        for (const ot of opponentTypes) {
          if (mt === ot) continue;
          off += this.offenseContribution(mt, ot);
          def += this.defenseContribution(mt, ot);
        }

        if (netScore > 0) {
          if (off > 0 && !seenSe.has(mt)) {
            superEffectiveTypes.push(mt);
            seenSe.add(mt);
          }
          if (def > 0 && !seenRes.has(mt)) {
            resistTypes.push(mt);
            seenRes.add(mt);
          }
        } else {
          if ((off < 0 || def < 0) && !seenWeak.has(mt)) {
            weakTypes.push(mt);
            seenWeak.add(mt);
          }
        }
      }
    }

    return { superEffectiveTypes, resistTypes, weakTypes };
  }
}
