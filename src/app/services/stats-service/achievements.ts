import { Achievement } from '../../interfaces/achievement';

/**
 * Mirrors GenerationService's generation ids (1-9). Kept as a local constant
 * rather than injecting GenerationService, since Achievement.isUnlocked must
 * stay a pure function of PlayerStats — update this list if a generation is
 * ever added there.
 */
const ALL_GENERATION_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Declarative unlock conditions, evaluated against PlayerStats after every
 * StatsService mutation (see StatsService.applyAchievementUnlocks). Most
 * predicates are pure reads of existing counters — see plan V2 §3.B.
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-victory',
    nameKey: 'stats.achievements.firstVictory.name',
    descriptionKey: 'stats.achievements.firstVictory.description',
    isUnlocked: stats => stats.victories >= 1,
  },
  {
    id: 'wins-10',
    nameKey: 'stats.achievements.wins10.name',
    descriptionKey: 'stats.achievements.wins10.description',
    isUnlocked: stats => stats.victories >= 10,
  },
  {
    id: 'wins-50',
    nameKey: 'stats.achievements.wins50.name',
    descriptionKey: 'stats.achievements.wins50.description',
    isUnlocked: stats => stats.victories >= 50,
  },
  {
    id: 'win-streak-5',
    nameKey: 'stats.achievements.winStreak5.name',
    descriptionKey: 'stats.achievements.winStreak5.description',
    isUnlocked: stats => stats.bestWinStreak >= 5,
  },
  {
    id: 'win-streak-10',
    nameKey: 'stats.achievements.winStreak10.name',
    descriptionKey: 'stats.achievements.winStreak10.description',
    isUnlocked: stats => stats.bestWinStreak >= 10,
  },
  {
    id: 'first-shiny',
    nameKey: 'stats.achievements.firstShiny.name',
    descriptionKey: 'stats.achievements.firstShiny.description',
    isUnlocked: stats => stats.shiniesCaught >= 1,
  },
  {
    id: 'first-legendary',
    nameKey: 'stats.achievements.firstLegendary.name',
    descriptionKey: 'stats.achievements.firstLegendary.description',
    isUnlocked: stats => stats.legendariesCaught >= 1,
  },
  {
    id: 'perfect-run',
    nameKey: 'stats.achievements.perfectRun.name',
    descriptionKey: 'stats.achievements.perfectRun.description',
    isUnlocked: stats => stats.perfectRuns >= 1,
  },
  {
    id: 'champion-every-generation',
    nameKey: 'stats.achievements.championEveryGeneration.name',
    descriptionKey: 'stats.achievements.championEveryGeneration.description',
    isUnlocked: stats => ALL_GENERATION_IDS.every(id => stats.championGenerationIds[id]),
  },
];
