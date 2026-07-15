import { TestBed } from '@angular/core/testing';
import { TypeMatchupService } from './type-matchup.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

describe('TypeMatchupService', () => {
  let service: TypeMatchupService;

  const makePokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.test',
    fillStyle: 'green',
    sprite: null,
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TypeMatchupService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ── isStrongAgainst / isWeakAgainst ────────────────────────────────────────

  it('isStrongAgainst returns true when the type chart says so', () => {
    expect(service.isStrongAgainst('water', 'fire')).toBeTrue();
    expect(service.isStrongAgainst('fire', 'water')).toBeFalse();
  });

  it('isWeakAgainst returns true when the opponent type is strong against mine', () => {
    expect(service.isWeakAgainst('grass', 'fire')).toBeTrue();
    expect(service.isWeakAgainst('water', 'fire')).toBeFalse();
  });

  // ── getMemberEffectivePower: the capped additive delta ─────────────────────

  it('returns unchanged power for a neutral matchup', () => {
    const member = makePokemon({ power: 5, type1: 'normal' });
    expect(service.getMemberEffectivePower(member, ['rock'], 6)).toBe(5);
  });

  it('adds the full delta (2) for a strong matchup on a full 5-6 member team', () => {
    const member = makePokemon({ power: 5, type1: 'water' });
    expect(service.getMemberEffectivePower(member, ['fire'], 6)).toBe(7);
  });

  it('subtracts the full delta (2) for a weak matchup on a full 5-6 member team', () => {
    const member = makePokemon({ power: 5, type1: 'grass' });
    expect(service.getMemberEffectivePower(member, ['fire'], 6)).toBe(3);
  });

  it('cancels out to neutral when a member is simultaneously strong and weak', () => {
    // bug is strong against grass, and weak against fire — opponent has both types
    const member = makePokemon({ power: 5, type1: 'bug' });
    expect(service.getMemberEffectivePower(member, ['grass', 'fire'], 6)).toBe(5);
  });

  it('floors effective power at 1 — a bad matchup never goes below "as if neutral at the bottom"', () => {
    const member = makePokemon({ power: 1, type1: 'grass' });
    expect(service.getMemberEffectivePower(member, ['fire'], 6)).toBe(1);
  });

  it('scales the delta down for small teams (size <= 2 -> delta 1)', () => {
    const strongMember = makePokemon({ power: 2, type1: 'water' });
    expect(service.getMemberEffectivePower(strongMember, ['fire'], 1)).toBe(3);
    expect(service.getMemberEffectivePower(strongMember, ['fire'], 2)).toBe(3);
  });

  it('uses the medium delta (1.5) for teams of size 3-4', () => {
    const strongMember = makePokemon({ power: 4, type1: 'water' });
    expect(service.getMemberEffectivePower(strongMember, ['fire'], 3)).toBe(5.5);
    expect(service.getMemberEffectivePower(strongMember, ['fire'], 4)).toBe(5.5);
  });

  it('considers a member strong/weak if EITHER of its two types matches', () => {
    const dualType = makePokemon({ power: 4, type1: 'normal', type2: 'water' });
    expect(service.getMemberEffectivePower(dualType, ['fire'], 6)).toBe(6); // water is strong vs fire
  });

  // ── calcTeamEffectivePower: sums the whole team ─────────────────────────────

  it('sums effective power across the whole team', () => {
    const team = [
      makePokemon({ power: 5, type1: 'water' }),  // strong vs fire: 5+2=7
      makePokemon({ power: 3, type1: 'grass' }),  // weak vs fire: 3-2=1
      makePokemon({ power: 4, type1: 'normal' }), // neutral: 4
    ];
    expect(service.calcTeamEffectivePower(team, ['fire'])).toBe(12);
  });

  it('returns the plain power sum when opponentTypes is empty', () => {
    const team = [makePokemon({ power: 5, type1: 'water' }), makePokemon({ power: 3, type1: 'grass' })];
    expect(service.calcTeamEffectivePower(team, [])).toBe(8);
  });
});
