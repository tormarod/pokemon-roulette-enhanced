import { PokemonType } from '../../interfaces/pokemon-type';

export type AbilityEffectType =
  // Original 8 effects (§4a base roster).
  | 'flat-yes'
  | 'flat-no'
  | 'offense-if-positive'
  | 'soak-if-negative'
  | 'zero-own-negative'
  | 'team-synergy'
  | 'extra-retry'
  | 'faint-immune-lead'
  // 9 new mechanics added for the player-assignable roster (§4b + §4c).
  | 'double-edged'
  | 'defensive-synergy'
  | 'punish-disadvantage'
  | 'low-team-offense'
  | 'neutral-bonus'
  | 'dual-type-offense'
  | 'mono-type-offense'
  | 'scale-with-advantage'
  | 'scale-with-disadvantage';

/**
 * Stable id for every assignable ability. Persisted on `PokemonItem.ability`
 * and carried by ability capsules; never a species/National-Dex number.
 */
export type AbilityId =
  // §4a — base 18, all on the original 8 effects.
  | 'blaze'
  | 'torrent'
  | 'overgrow'
  | 'guts'
  | 'static'
  | 'poison-point'
  | 'intimidate'
  | 'thick-fat'
  | 'clear-body'
  | 'keen-eye'
  | 'snow-cloak'
  | 'multiscale'
  | 'levitate'
  | 'swarm'
  | 'rough-skin'
  | 'synchronize'
  | 'sturdy'
  | 'serene-grace'
  // §4b — 5 new mechanics.
  | 'reckless'
  | 'battle-armor'
  | 'justified'
  | 'last-stand'
  | 'adaptability'
  // §4c — 7 more (4 new mechanics + 3 on existing effects).
  | 'versatile'
  | 'pure-power'
  | 'sheer-force'
  | 'comeback'
  | 'marvel-scale'
  | 'sand-rush'
  | 'cursed-body';

export interface AbilityDefinition {
  /** Stable id (also the localStorage/capsule value). */
  id: AbilityId;
  /** i18n key for the display name, e.g. "abilities.blaze.name". */
  name: string;
  /** i18n key for the one-line description, e.g. "abilities.blaze.description". */
  descriptionKey: string;
  /** The type this ability is iconic for — display/grouping only, not used in the numeric effect. */
  type: PokemonType;
  effect: AbilityEffectType;
  /**
   * Magnitude of the effect. Unused (0) for zero-own-negative, extra-retry, and
   * faint-immune-lead. For scale-with-advantage / scale-with-disadvantage it is
   * the cap on the (dis)advantage magnitude added.
   */
  value: number;
}

function ability(
  id: AbilityId,
  type: PokemonType,
  effect: AbilityEffectType,
  value: number
): AbilityDefinition {
  return { id, type, effect, value, name: `abilities.${id}.name`, descriptionKey: `abilities.${id}.description` };
}

/**
 * The 30 player-assignable abilities, keyed by stable `AbilityId`. Abilities are
 * no longer tied to a species — a Pokémon has one only when the player assigns a
 * capsule (New Experience only, see `AbilityService` / `PokemonItem.ability`).
 * Classic mode never reads this table.
 */
export const abilitiesById: Record<AbilityId, AbilityDefinition> = {
  // §4a — base 18.
  'blaze': ability('blaze', 'fire', 'offense-if-positive', 3),
  'torrent': ability('torrent', 'water', 'soak-if-negative', -3),
  'overgrow': ability('overgrow', 'grass', 'offense-if-positive', 3),
  'guts': ability('guts', 'fighting', 'flat-yes', 3),
  'static': ability('static', 'electric', 'flat-yes', 2),
  'poison-point': ability('poison-point', 'poison', 'flat-yes', 2),
  'intimidate': ability('intimidate', 'dark', 'flat-no', -2),
  'thick-fat': ability('thick-fat', 'normal', 'flat-no', -2),
  'clear-body': ability('clear-body', 'steel', 'flat-no', -2),
  'keen-eye': ability('keen-eye', 'flying', 'flat-no', -2),
  'snow-cloak': ability('snow-cloak', 'ice', 'flat-no', -2),
  'multiscale': ability('multiscale', 'dragon', 'soak-if-negative', -3),
  'levitate': ability('levitate', 'ghost', 'zero-own-negative', 0),
  'swarm': ability('swarm', 'bug', 'offense-if-positive', 2),
  'rough-skin': ability('rough-skin', 'ground', 'offense-if-positive', 2),
  'synchronize': ability('synchronize', 'psychic', 'team-synergy', 1),
  'sturdy': ability('sturdy', 'rock', 'faint-immune-lead', 0),
  'serene-grace': ability('serene-grace', 'fairy', 'extra-retry', 0),
  // §4b — 5 new mechanics.
  'reckless': ability('reckless', 'fire', 'double-edged', 1),
  'battle-armor': ability('battle-armor', 'steel', 'defensive-synergy', 1),
  'justified': ability('justified', 'fighting', 'punish-disadvantage', 2),
  'last-stand': ability('last-stand', 'dragon', 'low-team-offense', 2),
  'adaptability': ability('adaptability', 'normal', 'neutral-bonus', 1),
  // §4c — 7 more.
  'versatile': ability('versatile', 'dragon', 'dual-type-offense', 1),
  'pure-power': ability('pure-power', 'fighting', 'mono-type-offense', 1),
  'sheer-force': ability('sheer-force', 'ground', 'scale-with-advantage', 4),
  'comeback': ability('comeback', 'dark', 'scale-with-disadvantage', 4),
  'marvel-scale': ability('marvel-scale', 'water', 'soak-if-negative', -2),
  'sand-rush': ability('sand-rush', 'rock', 'flat-yes', 2),
  'cursed-body': ability('cursed-body', 'ghost', 'flat-no', -2)
};
