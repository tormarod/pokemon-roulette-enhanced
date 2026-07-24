import { TestBed } from '@angular/core/testing';
import { AbilityContext, AbilityService } from './ability.service';
import { TypeMatchupService } from '../type-matchup-service/type-matchup.service';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { AbilityId } from './abilities-data';

let nextId = 1;

function mon(ability?: AbilityId, overrides: Partial<PokemonItem> = {}): PokemonItem {
  const pokemonId = nextId++;
  return {
    text: `pokemon.${pokemonId}`,
    pokemonId,
    fillStyle: 'green',
    type1: 'normal',
    type2: null,
    sprite: null,
    shiny: false,
    power: 4,
    weight: 1,
    ability,
    ...overrides
  } as PokemonItem;
}

describe('AbilityService', () => {
  let service: AbilityService;
  let typeMatchupService: TypeMatchupService;

  let deltaSpy: jasmine.Spy;

  beforeEach(() => {
    nextId = 1;
    TestBed.configureTestingModule({});
    service = TestBed.inject(AbilityService);
    typeMatchupService = TestBed.inject(TypeMatchupService);
    deltaSpy = spyOn(typeMatchupService, 'getMemberSignedDelta').and.returnValue(0);
  });

  /** Forces the per-member type-matchup delta so each ability's conditional
   * branch can be tested in isolation from the real type chart. */
  function withDelta(delta: number): void {
    deltaSpy.and.returnValue(delta);
  }

  // ── §4a base roster (existing effects) ──────────────────────────────────

  it('intimidate: flat -2 No, regardless of delta', () => {
    withDelta(5);
    expect(service.applyTeamAbilities([mon('intimidate')], ['fire'])).toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
  });

  it('guts: flat +3 Yes', () => {
    expect(service.applyTeamAbilities([mon('guts')], [])).toEqual({ yesBonus: 3, noBonus: 0, extraRetry: false });
  });

  it('static: flat +2 Yes', () => {
    expect(service.applyTeamAbilities([mon('static')], [])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });
  });

  it('swarm: +2 Yes only if delta positive', () => {
    withDelta(3);
    expect(service.applyTeamAbilities([mon('swarm')], ['fire'])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    withDelta(-3);
    expect(service.applyTeamAbilities([mon('swarm')], ['fire'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('sturdy: no odds effect — handled by the faint mechanic instead', () => {
    withDelta(5);
    expect(service.applyTeamAbilities([mon('sturdy')], ['fire'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('levitate: zeroes its own negative delta exactly, no effect otherwise', () => {
    withDelta(-4);
    expect(service.applyTeamAbilities([mon('levitate')], ['ghost'])).toEqual({ yesBonus: 0, noBonus: -4, extraRetry: false });

    withDelta(3);
    expect(service.applyTeamAbilities([mon('levitate')], ['ghost'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('blaze: +3 Yes only if delta positive', () => {
    withDelta(1);
    expect(service.applyTeamAbilities([mon('blaze')], ['grass'])).toEqual({ yesBonus: 3, noBonus: 0, extraRetry: false });

    withDelta(-1);
    expect(service.applyTeamAbilities([mon('blaze')], ['grass'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('multiscale: -3 No only if delta negative', () => {
    withDelta(-1);
    expect(service.applyTeamAbilities([mon('multiscale')], ['fire'])).toEqual({ yesBonus: 0, noBonus: -3, extraRetry: false });

    withDelta(1);
    expect(service.applyTeamAbilities([mon('multiscale')], ['fire'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('synchronize: +1 Yes per teammate sharing a type, own type included', () => {
    const gardevoir = mon('synchronize', { type1: 'psychic', type2: 'fairy' });
    const psychicAlly = mon(undefined, { type1: 'psychic', type2: null });
    const unrelated = mon(undefined, { type1: 'water', type2: null });
    // Shares type with itself and psychicAlly (both psychic) => count 2; unrelated doesn't count.
    expect(service.applyTeamAbilities([gardevoir, psychicAlly, unrelated], []))
      .toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });
  });

  it('serene-grace: grants the free-retry flag, no odds effect', () => {
    expect(service.applyTeamAbilities([mon('serene-grace')], [])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: true });
  });

  it('a Pokemon with no assigned ability contributes nothing', () => {
    expect(service.applyTeamAbilities([mon(undefined)], [])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('multiple abilities on the team stack additively', () => {
    expect(service.applyTeamAbilities([mon('guts'), mon('intimidate')], [])).toEqual({ yesBonus: 3, noBonus: -2, extraRetry: false });
  });

  // ── §4b + §4c new mechanics ─────────────────────────────────────────────

  it('reckless (double-edged): +1 Yes and +1 No', () => {
    expect(service.applyTeamAbilities([mon('reckless')], [])).toEqual({ yesBonus: 1, noBonus: 1, extraRetry: false });
  });

  it('battle-armor (defensive-synergy): -1 No per teammate sharing a type', () => {
    const steelMon = mon('battle-armor', { type1: 'steel', type2: null });
    const steelAlly = mon(undefined, { type1: 'steel', type2: null });
    const unrelated = mon(undefined, { type1: 'water', type2: null });
    // Shares with itself and steelAlly => count 2 => -2 No.
    expect(service.applyTeamAbilities([steelMon, steelAlly, unrelated], []))
      .toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
  });

  it('justified (punish-disadvantage): +2 Yes only when delta negative', () => {
    withDelta(-2);
    expect(service.applyTeamAbilities([mon('justified')], ['psychic'])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    withDelta(2);
    expect(service.applyTeamAbilities([mon('justified')], ['psychic'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });

    // No opponent types => delta forced to 0 => must not fire.
    expect(service.applyTeamAbilities([mon('justified')], [])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('last-stand (low-team-offense): +2 Yes only when team has <= 2 members', () => {
    expect(service.applyTeamAbilities([mon('last-stand'), mon(undefined)], []))
      .toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    expect(service.applyTeamAbilities([mon('last-stand'), mon(undefined), mon(undefined)], []))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('adaptability (neutral-bonus): +1 Yes only on exactly-neutral matchup with opponent types', () => {
    withDelta(0);
    expect(service.applyTeamAbilities([mon('adaptability')], ['normal'])).toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });

    withDelta(3);
    expect(service.applyTeamAbilities([mon('adaptability')], ['normal'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });

    // No opponent types => delta forced to 0, but must NOT fire (guarded).
    expect(service.applyTeamAbilities([mon('adaptability')], [])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('versatile (dual-type-offense): +1 Yes only when dual-typed', () => {
    expect(service.applyTeamAbilities([mon('versatile', { type1: 'fire', type2: 'flying' })], []))
      .toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });
    expect(service.applyTeamAbilities([mon('versatile', { type1: 'fire', type2: null })], []))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('pure-power (mono-type-offense): +1 Yes only when single-typed', () => {
    expect(service.applyTeamAbilities([mon('pure-power', { type1: 'fighting', type2: null })], []))
      .toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });
    expect(service.applyTeamAbilities([mon('pure-power', { type1: 'fighting', type2: 'steel' })], []))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('sheer-force (scale-with-advantage): +delta Yes when advantaged, capped at 4', () => {
    withDelta(2);
    expect(service.applyTeamAbilities([mon('sheer-force')], ['ground'])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    withDelta(5); // capped at value (4)
    expect(service.applyTeamAbilities([mon('sheer-force')], ['ground'])).toEqual({ yesBonus: 4, noBonus: 0, extraRetry: false });

    withDelta(-4); // disadvantage => no effect
    expect(service.applyTeamAbilities([mon('sheer-force')], ['ground'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });

    // No opponent types => delta forced to 0 => must not fire.
    expect(service.applyTeamAbilities([mon('sheer-force')], [])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('comeback (scale-with-disadvantage): +|delta| Yes when disadvantaged, capped at 4', () => {
    withDelta(-2);
    expect(service.applyTeamAbilities([mon('comeback')], ['dark'])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    withDelta(-5); // capped at value (4)
    expect(service.applyTeamAbilities([mon('comeback')], ['dark'])).toEqual({ yesBonus: 4, noBonus: 0, extraRetry: false });

    withDelta(4); // advantage => no effect
    expect(service.applyTeamAbilities([mon('comeback')], ['dark'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  // ── dedup-pass distinct mechanics ────────────────────────────────────────

  it('torrent (rally-outmatched): +1 Yes per team member at a disadvantage', () => {
    withDelta(-1); // both members disadvantaged => +1 * 2
    expect(service.applyTeamAbilities([mon('torrent'), mon(undefined)], ['fire']))
      .toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    withDelta(1); // nobody disadvantaged => no effect
    expect(service.applyTeamAbilities([mon('torrent'), mon(undefined)], ['fire']))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('keen-eye (spot-weakness): +1 Yes per team member at an advantage', () => {
    withDelta(1); // both members advantaged => +1 * 2
    expect(service.applyTeamAbilities([mon('keen-eye'), mon(undefined)], ['fire']))
      .toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    withDelta(-1); // nobody advantaged => no effect
    expect(service.applyTeamAbilities([mon('keen-eye'), mon(undefined)], ['fire']))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('overgrow (grow-with-round): +Yes equal to the round, capped at 3', () => {
    const ctx = (round: number): AbilityContext => ({ round, roundThreat: 0, badOmen: 0 });
    expect(service.applyTeamAbilities([mon('overgrow')], [], ctx(2)))
      .toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });
    expect(service.applyTeamAbilities([mon('overgrow')], [], ctx(9))) // capped at value 3
      .toEqual({ yesBonus: 3, noBonus: 0, extraRetry: false });
    expect(service.applyTeamAbilities([mon('overgrow')], [], ctx(0)))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('rough-skin (blunt-threat): -No, removing up to 2 of the round threat', () => {
    const ctx = (roundThreat: number): AbilityContext => ({ round: 0, roundThreat, badOmen: 0 });
    expect(service.applyTeamAbilities([mon('rough-skin')], [], ctx(1)))
      .toEqual({ yesBonus: 0, noBonus: -1, extraRetry: false });
    expect(service.applyTeamAbilities([mon('rough-skin')], [], ctx(5))) // capped at value 2
      .toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
    expect(service.applyTeamAbilities([mon('rough-skin')], [], ctx(0)))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('poison-point (venom-vs-dual): +2 Yes only against a dual-typed opponent', () => {
    expect(service.applyTeamAbilities([mon('poison-point')], ['fire', 'flying']))
      .toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });
    expect(service.applyTeamAbilities([mon('poison-point')], ['fire']))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('cursed-body (curse-vs-dual): -2 No only against a dual-typed opponent', () => {
    expect(service.applyTeamAbilities([mon('cursed-body')], ['fire', 'flying']))
      .toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
    expect(service.applyTeamAbilities([mon('cursed-body')], ['fire']))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('clear-body (focus-vs-mono): -2 No only against a single-typed opponent', () => {
    expect(service.applyTeamAbilities([mon('clear-body')], ['fire']))
      .toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
    expect(service.applyTeamAbilities([mon('clear-body')], ['fire', 'flying']))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
    // No opponent types => neither mono nor dual => no effect.
    expect(service.applyTeamAbilities([mon('clear-body')], []))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('sand-rush (reckless-rush): +2 Yes and +1 No (asymmetric variance)', () => {
    expect(service.applyTeamAbilities([mon('sand-rush')], []))
      .toEqual({ yesBonus: 2, noBonus: 1, extraRetry: false });
  });

  it('snow-cloak (snow-refuge): -2 No only while the team has <= 2 members', () => {
    expect(service.applyTeamAbilities([mon('snow-cloak'), mon(undefined)], []))
      .toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
    expect(service.applyTeamAbilities([mon('snow-cloak'), mon(undefined), mon(undefined)], []))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('thick-fat (cushion-omen): -No, removing up to 2 of the bad-omen No', () => {
    const ctx = (badOmen: number): AbilityContext => ({ round: 0, roundThreat: 0, badOmen });
    expect(service.applyTeamAbilities([mon('thick-fat')], [], ctx(3))) // capped at value 2
      .toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
    expect(service.applyTeamAbilities([mon('thick-fat')], [], ctx(1)))
      .toEqual({ yesBonus: 0, noBonus: -1, extraRetry: false });
    expect(service.applyTeamAbilities([mon('thick-fat')], [], ctx(0)))
      .toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  // ── lookups ─────────────────────────────────────────────────────────────

  it('getMemberAbility resolves the assigned id, undefined when unset', () => {
    expect(service.getMemberAbility(mon('blaze'))?.effect).toBe('offense-if-positive');
    expect(service.getMemberAbility(mon(undefined))).toBeUndefined();
  });

  it('getAbilityById returns undefined for undefined', () => {
    expect(service.getAbilityById(undefined)).toBeUndefined();
    expect(service.getAbilityById('sturdy')?.effect).toBe('faint-immune-lead');
  });
});
