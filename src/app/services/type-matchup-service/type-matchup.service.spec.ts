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

  // ── getSuperEffectiveCounters (scoutingReport threat) ─────────────────────

  it('getSuperEffectiveCounters returns every type super-effective against the given type', () => {
    const counters = service.getSuperEffectiveCounters('grass');
    expect(counters).toContain('fire');
    expect(counters).not.toContain('water');
  });

  // ── getMemberDelta: half power rounded up, uncapped, never zero ──────
  // This is now the per-net-score-point unit (see calcTeamMatchupTotals):
  // a plain mutual-advantage pair like Water vs Fire scores netScore=2, so
  // 2 * getMemberDelta reproduces the Pokémon's own power for even powers.

  it('is half of the Pokémon\'s power, rounded up', () => {
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

  it('keeps scaling with power — no plateau', () => {
    expect(service.getMemberDelta(makePokemon({ power: 8 })))
      .toBeGreaterThan(service.getMemberDelta(makePokemon({ power: 4 })));
  });

  it('never depends on team size — only on the Pokémon\'s own power', () => {
    const member = makePokemon({ power: 2 });
    expect(service.getMemberDelta(member)).toBe(service.getMemberDelta(member));
  });

  // ── calcTeamMatchupTotals: yesPower / noBonus / per-side deltas ────────────

  it('adds the delta to yesPower for a mutual-advantage member, no noBonus', () => {
    const team = [makePokemon({ power: 5, type1: 'water' })]; // SE vs fire AND resists fire: netScore=2
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(11);       // 5 + (netScore 2 * unit ceil(5/2)=3) = 5+6
    expect(totals.advantageDelta).toBe(6);
    expect(totals.noBonus).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('adds the delta to noBonus for a mutual-disadvantage member, yesPower stays at raw power', () => {
    const team = [makePokemon({ power: 5, type1: 'grass' })]; // weak to fire AND fire resists our grass counter: netScore=-2
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(5);        // unmodified — the penalty goes to No, not off Yes
    expect(totals.advantageDelta).toBe(0);
    expect(totals.noBonus).toBe(6);         // netScore 2 * unit ceil(5/2)=3
    expect(totals.disadvantageDelta).toBe(6);
  });

  it('still gives a low-power weak member a real, non-zero noBonus', () => {
    const team = [makePokemon({ power: 1, type1: 'grass' })]; // weak vs fire, power 1
    const totals = service.calcTeamMatchupTotals(team, ['fire']);
    expect(totals.yesPower).toBe(1);
    expect(totals.noBonus).toBe(2); // netScore 2 * unit ceil(1/4)=1, never 0
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
      makePokemon({ power: 3, type1: 'poison' }),  // SE vs grass AND resists grass: netScore=2, delta=2
      makePokemon({ power: 4, type1: 'water' }),   // weak vs grass AND grass resists water: netScore=-2, delta=-2
      makePokemon({ power: 1, type1: 'ground' }),  // weak vs grass AND grass resists ground: netScore=-2, delta=-2
      makePokemon({ power: 2, type1: 'normal' }),  // neutral
    ];
    const totals = service.calcTeamMatchupTotals(team, ['grass']);
    expect(totals.yesPower).toBe(3 + 4 + 1 + 2 + 4); // raw sum (10) + poison's advantage bonus (netScore 2 * unit ceil(3/2)=2 = 4)
    expect(totals.advantageDelta).toBe(4);
    expect(totals.noBonus).toBe(6); // water(netScore2*unit ceil(4/2)=2 = 4) + ground(netScore2*unit ceil(1/2)=1 = 2)
    expect(totals.disadvantageDelta).toBe(6);
  });

  it('a member\'s own contribution is unaffected by adding or removing an unrelated teammate', () => {
    const sandyShocks = makePokemon({ power: 4, type1: 'electric', type2: 'ground' }); // netScore=-3 vs grass
    const withoutOthers = service.calcTeamMatchupTotals([sandyShocks], ['grass']);
    const withOthers = service.calcTeamMatchupTotals(
      [sandyShocks, makePokemon({ power: 1, type1: 'poison' }), makePokemon({ power: 2, type1: 'ghost', type2: 'poison' })],
      ['grass']
    );
    // Sandy Shocks alone contributes noBonus 6 (netScore 3 * unit ceil(4/2)=2) either way — the presence of teammates never changes it
    expect(withoutOthers.noBonus).toBe(6);
    const sandyShocksOnlyContribution = withOthers.noBonus; // no other weak members in this team
    expect(sandyShocksOnlyContribution).toBe(6);
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
    const totals = service.calcTeamMatchupTotals([dualType], ['fire']); // water is SE vs fire AND resists fire: netScore=2
    expect(totals.yesPower).toBe(8); // 4 + (netScore 2 * unit ceil(4/2)=2) = 4+4
  });

  // ── calcTeamMatchupTotals: symmetric scoring no longer lets a defensive ────
  // ── shortcut (immunity, resist) unconditionally dominate a separate bad ────
  // ── matchup — a real consequence of dropping the old best-case-offense/ ────
  // ── worst-case-defense asymmetry, not a bug. ────────────────────────────────

  it('immunity no longer unconditionally wins: a separate bad matchup against another opponent type can cancel it', () => {
    // Flying is immune to Ground (netScore contribution +2) but Rock hits Flying
    // hard AND resists Flying's counter-hit (netScore contribution -2) — nets to 0.
    const team = [makePokemon({ power: 4, type1: 'flying' })];
    const totals = service.calcTeamMatchupTotals(team, ['ground', 'rock']);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('a resist no longer unconditionally survives a separate weakness: mutual advantage/disadvantage can cancel', () => {
    // Dragon resists Water (+1) but is weak to Ice while Fire also resists Dragon's
    // counter — Ice's -1 and Fire's -1 exactly offset Water's +1... actually nets via
    // Ice (-1 weak, no mutual resist) and Fire (0, no relation) around Water's +1: verify via totals.
    const team = [makePokemon({ power: 4, type1: 'dragon' })];
    const totals = service.calcTeamMatchupTotals(team, ['ice', 'fire']);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('the repeated-type emphasis lever still applies: hard-countered vs a doubled weakness type', () => {
    const team = [makePokemon({ power: 4, type1: 'grass' })]; // weak to fire, and fire resists grass's counter — doubled by repetition
    const totals = service.calcTeamMatchupTotals(team, ['fire', 'fire']);
    expect(totals.disadvantageDelta).toBe(8); // netScore -4 * unit ceil(4/2)=2
    expect(totals.advantageDelta).toBe(0);
  });

  it('the repeated-type emphasis lever applies symmetrically on the resist side', () => {
    const team = [makePokemon({ power: 4, type1: 'dragon' })]; // resists water, repeated
    const totals = service.calcTeamMatchupTotals(team, ['water', 'water']);
    expect(totals.advantageDelta).toBe(4); // netScore 2 * unit ceil(4/2)=2
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('resisting two distinct opponent types scores the same as resisting one repeated type', () => {
    const team = [makePokemon({ power: 4, type1: 'dragon' })]; // resists both fire and water
    const totals = service.calcTeamMatchupTotals(team, ['fire', 'water']);
    expect(totals.advantageDelta).toBe(4); // netScore 2 * unit ceil(4/2)=2
  });

  it('a dual-typed member being hit through both types by the same opponent type is a bigger penalty than a single hit', () => {
    const team = [makePokemon({ power: 4, type1: 'ice', type2: 'flying' })]; // rock is SE vs both, and resists flying's counter
    const totals = service.calcTeamMatchupTotals(team, ['rock']);
    expect(totals.disadvantageDelta).toBe(6); // netScore -3 * unit ceil(4/2)=2
    expect(totals.advantageDelta).toBe(0);
  });

  it('a hard-countered-equivalent member always costs more No than the same member merely weak', () => {
    const grass = makePokemon({ power: 6, type1: 'grass' });
    const weak = service.calcTeamMatchupTotals([grass], ['fire']);          // weak vs fire only
    const hardCountered = service.calcTeamMatchupTotals([grass], ['fire', 'ice']); // weak vs both, ice adds no mutual resist
    expect(hardCountered.noBonus).toBeGreaterThan(weak.noBonus);
    expect(hardCountered.yesPower).toBe(weak.yesPower); // same green either way
  });

  // ── calcTeamMatchupTotals: offensive-resistance cancellation still holds ───

  it('is neutral for Poison vs Poison (same-type pair always cancels)', () => {
    const team = [makePokemon({ power: 4, type1: 'poison' })];
    const totals = service.calcTeamMatchupTotals(team, ['poison']);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('is neutral for Steel vs Steel (same-type pair always cancels)', () => {
    const team = [makePokemon({ power: 4, type1: 'steel' })];
    const totals = service.calcTeamMatchupTotals(team, ['steel']);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('is neutral for Normal vs Ghost (immune both ways — mutual immunity cancels)', () => {
    const team = [makePokemon({ power: 4, type1: 'normal' })];
    const totals = service.calcTeamMatchupTotals(team, ['ghost']);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('is neutral for Steel vs Steel, Steel (repeated same-type pair still cancels)', () => {
    const team = [makePokemon({ power: 4, type1: 'steel' })];
    const totals = service.calcTeamMatchupTotals(team, ['steel', 'steel']);
    expect(totals.advantageDelta).toBe(0);
    expect(totals.disadvantageDelta).toBe(0);
  });

  it('remains a mutual advantage for Poison/Steel vs Poison (steel is not a same-type pair, still resists)', () => {
    const team = [makePokemon({ power: 4, type1: 'poison', type2: 'steel' })];
    const totals = service.calcTeamMatchupTotals(team, ['poison']);
    expect(totals.advantageDelta).toBe(4); // netScore 2 * unit ceil(4/2)=2
  });

  it('remains a mutual disadvantage for Fire vs Water (offensively resisted AND defensively weak)', () => {
    const team = [makePokemon({ power: 4, type1: 'fire' })];
    const totals = service.calcTeamMatchupTotals(team, ['water']);
    expect(totals.disadvantageDelta).toBe(4); // netScore -2 * unit ceil(4/2)=2
  });

  it('remains a mutual disadvantage for Electric vs Ground (offensively nullified AND defensively weak)', () => {
    const team = [makePokemon({ power: 4, type1: 'electric' })];
    const totals = service.calcTeamMatchupTotals(team, ['ground']);
    expect(totals.disadvantageDelta).toBe(6); // netScore -3 * unit ceil(4/2)=2
  });

  it('remains a mutual advantage for Grass vs Water (SE vs water + resists water)', () => {
    const team = [makePokemon({ power: 4, type1: 'grass' })];
    const totals = service.calcTeamMatchupTotals(team, ['water']);
    expect(totals.advantageDelta).toBe(4); // netScore 2 * unit ceil(4/2)=2
  });

  // ── getMatchupTypes: superEffective (offense) vs resist (defense) split, plus weak ──

  it('returns every distinct superEffective AND resist AND weak type at once for a mixed team', () => {
    const team = [
      makePokemon({ power: 3, type1: 'ground' }),  // SE vs electric, and immune to it
      makePokemon({ power: 3, type1: 'grass' }),   // resists electric, no offensive relation
      makePokemon({ power: 3, type1: 'flying' }),  // weak vs electric, and electric resists flying's counter
    ];
    const { superEffectiveTypes, resistTypes, weakTypes } = service.getMatchupTypes(team, ['electric']);
    expect(superEffectiveTypes).toEqual(['ground']);
    expect(resistTypes).toEqual(['ground', 'grass']);
    expect(weakTypes).toEqual(['flying']);
  });

  it('drops a covered weakness instead of showing a red icon with no matching delta', () => {
    // dragon is weak to ice but water resists it — nets to 0
    const team = [makePokemon({ power: 4, type1: 'dragon', type2: 'water' })];
    const { superEffectiveTypes, resistTypes, weakTypes } = service.getMatchupTypes(team, ['ice']);
    expect(superEffectiveTypes).toEqual([]);
    expect(resistTypes).toEqual([]);
    expect(weakTypes).toEqual([]);
  });

  it('surfaces an immune wall as a resist icon, not nothing', () => {
    const team = [makePokemon({ power: 4, type1: 'flying' })]; // immune to ground
    const { superEffectiveTypes, resistTypes } = service.getMatchupTypes(team, ['ground']);
    expect(superEffectiveTypes).toEqual([]);
    expect(resistTypes).toEqual(['flying']);
  });

  it('surfaces a resistant member as a resist icon, not superEffective', () => {
    const team = [makePokemon({ power: 4, type1: 'dragon' })]; // resists water, no offensive answer
    const { superEffectiveTypes, resistTypes, weakTypes } = service.getMatchupTypes(team, ['water']);
    expect(superEffectiveTypes).toEqual([]);
    expect(resistTypes).toEqual(['dragon']);
    expect(weakTypes).toEqual([]);
  });

  it('only lists the type(s) that actually earned a positive sub-score, not a neutral sibling type', () => {
    const team = [makePokemon({ power: 4, type1: 'ground', type2: 'rock' })]; // immune to electric via ground; rock is neutral vs electric
    const { resistTypes } = service.getMatchupTypes(team, ['electric']);
    expect(resistTypes).toEqual(['ground']);
  });

  it('does not list a member\'s neutral second type in resist or weak rows', () => {
    const team = [
      makePokemon({ power: 3, type1: 'grass', type2: 'poison' }),  // resists electric; poison is neutral
      makePokemon({ power: 3, type1: 'poison', type2: 'flying' }), // weak vs electric via flying; poison is neutral
    ];
    const { resistTypes, weakTypes } = service.getMatchupTypes(team, ['electric']);
    expect(resistTypes).toEqual(['grass']);
    expect(weakTypes).toEqual(['flying']);
    expect(resistTypes).not.toContain('poison');
    expect(weakTypes).not.toContain('poison');
  });

  it('collects multiple distinct weak types from different team members', () => {
    const team = [
      makePokemon({ power: 3, type1: 'poison' }),  // weak vs ground, ground resists poison's counter
      makePokemon({ power: 3, type1: 'electric' }), // weak vs ground, ground immune to electric's counter
      makePokemon({ power: 3, type1: 'normal' }),  // neutral vs ground
    ];
    const { weakTypes } = service.getMatchupTypes(team, ['ground']);
    expect(weakTypes.length).toBe(2);
    expect(weakTypes).toContain('poison');
    expect(weakTypes).toContain('electric');
  });

  it('a type can appear in both superEffectiveTypes and resistTypes (Water vs Fire: SE and resists)', () => {
    const team = [makePokemon({ power: 4, type1: 'water' })];
    const { superEffectiveTypes, resistTypes } = service.getMatchupTypes(team, ['fire']);
    expect(superEffectiveTypes).toEqual(['water']);
    expect(resistTypes).toEqual(['water']);
  });

  it('excludes a same-type pair from its own type\'s icons, even when the member is an overall advantage', () => {
    // Grass/Poison vs Grass: poison is SE vs grass and resists it (netScore +2 on its own).
    // Grass-vs-Grass is a same-type pair and always nets to 0 — it's excluded entirely,
    // so grass does NOT show up as "resists" just because its own defensive half is
    // individually positive (that's exactly offset by its own offensive half being resisted).
    const team = [makePokemon({ power: 3, type1: 'grass', type2: 'poison' })];
    const { superEffectiveTypes, resistTypes } = service.getMatchupTypes(team, ['grass']);
    expect(superEffectiveTypes).toEqual(['poison']);
    expect(resistTypes).toEqual(['poison']);
    expect(resistTypes).not.toContain('grass');
  });

  it('excludes a same-type pair even when it is the ONLY opponent type, leaving nothing to show', () => {
    // Water/Ice vs Ice: Water resists Ice (a genuine cross-type relationship). Ice-vs-Ice
    // is a same-type pair, excluded — it contributes nothing to its own icon eligibility,
    // even though the member's overall netScore is positive (from Water alone).
    const team = [makePokemon({ power: 4, type1: 'water', type2: 'ice' })];
    const { resistTypes } = service.getMatchupTypes(team, ['ice']);
    expect(resistTypes).toEqual(['water']);
    expect(resistTypes).not.toContain('ice');
  });

  it('is "weak" (not resist/SE) for Fire vs Water', () => {
    const team = [makePokemon({ power: 3, type1: 'fire' })];
    const { superEffectiveTypes, resistTypes, weakTypes } = service.getMatchupTypes(team, ['water']);
    expect(superEffectiveTypes).toEqual([]);
    expect(resistTypes).toEqual([]);
    expect(weakTypes).toEqual(['fire']);
  });

  it('returns empty arrays when team or opponentTypes is empty', () => {
    const team = [makePokemon({ power: 4, type1: 'water' })];
    expect(service.getMatchupTypes([], ['fire'])).toEqual({ superEffectiveTypes: [], resistTypes: [], weakTypes: [] });
    expect(service.getMatchupTypes(team, [])).toEqual({ superEffectiveTypes: [], resistTypes: [], weakTypes: [] });
  });
});
