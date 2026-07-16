import { ACHIEVEMENTS } from './achievements';
import { createDefaultPlayerStats, PlayerStats } from '../../interfaces/player-stats';

describe('ACHIEVEMENTS predicates', () => {
  const withStats = (overrides: Partial<PlayerStats>): PlayerStats => ({
    ...createDefaultPlayerStats(),
    ...overrides,
  });

  const isUnlocked = (id: string, stats: PlayerStats): boolean => {
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) {
      throw new Error(`No achievement registered with id "${id}"`);
    }
    return achievement.isUnlocked(stats);
  };

  it('should have unique ids', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should leave every achievement locked against the default (empty-history) stats', () => {
    const defaults = createDefaultPlayerStats();
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.isUnlocked(defaults)).toBeFalse();
    }
  });

  it('first-victory should require at least one victory', () => {
    expect(isUnlocked('first-victory', withStats({ victories: 0 }))).toBeFalse();
    expect(isUnlocked('first-victory', withStats({ victories: 1 }))).toBeTrue();
  });

  it('wins10 / wins50 should unlock exactly at their thresholds', () => {
    expect(isUnlocked('wins-10', withStats({ victories: 9 }))).toBeFalse();
    expect(isUnlocked('wins-10', withStats({ victories: 10 }))).toBeTrue();
    expect(isUnlocked('wins-50', withStats({ victories: 49 }))).toBeFalse();
    expect(isUnlocked('wins-50', withStats({ victories: 50 }))).toBeTrue();
  });

  it('win-streak-5 / win-streak-10 should key off bestWinStreak, not currentStreak', () => {
    expect(isUnlocked('win-streak-5', withStats({ bestWinStreak: 4, currentStreak: 5 }))).toBeFalse();
    expect(isUnlocked('win-streak-5', withStats({ bestWinStreak: 5, currentStreak: 0 }))).toBeTrue();
    expect(isUnlocked('win-streak-10', withStats({ bestWinStreak: 9 }))).toBeFalse();
    expect(isUnlocked('win-streak-10', withStats({ bestWinStreak: 10 }))).toBeTrue();
  });

  it('first-shiny should require at least one shiny catch', () => {
    expect(isUnlocked('first-shiny', withStats({ shiniesCaught: 0 }))).toBeFalse();
    expect(isUnlocked('first-shiny', withStats({ shiniesCaught: 1 }))).toBeTrue();
  });

  it('first-legendary should require at least one legendary/Paradox catch', () => {
    expect(isUnlocked('first-legendary', withStats({ legendariesCaught: 0 }))).toBeFalse();
    expect(isUnlocked('first-legendary', withStats({ legendariesCaught: 1 }))).toBeTrue();
  });

  it('perfect-run should require at least one perfect run', () => {
    expect(isUnlocked('perfect-run', withStats({ perfectRuns: 0 }))).toBeFalse();
    expect(isUnlocked('perfect-run', withStats({ perfectRuns: 1 }))).toBeTrue();
  });

  it('champion-every-generation should require all 9 generations, not just a majority', () => {
    const eightOfNine = withStats({
      championGenerationIds: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
    });
    expect(isUnlocked('champion-every-generation', eightOfNine)).toBeFalse();

    const allNine = withStats({
      championGenerationIds: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true },
    });
    expect(isUnlocked('champion-every-generation', allNine)).toBeTrue();
  });
});
