import { TestBed } from '@angular/core/testing';
import { BattleOddsService } from './battle-odds.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

describe('BattleOddsService', () => {
  let service: BattleOddsService;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.test',
    fillStyle: 'green',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BattleOddsService);
  });

  it('produces 1 yes and baseNoCount+round*threatMult no tickets for an empty, untyped team', () => {
    const odds = service.computeOdds({
      team: [], opponentTypes: [], baseNoCount: 2, currentRound: 3, abilitiesActive: false,
    });
    expect(odds.yesTickets).toBe(1);
    expect(odds.noTickets).toBe(7); // 2 + ceil(3*1.5)
  });

  it('boosts yes by the net-score-scaled unit for a mutual-advantage matchup', () => {
    const team = [makeTestPokemon({ power: 2, type1: 'water' })]; // SE vs fire AND resists fire: netScore=2
    const odds = service.computeOdds({
      team, opponentTypes: ['fire'], baseNoCount: 1, currentRound: 0, abilitiesActive: false,
    });
    expect(odds.yesTickets).toBe(5); // base(1) + yesPower(2+2)
    expect(odds.noTickets).toBe(1);
    expect(odds.yes.typeAdvantage).toBe(2);
    expect(odds.no.typeDisadvantage).toBe(0);
  });

  it('adds extra No tickets (not fewer Yes) for a mutual-disadvantage matchup', () => {
    const team = [makeTestPokemon({ power: 2, type1: 'grass' })]; // weak vs fire: netScore=-2
    const odds = service.computeOdds({
      team, opponentTypes: ['fire'], baseNoCount: 1, currentRound: 0, abilitiesActive: false,
    });
    expect(odds.yesTickets).toBe(3); // base(1) + power(2)
    expect(odds.noTickets).toBe(3); // base(1) + noBonus(2)
    expect(odds.no.typeDisadvantage).toBe(2);
  });

  it('doubles the advantage for a lead with a favorable matchup', () => {
    const team = [makeTestPokemon({ power: 2, type1: 'water' })];
    const odds = service.computeOdds({
      team, opponentTypes: ['fire'], baseNoCount: 1, currentRound: 0, leadIndex: 0, abilitiesActive: false,
    });
    expect(odds.yesTickets).toBe(7); // base(1) + yesPower(4) + leadAdvantageDelta(2)
    expect(odds.yes.typeAdvantage).toBe(4);
    expect(odds.no.typeDisadvantage).toBe(0);
  });

  it('doubles the disadvantage (extra No tickets) for a lead with an unfavorable matchup', () => {
    const team = [makeTestPokemon({ power: 2, type1: 'grass' })];
    const odds = service.computeOdds({
      team, opponentTypes: ['fire'], baseNoCount: 1, currentRound: 0, leadIndex: 0, abilitiesActive: false,
    });
    expect(odds.yesTickets).toBe(3);
    expect(odds.noTickets).toBe(5); // base(1) + noBonus(2) + leadDisadvantageDelta(2)
    expect(odds.no.typeDisadvantage).toBe(4);
    expect(odds.yes.typeAdvantage).toBe(0);
  });

  it('adds the pending battle debuff (badOmen) to the No tickets', () => {
    const odds = service.computeOdds({
      team: [], opponentTypes: [], baseNoCount: 1, currentRound: 0, badOmen: 2, abilitiesActive: false,
    });
    expect(odds.noTickets).toBe(3); // base(1) + debuff(2)
    expect(odds.no.badOmen).toBe(2);
  });

  it('applies the x-attack power bonus on top of the type-adjusted yes power', () => {
    const team = [makeTestPokemon({ power: 4 })];
    const odds = service.computeOdds({
      team, opponentTypes: [], baseNoCount: 1, currentRound: 0, xAttackBonus: 4, abilitiesActive: false,
    });
    expect(odds.yesTickets).toBe(9); // base(1) + power(4) + xAttack(4)
    expect(odds.yes.xAttack).toBe(4);
  });

  it('xAttackBonus() returns 0 for an empty team', () => {
    expect(service.xAttackBonus([], 5)).toBe(0);
  });

  it('xAttackBonus() returns just the mean power at round 0', () => {
    const team = [makeTestPokemon({ power: 4 }), makeTestPokemon({ power: 4 })];
    expect(service.xAttackBonus(team, 0)).toBe(4);
  });

  it('xAttackBonus() adds the round on top of the mean power', () => {
    const team = [makeTestPokemon({ power: 4 }), makeTestPokemon({ power: 4 })];
    expect(service.xAttackBonus(team, 5)).toBe(9); // mean(4) + round(5)
  });

  it('folds an active ability effect into a distinct ability field, separate from typeDisadvantage', () => {
    const team = [makeTestPokemon({ power: 4, type1: 'grass', ability: 'torrent' })]; // weak vs fire, torrent: soak-if-negative -2
    const odds = service.computeOdds({
      team, opponentTypes: ['fire'], baseNoCount: 1, currentRound: 0, abilitiesActive: true,
    });
    expect(odds.no.ability).toBe(-2);
    expect(odds.no.typeDisadvantage).toBe(2); // netScore(2) * unit(ceil(4/4)=1), unaffected by the ability
  });

  it('ignores ability effects when abilitiesActive is false (Classic mode)', () => {
    const team = [makeTestPokemon({ power: 4, type1: 'grass', ability: 'torrent' })];
    const odds = service.computeOdds({
      team, opponentTypes: ['fire'], baseNoCount: 1, currentRound: 0, abilitiesActive: false,
    });
    expect(odds.no.ability).toBe(0);
    expect(odds.extraRetry).toBe(false);
  });

  it('computes winChance as yesTickets / (yesTickets + noTickets)', () => {
    const odds = service.computeOdds({
      team: [], opponentTypes: [], baseNoCount: 3, currentRound: 12, abilitiesActive: false,
    });
    // yesTickets=1, roundThreat=ceil(12*1.5)=18, noTickets=max(3, 3+18)=21
    expect(odds.yesTickets).toBe(1);
    expect(odds.noTickets).toBe(21);
    expect(odds.winChance).toBeCloseTo(1 / 22, 5);
  });

  it('marks floored true only when Math.max(baseNoCount, raw) actually clamps upward', () => {
    const team = [makeTestPokemon({ power: 2, type1: 'water' })]; // strong matchup, no negative contributions
    const odds = service.computeOdds({
      team, opponentTypes: ['fire'], baseNoCount: 5, currentRound: 0, abilitiesActive: false,
    });
    expect(odds.no.floored).toBe(false);
    expect(odds.noTickets).toBe(5);
  });
});
