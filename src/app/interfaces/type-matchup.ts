import { PokemonType } from './pokemon-type';

export interface TypeMatchupEntry {
  strongAgainst: PokemonType[];
  weakAgainst: PokemonType[];
  /** Types this type takes half damage from (0.5x) when defending. */
  resists: PokemonType[];
  /** Types this type takes no damage from (0x) when defending. */
  immuneTo: PokemonType[];
}

export type TypeMatchupMap = Record<PokemonType, TypeMatchupEntry>;
