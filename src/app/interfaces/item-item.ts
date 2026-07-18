import { ItemName } from "../services/items-service/item-names";
import { WheelItem } from "./wheel-item";
import { AbilityId } from "../services/ability-service/abilities-data";

export interface ItemItem extends WheelItem {
  name: ItemName;
  sprite: string;
  description: string;
  /** Ability capsules only: the ability this capsule assigns when applied to a Pokémon. */
  abilityId?: AbilityId;
}