import { Injectable } from '@angular/core';
import { ItemName } from '../items-service/item-names';
import { Observable, of } from 'rxjs';

/**
 * Local, always-available fallback shown whenever an item has no mapped sprite
 * or its remote sprite fails to load (see `onSpriteError` handlers in the item
 * views). Served from `public/` at the app root — no network dependency, so a
 * broken/blocked external host never leaves a missing-image icon.
 */
export const ITEM_SPRITE_FALLBACK = 'item-fallback.png';

@Injectable({
  providedIn: 'root'
})
export class ItemSpriteService {

  constructor() { }

  itemSpriteData: Partial<Record<ItemName, { sprite: string }>> = {
    "potion": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png' },
    "rare-candy": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png' },
    "bicycle": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/bicycle.png' },
    "super-potion": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/super-potion.png' },
    "x-attack": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png' },
    "exp-share": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/exp-share.png' },
    "hyper-potion": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hyper-potion.png' },
    "escape-rope": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/escape-rope.png' },
    "honey": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/honey.png' },
    "repel": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/repel.png' },
    "poke-radar": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-radar.png' },
    "max-repel": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-repel.png' },
    "link-cable": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/up-grade.png' },
    "revive": { sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/revive.png' }
  };

  getItemSprite(itemName: ItemName): Observable<{ sprite: string }> {
    return of(this.itemSpriteData[itemName] ?? { sprite: ITEM_SPRITE_FALLBACK });
  }
}
