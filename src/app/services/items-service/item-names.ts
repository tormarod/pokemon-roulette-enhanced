import { MegaStoneItemName } from './mega-stone-names';
import { RegularItemName } from './regular-item-names';
import { AbilityCapsuleName } from './ability-capsule-names';

export type { MegaStoneItemName } from './mega-stone-names';
export { isMegaStoneItemName, megaStoneItemNames } from './mega-stone-names';
export type { RegularItemName } from './regular-item-names';
export type { AbilityCapsuleName } from './ability-capsule-names';
export { isAbilityCapsuleName, capsuleNameFor } from './ability-capsule-names';

export type ItemName = RegularItemName | MegaStoneItemName | AbilityCapsuleName;