import { PokemonType } from '../../interfaces/pokemon-type';

export type AbilityEffectType =
  | 'flat-yes'
  | 'flat-no'
  | 'offense-if-positive'
  | 'soak-if-negative'
  | 'zero-own-negative'
  | 'team-synergy'
  | 'extra-retry'
  | 'faint-immune-lead';

export interface AbilityDefinition {
  /** Display/translation name, e.g. "Blaze". */
  name: string;
  /** The type this ability is iconic for — display/grouping only, not used in the numeric effect. */
  type: PokemonType;
  effect: AbilityEffectType;
  /** Magnitude of the effect. Unused (0) for zero-own-negative, extra-retry, and faint-immune-lead. */
  value: number;
}

/**
 * New Experience-only curated ability roster: one hand-picked species per
 * Pokémon type (`src/app/interfaces/pokemon-type.ts`), keyed by `pokemonId`
 * (National Dex number, see `national-dex-pokemon.ts`). Not a per-type
 * blanket table — only these 18 species have an ability; everything else is
 * unaffected. Classic mode never reads this table (see `AbilityService`).
 */
export const abilitiesData: Record<number, AbilityDefinition> = {
  143: { name: 'Thick Fat', type: 'normal', effect: 'flat-no', value: -1 },
  68: { name: 'No Guard', type: 'fighting', effect: 'flat-yes', value: 1 },
  398: { name: 'Keen Eye', type: 'flying', effect: 'flat-no', value: -1 },
  34: { name: 'Poison Point', type: 'poison', effect: 'flat-yes', value: 1 },
  445: { name: 'Rough Skin', type: 'ground', effect: 'offense-if-positive', value: 1 },
  76: { name: 'Sturdy', type: 'rock', effect: 'faint-immune-lead', value: 0 },
  212: { name: 'Swarm', type: 'bug', effect: 'offense-if-positive', value: 1 },
  94: { name: 'Levitate', type: 'ghost', effect: 'zero-own-negative', value: 0 },
  376: { name: 'Clear Body', type: 'steel', effect: 'flat-no', value: -1 },
  6: { name: 'Blaze', type: 'fire', effect: 'offense-if-positive', value: 2 },
  9: { name: 'Torrent', type: 'water', effect: 'soak-if-negative', value: -2 },
  3: { name: 'Overgrow', type: 'grass', effect: 'offense-if-positive', value: 2 },
  145: { name: 'Static', type: 'electric', effect: 'flat-yes', value: 1 },
  282: { name: 'Synchronize', type: 'psychic', effect: 'team-synergy', value: 1 },
  471: { name: 'Snow Cloak', type: 'ice', effect: 'flat-no', value: -1 },
  149: { name: 'Multiscale', type: 'dragon', effect: 'soak-if-negative', value: -2 },
  262: { name: 'Intimidate', type: 'dark', effect: 'flat-yes', value: 1 },
  468: { name: 'Serene Grace', type: 'fairy', effect: 'extra-retry', value: 0 }
};
