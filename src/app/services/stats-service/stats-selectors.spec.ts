import { computeStatsSummary, computeGenerationStatsSummary } from './stats-selectors';
import { createDefaultPlayerStats, PlayerStats, RunLogEntry } from '../../interfaces/player-stats';
import { ACHIEVEMENTS } from './achievements';

describe('computeStatsSummary', () => {
  const withStats = (overrides: Partial<PlayerStats>): PlayerStats => ({
    ...createDefaultPlayerStats(),
    ...overrides,
  });

  // ── Empty-history cases ─────────────────────────────────────────────────

  it('should return nulls/empties for a brand-new player, never NaN or Infinity', () => {
    const summary = computeStatsSummary(createDefaultPlayerStats());

    expect(summary.winRate).toBeNull();
    expect(summary.favoriteGenerationId).toBeNull();
    expect(summary.mostChosenStarterId).toBeNull();
    expect(summary.signaturePokemonId).toBeNull();
    expect(summary.nemesis).toBeNull();
    expect(summary.championHeartbreakRate).toBeNull();
    expect(summary.topOwnedPokemon).toEqual([]);
    expect(summary.favoriteTypes).toEqual([]);
    expect(summary.battleTypeWinRates).toEqual({ gym: null, rival: null, eliteFour: null, champion: null });
    expect(summary.actualYesRate).toBeNull();
    expect(summary.expectedYesRate).toBeNull();
    expect(summary.luckIndex).toBeNull();
    expect(summary.recentForm).toEqual([]);
    expect(summary.recentFormWinRate).toBeNull();
    expect(summary.winRateTrend).toEqual([]);
    expect(summary.runHistory).toEqual([]);
    expect(summary.totalPlaytimeMs).toBe(0);
    expect(summary.achievements.length).toBe(ACHIEVEMENTS.length);
    expect(summary.achievements.every(a => !a.unlocked)).toBeTrue();
  });

  // ── Luck / wheel ─────────────────────────────────────────────────────────

  it('should compute actual/expected yes rates and a positive luck index when running lucky', () => {
    const summary = computeStatsSummary(withStats({
      totalSpins: 10,
      yesLandings: 8,
      sumExpectedYesProbability: 5, // average expected yes-share of 0.5
    }));

    expect(summary.actualYesRate).toBe(0.8);
    expect(summary.expectedYesRate).toBe(0.5);
    expect(summary.luckIndex).toBeCloseTo(0.3);
  });

  it('should compute a negative luck index when running unlucky', () => {
    const summary = computeStatsSummary(withStats({
      totalSpins: 10,
      yesLandings: 2,
      sumExpectedYesProbability: 5,
    }));

    expect(summary.luckIndex).toBeCloseTo(-0.3);
  });

  it('should pass through potionsUsed and teamRocketStealsSuffered unchanged', () => {
    const summary = computeStatsSummary(withStats({ potionsUsed: 3, teamRocketStealsSuffered: 2 }));

    expect(summary.potionsUsed).toBe(3);
    expect(summary.teamRocketStealsSuffered).toBe(2);
  });

  // ── Rates ────────────────────────────────────────────────────────────────

  it('should compute win rate and per-battle-type rates from counters', () => {
    const summary = computeStatsSummary(withStats({
      runsPlayed: 4,
      victories: 1,
      defeats: 3,
      battleTypeWins: { gym: 6, rival: 2, eliteFour: 1, champion: 1 },
      battleTypeLosses: { gym: 2, rival: 1, eliteFour: 1, champion: 2 },
    }));

    expect(summary.winRate).toBe(0.25);
    expect(summary.battleTypeWinRates.gym).toBe(0.75);
    expect(summary.battleTypeWinRates.rival).toBeCloseTo(2 / 3);
    expect(summary.battleTypeWinRates.eliteFour).toBe(0.5);
    expect(summary.battleTypeWinRates.champion).toBeCloseTo(1 / 3);
  });

  it('should compute the champion heartbreak rate as champion losses over total defeats', () => {
    const summary = computeStatsSummary(withStats({
      defeats: 4,
      battleTypeLosses: { gym: 1, rival: 0, eliteFour: 1, champion: 2 },
    }));

    expect(summary.championHeartbreakRate).toBe(0.5);
  });

  // ── Top-N / tie-breaking ────────────────────────────────────────────────

  it('should return the top 3 owned species sorted by count descending', () => {
    const summary = computeStatsSummary(withStats({
      speciesOwnedCounts: { 1: 2, 4: 5, 7: 1, 25: 3 },
    }));

    expect(summary.topOwnedPokemon).toEqual([
      { pokemonId: 4, count: 5 },
      { pokemonId: 25, count: 3 },
      { pokemonId: 1, count: 2 },
    ]);
  });

  it('should break a top-owned tie by ascending pokemonId, deterministically', () => {
    const summary = computeStatsSummary(withStats({
      speciesOwnedCounts: { 150: 2, 25: 2, 1: 2 },
    }));

    expect(summary.topOwnedPokemon).toEqual([
      { pokemonId: 1, count: 2 },
      { pokemonId: 25, count: 2 },
      { pokemonId: 150, count: 2 },
    ]);
  });

  it('should pick the favorite generation, most-chosen starter, and signature Pokémon by max count', () => {
    const summary = computeStatsSummary(withStats({
      generationPlayCounts: { 1: 3, 3: 7, 4: 2 },
      starterCounts: { 1: 1, 4: 4, 7: 2 },
      speciesVictoryCounts: { 6: 1, 9: 3 },
    }));

    expect(summary.favoriteGenerationId).toBe(3);
    expect(summary.mostChosenStarterId).toBe(4);
    expect(summary.signaturePokemonId).toBe(9);
  });

  it('should sort favorite types by count descending, ties broken alphabetically', () => {
    const summary = computeStatsSummary(withStats({
      typeCounts: { water: 2, fire: 2, grass: 5 },
    }));

    expect(summary.favoriteTypes).toEqual([
      { type: 'grass', count: 5 },
      { type: 'fire', count: 2 },
      { type: 'water', count: 2 },
    ]);
  });

  // ── Nemesis ─────────────────────────────────────────────────────────────

  it('should pick the opponent with the most defeats as the nemesis and parse its key', () => {
    const summary = computeStatsSummary(withStats({
      nemesisDefeats: { 'gym:gym.brock.name': 2, 'champion.blue.name': 1, 'eliteFour:elite.lorelei.name': 4 },
    }));

    expect(summary.nemesis).toEqual({
      key: 'eliteFour:elite.lorelei.name',
      battleType: 'eliteFour',
      name: 'elite.lorelei.name',
      count: 4,
    });
  });

  it('should break a nemesis tie alphabetically by key', () => {
    const summary = computeStatsSummary(withStats({
      nemesisDefeats: { 'gym:zed': 3, 'gym:alpha': 3 },
    }));

    expect(summary.nemesis?.key).toBe('gym:alpha');
  });

  // ── Run-history log ─────────────────────────────────────────────────────

  const makeRun = (overrides: Partial<RunLogEntry>): RunLogEntry => ({
    victory: true,
    generationId: 1,
    roundsReached: 5,
    starterPokemonId: 1,
    startedAt: 1000,
    endedAt: 2000,
    ...overrides,
  });

  it('should expose runHistory most-recent-first without mutating the source array', () => {
    const runHistory = [makeRun({ starterPokemonId: 1 }), makeRun({ starterPokemonId: 2 }), makeRun({ starterPokemonId: 3 })];
    const summary = computeStatsSummary(withStats({ runHistory }));

    expect(summary.runHistory.map(run => run.starterPokemonId)).toEqual([3, 2, 1]);
    expect(runHistory.map(run => run.starterPokemonId)).toEqual([1, 2, 3]);
  });

  it('should compute recentForm (most-recent-first) and its win rate over the last 10 runs', () => {
    const runHistory = [
      makeRun({ victory: true }), makeRun({ victory: false }), makeRun({ victory: true }),
    ];
    const summary = computeStatsSummary(withStats({ runHistory }));

    expect(summary.recentForm).toEqual([true, false, true]);
    expect(summary.recentFormWinRate).toBeCloseTo(2 / 3);
  });

  it('should only consider the last 10 runs for recentForm even with a longer history', () => {
    const runHistory = [
      ...Array.from({ length: 15 }, () => makeRun({ victory: false })),
      ...Array.from({ length: 10 }, () => makeRun({ victory: true })),
    ];
    const summary = computeStatsSummary(withStats({ runHistory }));

    expect(summary.recentForm.length).toBe(10);
    expect(summary.recentForm.every(result => result)).toBeTrue();
    expect(summary.recentFormWinRate).toBe(1);
  });

  it('should compute a cumulative win-rate trend in chronological order', () => {
    const runHistory = [
      makeRun({ victory: true }), makeRun({ victory: true }), makeRun({ victory: false }), makeRun({ victory: true }),
    ];
    const summary = computeStatsSummary(withStats({ runHistory }));

    expect(summary.winRateTrend).toEqual([1, 1, 2 / 3, 0.75]);
  });

  it('should sum playtime across all logged runs, clamping any negative duration to zero', () => {
    const runHistory = [
      makeRun({ startedAt: 0, endedAt: 60_000 }), // 1 minute
      makeRun({ startedAt: 1000, endedAt: 500 }), // corrupt/negative duration
    ];
    const summary = computeStatsSummary(withStats({ runHistory }));

    expect(summary.totalPlaytimeMs).toBe(60_000);
  });

  // ── Data-gap fills + achievements ────────────────────────────────────────

  it('should pass through legendariesCaught, evolutionsPerformed, and perfectRuns unchanged', () => {
    const summary = computeStatsSummary(withStats({ legendariesCaught: 2, evolutionsPerformed: 7, perfectRuns: 1 }));

    expect(summary.legendariesCaught).toBe(2);
    expect(summary.evolutionsPerformed).toBe(7);
    expect(summary.perfectRuns).toBe(1);
  });

  it('should mark only unlocked achievements as unlocked, in ACHIEVEMENTS order', () => {
    const summary = computeStatsSummary(withStats({
      unlockedAchievementIds: { 'first-victory': true },
    }));

    expect(summary.achievements.map(a => a.id)).toEqual(ACHIEVEMENTS.map(a => a.id));
    expect(summary.achievements.find(a => a.id === 'first-victory')?.unlocked).toBeTrue();
    expect(summary.achievements.filter(a => a.unlocked).length).toBe(1);
  });
});

describe('computeGenerationStatsSummary', () => {
  const withStats = (overrides: Partial<PlayerStats>): PlayerStats => ({
    ...createDefaultPlayerStats(),
    ...overrides,
  });

  const makeRun = (overrides: Partial<RunLogEntry>): RunLogEntry => ({
    victory: true,
    generationId: 1,
    roundsReached: 5,
    starterPokemonId: 1,
    startedAt: 1000,
    endedAt: 2000,
    ...overrides,
  });

  it('should return nulls/zeros/empties for a generation with no runs, never NaN or Infinity', () => {
    const summary = computeGenerationStatsSummary(createDefaultPlayerStats(), 3);

    expect(summary.generationId).toBe(3);
    expect(summary.runsPlayed).toBe(0);
    expect(summary.winRate).toBeNull();
    expect(summary.bestWinStreak).toBe(0);
    expect(summary.fastestVictoryRounds).toBeNull();
    expect(summary.longestRunRounds).toBe(0);
    expect(summary.topOwnedPokemon).toEqual([]);
    expect(summary.favoriteTypes).toEqual([]);
    expect(summary.nemesis).toBeNull();
  });

  it('should only count runs matching the requested generation', () => {
    const runHistory = [
      makeRun({ generationId: 1, victory: true }),
      makeRun({ generationId: 2, victory: false }),
      makeRun({ generationId: 1, victory: false }),
    ];
    const summary = computeGenerationStatsSummary(withStats({ runHistory }), 1);

    expect(summary.runsPlayed).toBe(2);
    expect(summary.victories).toBe(1);
    expect(summary.defeats).toBe(1);
    expect(summary.winRate).toBe(0.5);
  });

  it('should compute the best win streak within the filtered generation only, in chronological order', () => {
    const runHistory = [
      makeRun({ generationId: 1, victory: true }),
      makeRun({ generationId: 1, victory: true }),
      makeRun({ generationId: 2, victory: true }),
      makeRun({ generationId: 2, victory: true }),
      makeRun({ generationId: 2, victory: true }),
      makeRun({ generationId: 1, victory: false }),
      makeRun({ generationId: 1, victory: true }),
    ];

    expect(computeGenerationStatsSummary(withStats({ runHistory }), 1).bestWinStreak).toBe(2);
    expect(computeGenerationStatsSummary(withStats({ runHistory }), 2).bestWinStreak).toBe(3);
  });

  it('should compute fastestVictoryRounds and longestRunRounds within the generation', () => {
    const runHistory = [
      makeRun({ generationId: 1, victory: true, roundsReached: 8 }),
      makeRun({ generationId: 1, victory: false, roundsReached: 12 }),
      makeRun({ generationId: 1, victory: true, roundsReached: 3 }),
    ];
    const summary = computeGenerationStatsSummary(withStats({ runHistory }), 1);

    expect(summary.fastestVictoryRounds).toBe(3);
    expect(summary.longestRunRounds).toBe(12);
  });

  it('should read topOwnedPokemon/favoriteTypes/nemesis from the *ByGen counters, not the lifetime ones', () => {
    const summary = computeGenerationStatsSummary(withStats({
      speciesOwnedCounts: { 4: 99 }, // lifetime — must NOT leak into the per-gen view
      speciesOwnedCountsByGen: { 1: { 1: 2, 4: 5 }, 2: { 7: 1 } },
      typeCountsByGen: { 1: { water: 3, fire: 1 } },
      nemesisDefeatsByGen: { 1: { 'gym:gym.brock.name': 2 } },
    }), 1);

    expect(summary.topOwnedPokemon).toEqual([{ pokemonId: 4, count: 5 }, { pokemonId: 1, count: 2 }]);
    expect(summary.favoriteTypes).toEqual([{ type: 'water', count: 3 }, { type: 'fire', count: 1 }]);
    expect(summary.nemesis).toEqual({ key: 'gym:gym.brock.name', battleType: 'gym', name: 'gym.brock.name', count: 2 });
  });

  it('should show empty per-gen species/type/nemesis for a generation played only before the breakdown existed, while its run history still counts', () => {
    const runHistory = [makeRun({ generationId: 5, victory: true })];
    const summary = computeGenerationStatsSummary(withStats({ runHistory }), 5);

    expect(summary.runsPlayed).toBe(1);
    expect(summary.victories).toBe(1);
    expect(summary.topOwnedPokemon).toEqual([]);
    expect(summary.favoriteTypes).toEqual([]);
    expect(summary.nemesis).toBeNull();
  });
});
