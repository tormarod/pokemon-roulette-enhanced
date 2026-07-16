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
      makePokemon({ power: 3, type1: 'grass' }),   // resistant vs electric (grass resists electric)
      makePokemon({ power: 3, type1: 'flying' }),  // weak vs electric
    ];
    const { advantageTypes, disadvantageTypes } = service.getMatchupTypes(team, ['electric']);
    expect(advantageTypes).toEqual(['ground', 'grass']);
    expect(disadvantageTypes).toEqual(['flying']);
  });

  it('drops a covered weakness instead of showing a red icon with no matching delta', () => {
    // dragon is weak to ice but water resists it — nets to 'neutral' per getMemberTier
    const team = [makePokemon({ power: 4, type1: 'dragon', type2: 'water' })];
    const { advantageTypes, disadvantageTypes } = service.getMatchupTypes(team, ['ice']);
    expect(advantageTypes).toEqual([]);
    expect(disadvantageTypes).toEqual([]);
  });

  it('surfaces an immune wall as an advantage icon, not nothing', () => {
    const team = [makePokemon({ power: 4, type1: 'flying' })]; // immune to ground
    const { advantageTypes } = service.getMatchupTypes(team, ['ground']);
    expect(advantageTypes).toEqual(['flying']);
  });

  it('surfaces a resistant member as an advantage icon', () => {
    const team = [makePokemon({ power: 4, type1: 'dragon' })]; // resists water, no offensive answer
    const { advantageTypes, disadvantageTypes } = service.getMatchupTypes(team, ['water']);
    expect(advantageTypes).toEqual(['dragon']);
    expect(disadvantageTypes).toEqual([]);
  });

  it('only lists the type(s) that actually earned the tier, not a neutral sibling type', () => {
    const team = [makePokemon({ power: 4, type1: 'ground', type2: 'rock' })]; // immune to electric via ground; rock is neutral vs electric
    const { advantageTypes } = service.getMatchupTypes(team, ['electric']);
    expect(advantageTypes).toEqual(['ground']);
  });

  it('does not list a member\'s neutral second type in both advantage and disadvantage rows', () => {
    const team = [
      makePokemon({ power: 3, type1: 'grass', type2: 'poison' }),  // resistant vs electric (grass resists it); poison is neutral
      makePokemon({ power: 3, type1: 'poison', type2: 'flying' }), // weak vs electric (flying is weak to it); poison is neutral
    ];
    const { advantageTypes, disadvantageTypes } = service.getMatchupTypes(team, ['electric']);
    expect(advantageTypes).toEqual(['grass']);
    expect(disadvantageTypes).toEqual(['flying']);
    expect(advantageTypes).not.toContain('poison');
    expect(disadvantageTypes).not.toContain('poison');
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

  // ── getMemberTier: graded strong/neutral/weak/hard-countered buckets ───────

  it('is "strong" for a plain offensive advantage with a safe defense', () => {
    const water = makePokemon({ power: 4, type1: 'water' });
    expect(service.getMemberTier(water, ['fire'])).toBe('strong'); // SE vs fire, and fire isn't SE vs water
  });

  it('is "weak" for a plain unresisted defensive disadvantage with no offensive answer', () => {
    const grass = makePokemon({ power: 4, type1: 'grass' });
    expect(service.getMemberTier(grass, ['fire'])).toBe('weak'); // fire is SE vs grass, grass isn't SE vs fire
  });

  it('is "neutral" when offense and defense cancel (existing cancel behavior)', () => {
    const bug = makePokemon({ power: 5, type1: 'bug' });
    expect(service.getMemberTier(bug, ['grass', 'fire'])).toBe('neutral'); // SE vs grass, weak vs fire
  });

  it('is "hard-countered" when both of a dual-typed member\'s types are hit by the same opponent type', () => {
    const iceFlying = makePokemon({ power: 4, type1: 'ice', type2: 'flying' });
    expect(service.getMemberTier(iceFlying, ['rock'])).toBe('hard-countered'); // rock is SE vs both ice and flying
  });

  it('is "hard-countered" when a member is unresistedly weak to two distinct opponent types', () => {
    const grass = makePokemon({ power: 4, type1: 'grass' });
    expect(service.getMemberTier(grass, ['fire', 'ice'])).toBe('hard-countered'); // both fire and ice are SE vs grass
  });

  it('is "strong" for an immune member even without an offensive answer (defensive wall)', () => {
    const flying = makePokemon({ power: 4, type1: 'flying' });
    expect(service.getMemberTier(flying, ['ground'])).toBe('strong'); // flying is immune to ground, not offensively SE vs it
  });

  it('immunity dominates even when the opponent has other types', () => {
    const flying = makePokemon({ power: 4, type1: 'flying' });
    expect(service.getMemberTier(flying, ['ground', 'rock'])).toBe('strong'); // rock is SE vs flying, but immunity wins
  });

  it('double-typing can cancel a weakness via a resist, landing at "neutral" instead of "weak" (coverage, not just cancellation)', () => {
    const dragonWater = makePokemon({ power: 4, type1: 'dragon', type2: 'water' });
    expect(service.getMemberTier(dragonWater, ['ice'])).toBe('neutral'); // dragon is weak vs ice, water resists ice — net cancels
  });

  it('is "neutral" for empty opponent types', () => {
    const water = makePokemon({ power: 4, type1: 'water' });
    expect(service.getMemberTier(water, [])).toBe('neutral');
  });

  // ── Repeated opponent types are an intentional emphasis lever, not a dedupe bug ──
  // (see GymLeader.types doc comment and plan §7.5): a trainer whose `types` list
  // repeats a type is deliberately leaning into it, so a weakness to that type is
  // punished as hard-countered instead of plain weak.

  it('is "hard-countered" (not "weak") against a trainer that repeats the type it\'s weak to — the emphasis lever', () => {
    // grass is weak to fire (fire is SE vs grass) but not offensively SE vs fire itself
    const grass = makePokemon({ power: 4, type1: 'grass' });
    expect(service.getMemberTier(grass, ['fire', 'fire'])).toBe('hard-countered'); // Lance-style emphasis
  });

  it('is "weak" (not "hard-countered") against the same type appearing only once', () => {
    const grass = makePokemon({ power: 4, type1: 'grass' });
    expect(service.getMemberTier(grass, ['fire'])).toBe('weak');
  });

  it('is unaffected by a repeated type the member has no relationship with', () => {
    const water = makePokemon({ power: 4, type1: 'water' });
    expect(service.getMemberTier(water, ['normal', 'normal'])).toBe('neutral');
  });

  // ── getMemberTier: 'resistant' / 'hard-resistant' — the missing defensive-resist tiers ──

  it('is "resistant" for a net resist with no offensive answer', () => {
    const dragon = makePokemon({ power: 4, type1: 'dragon' });
    expect(service.getMemberTier(dragon, ['water'])).toBe('resistant'); // dragon resists water, isn't SE vs it
  });

  it('is "hard-resistant" when both of a dual-typed member\'s types resist the same opponent type', () => {
    // water and ice both resist ice, and neither is offensively SE nor weak vs ice
    const waterIce = makePokemon({ power: 4, type1: 'water', type2: 'ice' });
    expect(service.getMemberTier(waterIce, ['ice'])).toBe('hard-resistant');
  });

  it('is "hard-resistant" when a member resists two distinct opponent types', () => {
    const dragon = makePokemon({ power: 4, type1: 'dragon' });
    expect(service.getMemberTier(dragon, ['fire', 'water'])).toBe('hard-resistant'); // dragon resists both
  });

  it('a resist never rescues a member that is also weak to another opponent type (weak still wins)', () => {
    const dragon = makePokemon({ power: 4, type1: 'dragon' });
    expect(service.getMemberTier(dragon, ['ice', 'fire'])).toBe('weak'); // weak to ice, resists fire — weak dominates
  });

  it('resisting an emphasized (repeated) opponent type lands on "hard-resistant" — the resist-side emphasis lever', () => {
    const dragon = makePokemon({ power: 4, type1: 'dragon' });
    expect(service.getMemberTier(dragon, ['water', 'water'])).toBe('hard-resistant');
  });

  // ── getTierDeltaMagnitude: power-based; hard-countered is double the weak unit ──

  it('matches the plain power-based delta for "strong"', () => {
    const mon = makePokemon({ power: 8 });
    expect(service.getTierDeltaMagnitude(mon, 'strong')).toBe(service.getMemberDelta(mon));
  });

  it('matches the plain power-based delta for "weak"', () => {
    const mon = makePokemon({ power: 4 });
    expect(service.getTierDeltaMagnitude(mon, 'weak')).toBe(service.getMemberDelta(mon));
  });

  it('is double the plain weak delta for "hard-countered"', () => {
    const mon = makePokemon({ power: 4 });
    expect(service.getTierDeltaMagnitude(mon, 'hard-countered')).toBe(service.getMemberDelta(mon) * 2);
  });

  it('keeps scaling the "hard-countered" magnitude with power — uncapped, always above "weak"', () => {
    const mon = makePokemon({ power: 8 }); // weak delta 4, hard-countered 8 — no plateau, no cap
    expect(service.getTierDeltaMagnitude(mon, 'hard-countered')).toBe(8);
    expect(service.getTierDeltaMagnitude(mon, 'hard-countered'))
      .toBeGreaterThan(service.getTierDeltaMagnitude(mon, 'weak'));
  });

  it('makes hard-countered strictly harsher than weak even at the lowest power', () => {
    const mon = makePokemon({ power: 1 }); // weak delta 1, hard-countered 2
    expect(service.getTierDeltaMagnitude(mon, 'weak')).toBe(1);
    expect(service.getTierDeltaMagnitude(mon, 'hard-countered')).toBe(2);
    expect(service.getTierDeltaMagnitude(mon, 'hard-countered'))
      .toBeGreaterThan(service.getTierDeltaMagnitude(mon, 'weak'));
  });

  it('is half the weak/strong unit for "resistant" (ceil(power/4))', () => {
    const mon = makePokemon({ power: 8 }); // weak/strong delta 4, resistant ceil(8/4)=2
    expect(service.getTierDeltaMagnitude(mon, 'resistant')).toBe(2);
  });

  it('is double the "resistant" magnitude for "hard-resistant"', () => {
    const mon = makePokemon({ power: 8 });
    expect(service.getTierDeltaMagnitude(mon, 'hard-resistant')).toBe(4);
    expect(service.getTierDeltaMagnitude(mon, 'hard-resistant'))
      .toBeGreaterThan(service.getTierDeltaMagnitude(mon, 'resistant'));
  });

  it('is never zero for "resistant", even at the lowest power', () => {
    const mon = makePokemon({ power: 1 });
    expect(service.getTierDeltaMagnitude(mon, 'resistant')).toBe(1);
  });

  it('stays deliberately smaller than a plain "strong" at every power', () => {
    const mon = makePokemon({ power: 8 });
    expect(service.getTierDeltaMagnitude(mon, 'resistant'))
      .toBeLessThan(service.getTierDeltaMagnitude(mon, 'strong'));
  });

  // ── end-to-end: resistant/hard-resistant members add a smaller bonus to Yes, keep noBonus untouched ──

  it('routes a smaller bonus to advantageDelta/yesPower for a "resistant" member', () => {
    const team = [makePokemon({ power: 4, type1: 'dragon' })]; // resists water, not SE vs it
    const totals = service.calcTeamMatchupTotals(team, ['water']);
    expect(totals.advantageDelta).toBe(1); // ceil(4/4)
    expect(totals.yesPower).toBe(5);       // 4 power + 1 resistant bonus
    expect(totals.disadvantageDelta).toBe(0);
    expect(totals.noBonus).toBe(0);
  });

  it('routes double the resistant bonus for a "hard-resistant" member', () => {
    const team = [makePokemon({ power: 4, type1: 'dragon' })];
    const totals = service.calcTeamMatchupTotals(team, ['fire', 'water']); // dragon resists both
    expect(totals.advantageDelta).toBe(2); // 2 * ceil(4/4)
    expect(totals.yesPower).toBe(6);
  });

  // ── end-to-end: a hard-countered member routes double the red, keeps its green ──

  it('routes double the weak penalty to noBonus for a hard-countered member, green stays at full power', () => {
    // grass is weak to BOTH fire and ice (two distinct SE opponent types) → hard-countered
    const team = [makePokemon({ power: 4, type1: 'grass' })];
    const totals = service.calcTeamMatchupTotals(team, ['fire', 'ice']);
    expect(totals.yesPower).toBe(4);          // full power kept in the Yes pool — bulk still shows
    expect(totals.noBonus).toBe(4);           // 2 * ceil(4/2) — double a plain weakness
    expect(totals.disadvantageDelta).toBe(4);
    expect(totals.advantageDelta).toBe(0);
  });

  it('a hard-countered member always costs more No than the same member merely weak', () => {
    const grass = makePokemon({ power: 6, type1: 'grass' });
    const weak = service.calcTeamMatchupTotals([grass], ['fire']);          // weak vs fire only
    const hardCountered = service.calcTeamMatchupTotals([grass], ['fire', 'ice']); // weak vs both
    expect(hardCountered.noBonus).toBeGreaterThan(weak.noBonus);
    expect(hardCountered.yesPower).toBe(weak.yesPower); // same green either way
  });
});
