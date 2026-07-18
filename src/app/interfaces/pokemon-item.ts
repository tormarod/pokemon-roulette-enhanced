import { WheelItem } from "./wheel-item";
import { PokemonType } from './pokemon-type';
import { AbilityId } from '../services/ability-service/abilities-data';

export interface PokemonItem extends WheelItem {
  pokemonId: number;
  type1?: PokemonType;
  type2?: PokemonType | null;
  sprite: {
    front_default: string;
    front_shiny: string;
  } | null;
  shiny: boolean;
  power: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** New Experience only: set when a rival loss faints this Pokémon (game-balance-v4). Stored, not on the active team, until revived. */
  fainted?: boolean;
  /** New Experience only: player-assigned ability id (via a capsule), or undefined for none. Only ever read behind the New Experience guard. */
  ability?: AbilityId;
}