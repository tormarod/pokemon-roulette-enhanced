import { Injectable } from '@angular/core';
import { itemsData } from './items-data';
import { megaStonesData } from './mega-stones-data';
import { abilityCapsulesData } from './ability-capsules-data';
import { AbilityCapsuleName, ItemName, MegaStoneItemName, RegularItemName } from './item-names';
import { ItemItem } from '../../interfaces/item-item';
import { GameStateService } from '../game-state-service/game-state.service';
import { MARKET_PRICES } from '../../main-game/roulette-container/economy-config';

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
   * game-balance-v4). Repel/Max Repel shield adventure steps from the New
   * Experience-only danger meter, so they're equally meaningless in Classic.
   * Classic mode never finds any of these, regardless of weight.
   */
  private static readonly NE_ONLY_ITEM_NAMES = new Set<RegularItemName>(['revive', 'repel', 'max-repel']);

  getRegularItems(): ItemItem[] {
    return Object.values(this.regularItemsData)
      .filter(item => !ItemsService.NE_ONLY_ITEM_NAMES.has(item.name as RegularItemName) || this.gameStateService.isNewExperienceMode);
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
   * Find Item's wheel pool. In New Experience it's disjoint from the Market:
   * excludes anything buyable there, leaving only find-only gadgets and the
   * Bicycle power-item. Classic has no Market, so it's unchanged.
   */
  getFindableItems(): ItemItem[] {
    const regularItems = this.getRegularItems();
    if (!this.gameStateService.isNewExperienceMode) {
      return regularItems;
    }
    return regularItems.filter(item => !ItemsService.MARKET_SOLD_ITEM_NAMES.has(item.name));
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
