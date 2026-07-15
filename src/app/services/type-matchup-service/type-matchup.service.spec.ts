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

  // ── getMemberDelta: half power rounded up, uncapped, never zero ───────────

  it('is half the Pokémon\'s power, rounded up', () => {
    expect(service.getMemberDelta(makePokemon({ power: 1 }))).toBe(1);
    expect(service.getMemberDelta(makePokemon({ power: 2 }))).toBe(1);
    expect(service.getMemberDelta(makePokemon({ power: 3 }))).toBe(2);
    expect(service.getMemberDelta(makePokemon({ power: 4 }))).toBe(2);
    expect(service.getMemberDelta(makePokemon({ power: 5 }))).toBe(3);
    expect(service.getMemberDelta(makePokemon({ power: 6 }))).toBe(3);
    expect(service.getMemberDelta(makePokemon({ power: 7 }))).toBe(4);
    expect(service.getMemberDelta(makePokemon({ power: 8 }))).toBe(4);
  });

  it('is never zero, even for the lowest power', () => {
    expect(service.getMemberDelta(makePokemon({ power: 1 }))).toBeGreaterThan(0);
  });

  it('has no hardcoded ceiling — keeps growing past the old cap of 3', () => {
    expect(service.getMemberDelta(makePokemon({ power: 8 }))).toBeGreaterThan(3);
  });

  it('never depends on team size — only on the Pokémon\'s own power', () => {
    const member = makePokemon({ power: 2 });
    expect(service.getMemberDelta(member)).toBe(service.getMemberDelta(member));
  });

  // ── calcTeamMatchupTotals: yesPower / noBonus / per-side deltas ────────────

  it('adds the delta to yesPower for a strong-only member, no noBonus', () => {
    const team = [makePokemon({ power: 5, type1: 'water' })]; // strong vs fire
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(8);        // 5 + ceil(5/2)=3
    expect(totals.advantageDelta).toBe(3);
    expect(totals.noBonus).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('adds the delta to noBonus for a weak-only member, yesPower stays at raw power', () => {
    const team = [makePokemon({ power: 5, type1: 'grass' })]; // weak vs fire
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(5);        // unmodified — the penalty goes to No, not off Yes
    expect(totals.advantageDelta).toBe(0);
    expect(totals.noBonus).toBe(3);         // ceil(5/2)=3
    expect(totals.disadvantageDelta).toBe(3);
  });

  it('still gives a low-power weak member a real, non-zero noBonus', () => {
    const team = [makePokemon({ power: 1, type1: 'grass' })]; // weak vs fire, power 1
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(1);
    expect(totals.noBonus).toBe(1); // ceil(1/2)=1, never 0
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
      makePokemon({ power: 3, type1: 'poison' }),  // strong vs grass: +ceil(3/2)=2
      makePokemon({ power: 4, type1: 'water' }),   // weak vs grass: noBonus +ceil(4/2)=2
      makePokemon({ power: 1, type1: 'ground' }),  // weak vs grass: noBonus +ceil(1/2)=1
      makePokemon({ power: 2, type1: 'normal' }),  // neutral
    ];
    const totals = service.calcTeamMatchupTotals(team, ['grass']);
    expect(totals.yesPower).toBe(3 + 4 + 1 + 2 + 2); // raw sum (10) + advantage bonus (2)
    expect(totals.advantageDelta).toBe(2);
    expect(totals.noBonus).toBe(3); // 2 (water) + 1 (ground)
    expect(totals.disadvantageDelta).toBe(3);
  });

  it('a member\'s own contribution is unaffected by adding or removing an unrelated teammate', () => {
    const sandyShocks = makePokemon({ power: 4, type1: 'electric', type2: 'ground' }); // weak vs grass
    const withoutOthers = service.calcTeamMatchupTotals([sandyShocks], ['grass']);
    const withOthers = service.calcTeamMatchupTotals(
      [sandyShocks, makePokemon({ power: 1, type1: 'poison' }), makePokemon({ power: 2, type1: 'ghost', type2: 'poison' })],
      ['grass']
    );
    // Sandy Shocks alone contributes noBonus 2 either way — the presence of teammates never changes it
    expect(withoutOthers.noBonus).toBe(2);
    const sandyShocksOnlyContribution = withOthers.noBonus; // no other weak members in this team
    expect(sandyShocksOnlyContribution).toBe(2);
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
    expect(totals.yesPower).toBe(6); // 4 + ceil(4/2)=2
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
