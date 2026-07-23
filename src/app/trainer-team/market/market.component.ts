import { Component, OnDestroy, OnInit, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { GameState } from '../../services/game-state-service/game-state';
import { ItemsService } from '../../services/items-service/items.service';
import { ItemSpriteService, ITEM_SPRITE_FALLBACK } from '../../services/item-sprite-service/item-sprite.service';
import { BattlePrepService } from '../../services/battle-prep-service/battle-prep.service';
import { SoundFxHandle, SoundFxService } from '../../services/sound-fx-service/sound-fx.service';
import { ItemName, RegularItemName } from '../../services/items-service/item-names';
import { MARKET_PRICES, MarketEntryId, sellValue } from '../../main-game/roulette-container/economy-config';
import { ItemItem } from '../../interfaces/item-item';
import { MarketStockService } from '../../services/market-stock-service/market-stock.service';

/** Market-specific 3-way grouping used by the filter chips (distinct from the 4-way `ItemCategory` used by the Item panel). */
export type MarketCategory = 'battle' | 'field' | 'evo';

interface MarketEntry {
  id: MarketEntryId;
  /** For a regular-item entry: the item bought. Absent for the random ability capsule. */
  itemName?: RegularItemName;
  labelKey: string;
  descriptionKey: string;
  price: number;
  sprite: string;
  category: MarketCategory;
}

interface SellableGroup {
  name: ItemName;
  labelKey: string;
  count: number;
  value: number;
  sprite: string;
}

const CAPSULE_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ability-capsule.png';

const MARKET_ENTRY_CATEGORY: Record<MarketEntryId, MarketCategory> = {
  'potion': 'battle',
  'super-potion': 'battle',
  'hyper-potion': 'battle',
  'x-attack': 'battle',
  'revive': 'battle',
  'honey': 'field',
  'rare-candy': 'evo',
  'ability-capsule': 'evo',
};

/** Filter chip definitions for the Buy tab, in display order. */
const MARKET_FILTERS: ReadonlyArray<{ id: MarketCategory | 'all'; labelKey: string }> = [
  { id: 'all', labelKey: 'market.filterAll' },
  { id: 'battle', labelKey: 'market.filterBattle' },
  { id: 'field', labelKey: 'market.filterField' },
  { id: 'evo', labelKey: 'market.filterEvo' },
];

/**
 * Always-available (outside combat) shop for the New-Experience coin economy.
 * Mirrors StoragePcComponent's modal pattern: a button in the team strip opens an
 * NgbModal of stock rows, each buyable when affordable. Buying spends coins
 * (TrainerService.spendCoins) and bags the item — a random capsule for the
 * capsule row, same payload as the find-ability-capsule wheel, assigned later in
 * the PC. Hidden in Classic mode (no coins exist there) and disabled during
 * battles / the prep panel so a purchase can't react to a shown loss or odds.
 */
@Component({
  selector: 'app-market',
  imports: [NgbTooltipModule, TranslatePipe],
  templateUrl: './market.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './market.component.css'
})
export class MarketComponent implements OnInit, OnDestroy {

  constructor(private trainerService: TrainerService,
              private modalService: NgbModal,
              private gameStateService: GameStateService,
              private itemsService: ItemsService,
              private itemSpriteService: ItemSpriteService,
              private battlePrepService: BattlePrepService,
              private soundFxService: SoundFxService,
              private marketStockService: MarketStockService) {
    this.itemFoundAudio = this.soundFxService.createItemFoundSoundFx();
  }

  @ViewChild('marketModal', { static: true }) marketModal!: TemplateRef<any>;
  @ViewChild('restockConfirmModal', { static: true }) restockConfirmModal!: TemplateRef<any>;

  coins = 0;
  wheelSpinning = false;
  currentGameState!: GameState;
  stock: MarketEntry[] = [];
  sellable: SellableGroup[] = [];
  remaining: Partial<Record<MarketEntryId, number>> = {};
  itemFoundAudio!: SoundFxHandle;
  /** True once the pre-battle prep is confirmed (spin imminent/underway). */
  private prepCommitted = false;

  readonly filters = MARKET_FILTERS;
  activeTab: 'buy' | 'sell' = 'buy';
  activeFilter: MarketCategory | 'all' = 'all';

  /**
   * Battle-family states. Inside these the Market stays open during the pre-Confirm
   * prep phase (so you can kit up for a matchup whose odds you can already see —
   * e.g. buy an X Attack) but closes the instant prep is confirmed, so a purchase
   * can never react to a spin outcome. Outside these it's freely open.
   */
  private readonly combatStates = new Set<GameState>([
    'gym-battle', 'elite-four-battle', 'champion-battle', 'battle-rival', 'elite-four-preparation'
  ]);

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.buildStock();

    this.subscriptions.add(this.trainerService.getCoinsObservable().subscribe(coins => {
      this.coins = coins;
    }));
    this.subscriptions.add(this.gameStateService.wheelSpinningObserver.subscribe(state => {
      this.wheelSpinning = state;
    }));
    this.subscriptions.add(this.gameStateService.currentState.subscribe(state => {
      this.currentGameState = state;
    }));
    this.subscriptions.add(this.battlePrepService.getPendingPrepObservable().subscribe(prep => {
      this.prepCommitted = prep !== null;
    }));
    this.subscriptions.add(this.trainerService.getItemsObservable().subscribe(items => {
      this.sellable = this.buildSellableGroups(items);
    }));
    this.subscriptions.add(this.marketStockService.getStateObservable().subscribe(state => {
      this.remaining = state.remaining;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Whether the whole Market exists this run (coins are New Experience only). */
  get isNewExperienceMode(): boolean {
    return this.gameStateService.isNewExperienceMode;
  }

  /**
   * Openable when a wheel isn't mid-spin and either we're not in a battle state, or
   * we are but still in the pre-Confirm prep phase (no committed prep). This lets you
   * spend coins to prepare for the fight in front of you, but never after committing.
   */
  get isAvailable(): boolean {
    if (!this.isNewExperienceMode || this.wheelSpinning) {
      return false;
    }
    if (this.combatStates.has(this.currentGameState)) {
      return !this.prepCommitted;
    }
    return true;
  }

  openMarket(): void {
    if (!this.isAvailable) {
      return;
    }
    this.activeTab = 'buy';
    this.activeFilter = 'all';
    this.modalService.open(this.marketModal, { centered: true, size: 'lg', windowClass: 'market-modal' });
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  setTab(tab: 'buy' | 'sell'): void {
    this.activeTab = tab;
  }

  setFilter(filter: MarketCategory | 'all'): void {
    this.activeFilter = filter;
  }

  /** Buy list narrowed to the active filter chip; 'all' shows everything. */
  get filteredStock(): MarketEntry[] {
    return this.activeFilter === 'all' ? this.stock : this.stock.filter(entry => entry.category === this.activeFilter);
  }

  canAfford(entry: MarketEntry): boolean {
    return this.coins >= entry.price;
  }

  canBuy(entry: MarketEntry): boolean {
    return this.canAfford(entry) && (this.remaining[entry.id] ?? 0) > 0;
  }

  buy(entry: MarketEntry): void {
    if (!this.canBuy(entry)) {
      return;
    }
    if (!this.trainerService.spendCoins(entry.price)) {
      return;
    }
    if (entry.itemName) {
      this.trainerService.addToItems(this.itemsService.getItem(entry.itemName));
    } else {
      this.trainerService.addToItems(this.randomCapsule());
    }
    this.marketStockService.consume(entry.id);
    void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
  }

  /** Current escalating restock price (`RESTOCK_BASE + RESTOCK_STEP * timesRestocked`). */
  get restockPrice(): number {
    return this.marketStockService.restockPrice();
  }

  get canRestock(): boolean {
    return this.marketStockService.canRestock();
  }

  canAffordRestock(): boolean {
    return this.coins >= this.restockPrice;
  }

  openRestockConfirm(): void {
    if (!this.isAvailable || !this.canRestock || !this.canAffordRestock()) {
      return;
    }
    this.modalService.open(this.restockConfirmModal, { centered: true, size: 'sm', windowClass: 'market-modal' });
  }

  confirmRestock(): void {
    if (!this.trainerService.spendCoins(this.restockPrice)) {
      return;
    }
    this.marketStockService.restockAll();
  }

  sell(group: SellableGroup): void {
    if (!this.isAvailable) {
      return;
    }
    const item = this.trainerService.getItems().find(held => held.name === group.name);
    if (!item) {
      return;
    }
    this.trainerService.removeItem(item);
    this.trainerService.addCoins(group.value);
    void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
  }

  private buildSellableGroups(items: ItemItem[]): SellableGroup[] {
    const groups = new Map<ItemName, SellableGroup>();
    for (const item of items) {
      const value = sellValue(item.name);
      if (value === undefined) {
        continue;
      }
      const existing = groups.get(item.name);
      if (existing) {
        existing.count++;
      } else {
        groups.set(item.name, {
          name: item.name,
          labelKey: `items.${item.name}.name`,
          count: 1,
          value,
          sprite: item.sprite || ''
        });
      }
    }
    return Array.from(groups.values());
  }

  private randomCapsule() {
    const capsules = this.itemsService.getAbilityCapsules();
    return capsules[Math.floor(Math.random() * capsules.length)];
  }

  private buildStock(): void {
    const items: Array<{ id: MarketEntryId; itemName: RegularItemName }> = [
      { id: 'potion', itemName: 'potion' },
      { id: 'super-potion', itemName: 'super-potion' },
      { id: 'honey', itemName: 'honey' },
      { id: 'hyper-potion', itemName: 'hyper-potion' },
      { id: 'x-attack', itemName: 'x-attack' },
      { id: 'rare-candy', itemName: 'rare-candy' },
      { id: 'revive', itemName: 'revive' },
    ];

    this.stock = items.map(({ id, itemName }) => {
      const entry: MarketEntry = {
        id,
        itemName,
        labelKey: `items.${itemName}.name`,
        descriptionKey: `items.${itemName}.description`,
        price: MARKET_PRICES[id],
        sprite: '',
        category: MARKET_ENTRY_CATEGORY[id]
      };
      this.itemSpriteService.getItemSprite(itemName as ItemName)
        .subscribe(response => { entry.sprite = response?.sprite ?? ''; });
      return entry;
    });

    this.stock.push({
      id: 'ability-capsule',
      labelKey: 'market.capsule.name',
      descriptionKey: 'market.capsule.description',
      price: MARKET_PRICES['ability-capsule'],
      sprite: CAPSULE_SPRITE,
      category: MARKET_ENTRY_CATEGORY['ability-capsule']
    });
  }

  /** Swap a broken/blocked item sprite for the local common-item fallback. */
  onSpriteError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(ITEM_SPRITE_FALLBACK)) {
      img.src = ITEM_SPRITE_FALLBACK;
    }
  }
}
