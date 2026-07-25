import { Injectable } from '@angular/core';
import { itemsData } from './items-data';
import { megaStonesData } from './mega-stones-data';
import { abilityCapsulesData } from './ability-capsules-data';
import { AbilityCapsuleName, ItemName, MegaStoneItemName, RegularItemName } from './item-names';
import { ItemItem } from '../../interfaces/item-item';
import { MARKET_PRICES } from '../../main-game/roulette-container/economy-config';

@Injectable({
  providedIn: 'root'
})
export class ItemsService {

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

  getRegularItems(): ItemItem[] {
    return Object.values(this.regularItemsData);
  }

  /**
   * Item names the Market sells (derived from MARKET_PRICES, minus the
   * synthetic 'ability-capsule' entry which isn't a regular item). Kept
   * derived rather than a separately-maintained list so Find Item and the
   * Market can't silently drift apart.
   */
  private static readonly MARKET_SOLD_ITEM_NAMES = new Set<string>(
    Object.keys(MARKET_PRICES).filter(id => id !== 'ability-capsule')
  );

  /**
   * Find Item's wheel pool, disjoint from the Market: excludes anything
   * buyable there, leaving only find-only gadgets and the Bicycle power-item.
   */
  getFindableItems(): ItemItem[] {
    return this.getRegularItems().filter(item => !ItemsService.MARKET_SOLD_ITEM_NAMES.has(item.name));
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
