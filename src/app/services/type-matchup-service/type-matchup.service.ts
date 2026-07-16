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
   *
   * `opponentTypes` is a trainer's team theme (2-3 types), not one dual-type
   * Pokémon — entries are never multiplied together. But a *repeated* type in
   * that list (e.g. Lance's `['dragon', 'dragon']`) is counted once per
   * occurrence here by design: it's an intentional emphasis lever (see
   * `GymLeader.types`), not a data bug to dedupe. A member weak to the
   * repeated type is counted against twice, pushing it from 'weak' to
   * 'doubleWeak' — the trainer "leans into" that type, so being weak to it is
   * punished harder. The same counting rewards resisting an emphasized type
   * (see the resist tiers below).
   */
  private getDefenseTier(memberTypes: PokemonType[], opponentTypes: PokemonType[]): 'immune' | 'doubleWeak' | 'weak' | 'doubleResist' | 'resist' | 'safe' {
    const isImmune = memberTypes.some(mt => opponentTypes.some(ot => this.isImmuneTo(mt, ot)));
    if (isImmune) return 'immune';

    let weakOpponentTypeCount = 0;
    let hasDoubleStack = false;
    let resistOpponentTypeCount = 0;
    let hasDoubleResistStack = false;

    for (const ot of opponentTypes) {
      let exponent = 0;
      for (const mt of memberTypes) {
        if (this.isWeakAgainst(mt, ot)) exponent++;
        else if (this.resists(mt, ot)) exponent--;
      }
      if (exponent >= 2) hasDoubleStack = true;
      if (exponent >= 1) weakOpponentTypeCount++;
      if (exponent <= -2) hasDoubleResistStack = true;
      if (exponent <= -1) resistOpponentTypeCount++;
    }

    if (hasDoubleStack || weakOpponentTypeCount >= 2) return 'doubleWeak';
    if (weakOpponentTypeCount === 1) return 'weak';
    if (hasDoubleResistStack || resistOpponentTypeCount >= 2) return 'doubleResist';
    if (resistOpponentTypeCount === 1) return 'resist';
    return 'safe';
  }

  /**
   * Buckets a member's overall matchup into one of six tiers by combining
   * offense (does it hit the opponent super-effectively?) with the graded
   * defense read from `getDefenseTier`. An immune member is always 'strong'
   * (a defensive wall). An offensively-strong member that is also weak on
   * defense cancels out to 'neutral', matching the existing cancel behavior.
   * A member that's weak on defense with no offensive answer and no way out
   * (double-stacked or hit by two distinct opponent types) is 'hard-countered'.
   * A member with no offensive answer that instead *nets a resist* (0.5x/0.25x,
   * no weakness to fall back to) is 'resistant' — the defensively-excellent
   * matchup this tier exists to stop reading as identical to blank neutral.
   * 'hard-resistant' is the resist-side analogue of 'hard-countered' (double
   * resist, or resisting two distinct opponent types) — including the emphasis
   * lever: resisting a type a trainer repeats in their `types` list (see
   * `getDefenseTier`) counts double and lands here. Precedence is unchanged
   * from before: immunity > offense/weakness cancel > offense > weak family >
   * resist family — a member weak to any opponent type is still 'weak' or
   * 'hard-countered', never rescued into a resist tier.
   */
  getMemberTier(member: PokemonItem, opponentTypes: PokemonType[]): 'strong' | 'neutral' | 'weak' | 'hard-countered' | 'resistant' | 'hard-resistant' {
    if (!opponentTypes.length) return 'neutral';

    const memberTypes = this.getMemberTypes(member);
    const isOffenseStrong = memberTypes.some(mt => opponentTypes.some(ot => this.isStrongAgainst(mt, ot)));
    const defenseTier = this.getDefenseTier(memberTypes, opponentTypes);

    if (defenseTier === 'immune') return 'strong';
    if (isOffenseStrong && (defenseTier === 'weak' || defenseTier === 'doubleWeak')) return 'neutral';
    if (isOffenseStrong) return 'strong';
    if (defenseTier === 'doubleWeak') return 'hard-countered';
    if (defenseTier === 'weak') return 'weak';
    if (defenseTier === 'doubleResist') return 'hard-resistant';
    if (defenseTier === 'resist') return 'resistant';
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
   * - 'resistant' / 'hard-resistant': half the weak/hard-countered scale
   *   (`ceil(power/4)`, doubled for 'hard-resistant') — deliberately smaller
   *   than an offensive/immune 'strong', since a resist alone is a softer
   *   advantage than a clean SE answer or a wall, but it must no longer read
   *   as flat neutral. Never zero, same reasoning as `getMemberDelta`.
   * Sign / which pool it feeds is applied by the caller.
   */
  getTierDeltaMagnitude(member: PokemonItem, tier: 'strong' | 'weak' | 'hard-countered' | 'resistant' | 'hard-resistant'): number {
    const base = this.getMemberDelta(member);
    if (tier === 'hard-countered') return base * 2;
    if (tier === 'resistant' || tier === 'hard-resistant') {
      const resistBase = Math.ceil(member.power / 4);
      return tier === 'hard-resistant' ? resistBase * 2 : resistBase;
    }
    return base;
  }

  /**
   * Aggregates the whole team's matchup against the opponent's types in one pass:
   * - yesPower: total power feeding the Yes pool — each member's raw power, plus
   *   its tier delta for 'strong' and 'resistant'/'hard-resistant' members (an
   *   advantage grows Yes). 'strong' covers an unresisted offensive advantage
   *   and a defensive immunity (a wall the opponent simply can't touch);
   *   'resistant'/'hard-resistant' is the smaller bonus for a member that nets
   *   a resist with no offensive answer (see `getTierDeltaMagnitude`).
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

      if (tier === 'strong' || tier === 'resistant' || tier === 'hard-resistant') {
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
   * Returns the unique PokemonType values from the team that back an advantage
   * or disadvantage, per the SAME graded tier read `calcTeamMatchupTotals` uses
   * (`getMemberTier`) — not raw per-type super-effectiveness. This keeps the
   * matchup-strip icons in sync with the delta numbers they sit next to:
   *
   * advantageTypes: both of a member's types, if that member's tier is
   *   'strong', 'resistant', or 'hard-resistant' (offense, immunity, or a net
   *   defensive resist that isn't cancelled out).
   *
   * disadvantageTypes: a member's types that are actually weak against some
   *   opponent type, if that member's tier is 'weak' or 'hard-countered'.
   *
   * A 'neutral' member (offense/weakness cancel, or a covered weakness like
   * Dragon/Water vs Ice) contributes to neither — a weakness the team's own
   * typing already covers no longer shows a red icon with no matching delta,
   * and an immune/resistant wall now shows green instead of nothing. The
   * tier (per member) decides which pool a member feeds, but within that
   * member only the type(s) that actually earned the tier are listed — a
   * neutral second type (e.g. Poison on a Grass/Poison member vs Electric)
   * doesn't ride along just because its sibling type resists. Order: type1
   * before type2, team order preserved, deduplicated across the whole team.
   * A type can still appear in both arrays if two different members land on
   * opposite tiers with it. Returns empty arrays when team or opponentTypes
   * is empty.
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
      const tier = this.getMemberTier(member, opponentTypes);
      if (tier === 'neutral') continue;

      const isAdvantage = tier === 'strong' || tier === 'resistant' || tier === 'hard-resistant';
      const target = isAdvantage
        ? { list: advantageTypes, seen: seenAdvantage }
        : { list: disadvantageTypes, seen: seenDisadvantage };

      for (const mt of this.getMemberTypes(member)) {
        const responsible = isAdvantage
          ? opponentTypes.some(ot => this.isStrongAgainst(mt, ot) || this.isImmuneTo(mt, ot) || this.resists(mt, ot))
          : opponentTypes.some(ot => this.isWeakAgainst(mt, ot));
        if (!responsible) continue;

        if (!target.seen.has(mt)) {
          target.list.push(mt);
          target.seen.add(mt);
        }
      }
    }

    return { advantageTypes, disadvantageTypes };
  }
}
