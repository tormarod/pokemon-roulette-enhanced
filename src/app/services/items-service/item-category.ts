import { ItemName, RegularItemName, isMegaStoneItemName, isAbilityCapsuleName } from './item-names';

export type ItemCategory = 'battle' | 'field' | 'mega' | 'capsule';

/**
 * Regular items framed around exploration/traversal rather than battle prep.
 * Every other regular item defaults to 'battle' (see getItemCategory).
 */
const FIELD_ITEM_NAMES: ReadonlySet<RegularItemName> = new Set([
  'repel', 'max-repel', 'honey', 'poke-radar', 'escape-rope', 'bicycle', 'link-cable'
]);

export function getItemCategory(name: ItemName): ItemCategory {
  if (isMegaStoneItemName(name)) {
    return 'mega';
  }
  if (isAbilityCapsuleName(name)) {
    return 'capsule';
  }
  return FIELD_ITEM_NAMES.has(name as RegularItemName) ? 'field' : 'battle';
}
