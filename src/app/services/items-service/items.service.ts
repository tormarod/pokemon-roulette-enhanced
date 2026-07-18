import { Injectable } from '@angular/core';
import { itemsData } from './items-data';
import { megaStonesData } from './mega-stones-data';
import { abilityCapsulesData } from './ability-capsules-data';
import { AbilityCapsuleName, ItemName, MegaStoneItemName, RegularItemName } from './item-names';
import { ItemItem } from '../../interfaces/item-item';
import { GameStateService } from '../game-state-service/game-state.service';

@Injectable({
  providedIn: 'root'
})
export class ItemsService {

  constructor(private gameStateService: GameStateService) { }

  readonly regularItemsData = itemsData;
  readonly megaStonesData = megaStonesData;
  readonly abilityCapsulesData = abilityCapsulesData;
  readonly itemsData = {
    ...this.regularItemsData,
    ...this.megaStonesData,
    ...this.abilityCapsulesData
  };

  getRegularItem(itemName: RegularItemName): ItemItem {
    return this.regularItemsData[itemName];
  }

  getMegaStone(itemName: MegaStoneItemName): ItemItem {
    return this.megaStonesData[itemName];
  }

  getAbilityCapsule(itemName: AbilityCapsuleName): ItemItem {
    return this.abilityCapsulesData[itemName];
  }

  getItem(itemName: ItemName): ItemItem {
    return this.itemsData[itemName];
  }

  /**
   * Revive only exists in New Experience mode — it revives a fainted
   * Pokémon, and fainting itself is a New Experience-only mechanic (see
   * game-balance-v4). Classic mode never finds it, regardless of weight.
   */
  getRegularItems(): ItemItem[] {
    return Object.values(this.regularItemsData)
      .filter(item => item.name !== 'revive' || this.gameStateService.isNewExperienceMode);
  }

  getMegaStones(): ItemItem[] {
    return Object.values(this.megaStonesData);
  }

  /**
   * The full ability-capsule drop pool (all 30, flat weight). Consumed only by
   * the New-Experience-only ability-capsule wheel — deliberately NOT part of
   * `getRegularItems()`, so capsules never appear on the regular item wheel.
   */
  getAbilityCapsules(): ItemItem[] {
    return Object.values(this.abilityCapsulesData);
  }

  getAllItems(): ItemItem[] {
    return Object.values(this.itemsData);
  }
}
