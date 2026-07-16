import { computeStatsSummary } from './stats-selectors';
import { createDefaultPlayerStats, PlayerStats } from '../../interfaces/player-stats';

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
});
