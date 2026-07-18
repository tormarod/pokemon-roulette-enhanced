import { Injectable } from '@angular/core';
import { itemsData } from './items-data';
import { megaStonesData } from './mega-stones-data';
import { ItemName, MegaStoneItemName, RegularItemName } from './item-names';
import { ItemItem } from '../../interfaces/item-item';
import { GameStateService } from '../game-state-service/game-state.service';

@Injectable({
  providedIn: 'root'
})
export class ItemsService {

  constructor(private gameStateService: GameStateService) { }

  readonly regularItemsData = itemsData;
  readonly megaStonesData = megaStonesData;
  readonly itemsData = {
    ...this.regularItemsData,
    ...this.megaStonesData
  };

  getRegularItem(itemName: RegularItemName): ItemItem {
    return this.regularItemsData[itemName];
  }

  getMegaStone(itemName: MegaStoneItemName): ItemItem {
    return this.megaStonesData[itemName];
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

  getAllItems(): ItemItem[] {
    return Object.values(this.itemsData);
  }
}
