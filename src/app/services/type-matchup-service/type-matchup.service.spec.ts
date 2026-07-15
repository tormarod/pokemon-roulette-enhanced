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

  // ── getMemberDelta: capped at 3, or at the Pokémon's own power if lower ────

  it('caps the delta at the Pokémon\'s own power when power is below the max', () => {
    expect(service.getMemberDelta(makePokemon({ power: 1 }))).toBe(1);
    expect(service.getMemberDelta(makePokemon({ power: 2 }))).toBe(2);
    expect(service.getMemberDelta(makePokemon({ power: 3 }))).toBe(3);
  });

  it('caps the delta at 3 for any power at or above 3', () => {
    expect(service.getMemberDelta(makePokemon({ power: 4 }))).toBe(3);
    expect(service.getMemberDelta(makePokemon({ power: 8 }))).toBe(3);
  });

  it('never depends on team size — only on the Pokémon\'s own power', () => {
    const member = makePokemon({ power: 2 });
    expect(service.getMemberDelta(member)).toBe(service.getMemberDelta(member));
  });

  // ── calcTeamMatchupTotals: yesPower / noBonus / per-side deltas ────────────

  it('adds the capped delta to yesPower for a strong-only member, no noBonus', () => {
    const team = [makePokemon({ power: 5, type1: 'water' })]; // strong vs fire
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(8);        // 5 + min(3,5)=3
    expect(totals.advantageDelta).toBe(3);
    expect(totals.noBonus).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('adds the capped delta to noBonus for a weak-only member, yesPower stays at raw power', () => {
    const team = [makePokemon({ power: 5, type1: 'grass' })]; // weak vs fire
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(5);        // unmodified — the penalty goes to No, not off Yes
    expect(totals.advantageDelta).toBe(0);
    expect(totals.noBonus).toBe(3);         // min(3,5)=3
    expect(totals.disadvantageDelta).toBe(3);
  });

  it('caps a low-power weak member\'s noBonus at its own power', () => {
    const team = [makePokemon({ power: 1, type1: 'grass' })]; // weak vs fire, power 1
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(1);
    expect(totals.noBonus).toBe(1); // min(3,1)=1, not a flat 3
  });

  it('cancels out to neutral when a member is simultaneously strong and weak', () => {
    // bug is strong against grass, and weak against fire — opponent has both types
    const team = [makePokemon({ power: 5, type1: 'bug' })];
    const totals = service.calcTeamMatchupTotals(team, ['grass', 'fire']);
    expect(totals.yesPower).toBe(5);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.noBonus).toBe(0);
  });

  it('sums contributions across the whole team independently of team size', () => {
    const team = [
      makePokemon({ power: 3, type1: 'poison' }),  // strong vs grass: +min(3,3)=3
      makePokemon({ power: 4, type1: 'water' }),   // weak vs grass: noBonus +min(3,4)=3
      makePokemon({ power: 1, type1: 'ground' }),  // weak vs grass: noBonus +min(3,1)=1
      makePokemon({ power: 2, type1: 'normal' }),  // neutral
    ];
    const totals = service.calcTeamMatchupTotals(team, ['grass']);
    expect(totals.yesPower).toBe(3 + 3 + 4 + 1 + 2); // raw sum (3+4+1+2=10) + advantage bonus (3)
    expect(totals.advantageDelta).toBe(3);
    expect(totals.noBonus).toBe(4); // 3 (water) + 1 (ground)
    expect(totals.disadvantageDelta).toBe(4);
  });

  it('a member\'s own contribution is unaffected by adding or removing an unrelated teammate', () => {
    const sandyShocks = makePokemon({ power: 4, type1: 'electric', type2: 'ground' }); // weak vs grass
    const withoutOthers = service.calcTeamMatchupTotals([sandyShocks], ['grass']);
    const withOthers = service.calcTeamMatchupTotals(
      [sandyShocks, makePokemon({ power: 1, type1: 'poison' }), makePokemon({ power: 2, type1: 'ghost', type2: 'poison' })],
      ['grass']
    );
    // Sandy Shocks alone contributes noBonus 3 either way — the presence of teammates never changes it
    expect(withoutOthers.noBonus).toBe(3);
    const sandyShocksOnlyContribution = withOthers.noBonus; // no other weak members in this team
    expect(sandyShocksOnlyContribution).toBe(3);
  });

  it('returns zero totals when opponentTypes is empty', () => {
    const team = [makePokemon({ power: 5, type1: 'water' }), makePokemon({ power: 3, type1: 'grass' })];
    const totals = service.calcTeamMatchupTotals(team, []);
    expect(totals.yesPower).toBe(8); // plain power sum
    expect(totals.noBonus).toBe(0);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('considers a member strong/weak if EITHER of its two types matches', () => {
    const dualType = makePokemon({ power: 4, type1: 'normal', type2: 'water' });
    const totals = service.calcTeamMatchupTotals([dualType], ['fire']); // water is strong vs fire
    expect(totals.yesPower).toBe(7); // 4 + min(3,4)=3
  });

  // ── getMatchupTypes: both advantage AND disadvantage must surface together ──

  it('returns every distinct advantage AND disadvantage type at once for a mixed team', () => {
    const team = [
      makePokemon({ power: 3, type1: 'ground' }),  // strong vs electric
      makePokemon({ power: 3, type1: 'grass' }),   // neutral vs electric
      makePokemon({ power: 3, type1: 'flying' }),  // weak vs electric
    ];
    const { advantageTypes, disadvantageTypes } = service.getMatchupTypes(team, ['electric']);
    expect(advantageTypes).toEqual(['ground']);
    expect(disadvantageTypes).toEqual(['flying']);
  });

  it('collects multiple distinct disadvantage types from different team members', () => {
    const team = [
      makePokemon({ power: 3, type1: 'poison' }),  // weak vs ground
      makePokemon({ power: 3, type1: 'electric' }), // weak vs ground
      makePokemon({ power: 3, type1: 'normal' }),  // neutral vs ground
    ];
    const { disadvantageTypes } = service.getMatchupTypes(team, ['ground']);
    expect(disadvantageTypes.length).toBe(2);
    expect(disadvantageTypes).toContain('poison');
    expect(disadvantageTypes).toContain('electric');
  });
});
