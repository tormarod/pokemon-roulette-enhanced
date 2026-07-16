import { PlayerStats } from './player-stats';

export interface Achievement {
  id: string;
  nameKey: string;
  descriptionKey: string;
  isUnlocked: (stats: PlayerStats) => boolean;
}
