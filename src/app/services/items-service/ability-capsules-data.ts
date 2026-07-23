import { ItemItem } from '../../interfaces/item-item';
import { pokemonTypeColors } from '../../interfaces/pokemon-type';
import { AbilityCapsuleName, capsuleNameFor } from './ability-capsule-names';
import { AbilityDefinition, AbilityId, abilitiesById } from '../ability-service/abilities-data';

/** Wheel-slice / badge color per type — capsules are colored by their ability's flavor type. */
const TYPE_COLOR = pokemonTypeColors;

/** Shared "Ability Capsule" sprite (PokeAPI) — every capsule shows the same icon. */
const CAPSULE_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ability-capsule.png';

function capsuleFor(def: AbilityDefinition): ItemItem {
  return {
    text: def.name,                 // i18n key: abilities.<id>.name
    name: capsuleNameFor(def.id),
    sprite: CAPSULE_SPRITE,
    fillStyle: TYPE_COLOR[def.type],
    weight: 1,                      // flat — every capsule is equally likely
    description: def.descriptionKey, // i18n key: abilities.<id>.description
    abilityId: def.id
  };
}

/**
 * One capsule per assignable ability, keyed by `AbilityCapsuleName`. Looted from
 * the New-Experience-only ability-capsule wheel; never part of the regular item
 * drop pool. Kept in sync with `abilitiesById` automatically.
 */
export const abilityCapsulesData: Record<AbilityCapsuleName, ItemItem> = Object.fromEntries(
  (Object.keys(abilitiesById) as AbilityId[]).map(id => [capsuleNameFor(id), capsuleFor(abilitiesById[id])])
) as Record<AbilityCapsuleName, ItemItem>;
