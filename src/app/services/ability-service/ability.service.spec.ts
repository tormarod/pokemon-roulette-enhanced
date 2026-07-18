import { TestBed } from '@angular/core/testing';
import { AbilityService } from './ability.service';
import { TypeMatchupService } from '../type-matchup-service/type-matchup.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

function mon(pokemonId: number, power: PokemonItem['power'] = 4): PokemonItem {
  return {
    text: `pokemon.${pokemonId}`,
    pokemonId,
    fillStyle: 'green',
    type1: 'normal',
    type2: null,
    sprite: null,
    shiny: false,
    power,
    weight: 1
  } as PokemonItem;
}

describe('AbilityService', () => {
  let service: AbilityService;
  let typeMatchupService: TypeMatchupService;

  let deltaSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AbilityService);
    typeMatchupService = TestBed.inject(TypeMatchupService);
    deltaSpy = spyOn(typeMatchupService, 'getMemberSignedDelta');
  });

  /** Stubs the underlying per-member type-matchup delta so each ability's
   * conditional branch can be tested in isolation from the real type chart.
   * Safe to call more than once per test — reassigns the fake instead of re-spying. */
  function withDelta(deltaByPokemonId: Record<number, number>): void {
    deltaSpy.and.callFake((member: PokemonItem) => deltaByPokemonId[member.pokemonId] ?? 0);
  }

  it('Thick Fat (Snorlax): flat -1 No, regardless of delta', () => {
    withDelta({ 143: 5 });
    expect(service.applyTeamAbilities([mon(143)], ['fire'])).toEqual({ yesBonus: 0, noBonus: -1, extraRetry: false });
  });

  it('No Guard (Machamp): flat +1 Yes', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(68)], [])).toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });
  });

  it('Keen Eye (Staraptor): flat -1 No', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(398)], [])).toEqual({ yesBonus: 0, noBonus: -1, extraRetry: false });
  });

  it('Poison Point (Nidoking): flat +1 Yes', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(34)], [])).toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });
  });

  it('Rough Skin (Garchomp): +1 Yes only if delta positive', () => {
    withDelta({ 445: 3 });
    expect(service.applyTeamAbilities([mon(445)], ['fire'])).toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });

    withDelta({ 445: -3 });
    expect(service.applyTeamAbilities([mon(445)], ['fire'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('Sturdy (Golem): no odds effect — handled by the faint mechanic instead', () => {
    withDelta({ 76: 5 });
    expect(service.applyTeamAbilities([mon(76)], ['fire'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('Swarm (Scizor): +1 Yes only if delta positive', () => {
    withDelta({ 212: 2 });
    expect(service.applyTeamAbilities([mon(212)], ['grass'])).toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });
  });

  it('Levitate (Gengar): zeroes its own negative delta exactly, no effect otherwise', () => {
    withDelta({ 94: -4 });
    expect(service.applyTeamAbilities([mon(94)], ['ghost'])).toEqual({ yesBonus: 0, noBonus: -4, extraRetry: false });

    withDelta({ 94: 3 });
    expect(service.applyTeamAbilities([mon(94)], ['ghost'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('Clear Body (Metagross): flat -1 No', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(376)], [])).toEqual({ yesBonus: 0, noBonus: -1, extraRetry: false });
  });

  it('Blaze (Charizard): +2 Yes only if delta positive', () => {
    withDelta({ 6: 1 });
    expect(service.applyTeamAbilities([mon(6)], ['grass'])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });

    withDelta({ 6: -1 });
    expect(service.applyTeamAbilities([mon(6)], ['grass'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('Torrent (Blastoise): -2 No only if delta negative', () => {
    withDelta({ 9: -1 });
    expect(service.applyTeamAbilities([mon(9)], ['fire'])).toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });

    withDelta({ 9: 1 });
    expect(service.applyTeamAbilities([mon(9)], ['fire'])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('Overgrow (Venusaur): +2 Yes only if delta positive', () => {
    withDelta({ 3: 1 });
    expect(service.applyTeamAbilities([mon(3)], ['water'])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });
  });

  it('Static (Zapdos): flat +1 Yes', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(145)], [])).toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });
  });

  it('Synchronize (Gardevoir): +1 Yes per teammate sharing a type, own type included', () => {
    withDelta({});
    const gardevoir = { ...mon(282), type1: 'psychic', type2: 'fairy' } as PokemonItem;
    const psychicAlly = { ...mon(1), type1: 'psychic', type2: null } as PokemonItem;
    const unrelated = { ...mon(2), type1: 'water', type2: null } as PokemonItem;
    // Shares type with itself and psychicAlly (both have psychic) => count 2, unrelated doesn't count.
    expect(service.applyTeamAbilities([gardevoir, psychicAlly, unrelated], []))
      .toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });
  });

  it('Snow Cloak (Glaceon): flat -1 No', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(471)], [])).toEqual({ yesBonus: 0, noBonus: -1, extraRetry: false });
  });

  it('Multiscale (Dragonite): -2 No only if delta negative', () => {
    withDelta({ 149: -1 });
    expect(service.applyTeamAbilities([mon(149)], ['ice'])).toEqual({ yesBonus: 0, noBonus: -2, extraRetry: false });
  });

  it('Intimidate (Mightyena): flat +1 Yes', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(262)], [])).toEqual({ yesBonus: 1, noBonus: 0, extraRetry: false });
  });

  it('Serene Grace (Togekiss): grants the free-retry flag, no odds effect', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(468)], [])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: true });
  });

  it('a Pokemon with no curated ability contributes nothing', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(999)], [])).toEqual({ yesBonus: 0, noBonus: 0, extraRetry: false });
  });

  it('multiple abilities on the team stack additively', () => {
    withDelta({});
    expect(service.applyTeamAbilities([mon(68), mon(262)], [])).toEqual({ yesBonus: 2, noBonus: 0, extraRetry: false });
  });
});
