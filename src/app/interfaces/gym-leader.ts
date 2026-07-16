import { PokemonType } from './pokemon-type';

export interface GymLeader{
  name: string;
  sprite: string | string[];
  quotes: string[];
  /**
   * The trainer's team theme (2-3 types), used by TypeMatchupService to grade
   * battle odds — not one dual-type Pokémon, so entries are never multiplied
   * together. Distinct types represent the breadth of the trainer's team; a
   * *repeated* type is a deliberate emphasis lever (e.g. Lance's
   * `['dragon', 'dragon']`) that doubles the defensive read against it — a
   * member weak to it is punished as hard-countered rather than plain weak,
   * and a member that resists it is rewarded harder in kind. Only repeat a
   * type when that's the intended difficulty effect.
   */
  types?: PokemonType[];
}