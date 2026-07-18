import { AbilityId } from '../ability-service/abilities-data';

/**
 * Item name for an ability capsule — one per assignable ability, derived from
 * its `AbilityId` (e.g. 'capsule-blaze'). A separate name union from regular
 * items and mega stones so capsules stay out of the regular item drop pool
 * (see `ItemsService.getRegularItems`).
 */
export type AbilityCapsuleName = `capsule-${AbilityId}`;

export function capsuleNameFor(id: AbilityId): AbilityCapsuleName {
  return `capsule-${id}`;
}

export function isAbilityCapsuleName(name: string): name is AbilityCapsuleName {
  return name.startsWith('capsule-');
}
