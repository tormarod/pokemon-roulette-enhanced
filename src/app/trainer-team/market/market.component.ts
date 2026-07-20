import { Component, OnDestroy, OnInit, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, Subscription } from 'rxjs';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { ThemeService } from '../../services/theme-service/theme.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { GameState } from '../../services/game-state-service/game-state';
import { ItemsService } from '../../services/items-service/items.service';
import { ItemSpriteService } from '../../services/item-sprite-service/item-sprite.service';
import { SoundFxHandle, SoundFxService } from '../../services/sound-fx-service/sound-fx.service';
import { ItemName, RegularItemName } from '../../services/items-service/item-names';
import { MARKET_PRICES, MarketEntryId } from '../../main-game/roulette-container/economy-config';

interface MarketEntry {
  id: MarketEntryId;
  /** For a regular-item entry: the item bought. Absent for the random ability capsule. */
  itemName?: RegularItemName;
  labelKey: string;
  descriptionKey: string;
  price: number;
  sprite: string;
}

const CAPSULE_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ability-capsule.png';

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
  imports: [CommonModule, NgbTooltipModule, TranslatePipe],
  templateUrl: './market.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './market.component.css'
})
export class MarketComponent implements OnInit, OnDestroy {

  constructor(private trainerService: TrainerService,
              private themeService: ThemeService,
              private modalService: NgbModal,
              private gameStateService: GameStateService,
              private itemsService: ItemsService,
              private itemSpriteService: ItemSpriteService,
              private soundFxService: SoundFxService) {
    this.itemFoundAudio = this.soundFxService.createItemFoundSoundFx();
  }

  @ViewChild('marketModal', { static: true }) marketModal!: TemplateRef<any>;

  darkMode!: Observable<boolean>;
  coins = 0;
  wheelSpinning = false;
  currentGameState!: GameState;
  stock: MarketEntry[] = [];
  itemFoundAudio!: SoundFxHandle;

  /** States where the Market is closed — every battle plus the Elite Four prep gate. */
  private readonly combatStates = new Set<GameState>([
    'gym-battle', 'elite-four-battle', 'champion-battle', 'battle-rival', 'elite-four-preparation'
  ]);

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.darkMode = this.themeService.isDark$;
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
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Whether the whole Market exists this run (coins are New Experience only). */
  get isNewExperienceMode(): boolean {
    return this.gameStateService.isNewExperienceMode;
  }

  /** Openable only outside combat and while no wheel is mid-spin. */
  get isAvailable(): boolean {
    return this.isNewExperienceMode && !this.wheelSpinning && !this.combatStates.has(this.currentGameState);
  }

  openMarket(): void {
    if (!this.isAvailable) {
      return;
    }
    this.modalService.open(this.marketModal, { centered: true, size: 'lg' });
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  canAfford(entry: MarketEntry): boolean {
    return this.coins >= entry.price;
  }

  buy(entry: MarketEntry): void {
    if (!this.trainerService.spendCoins(entry.price)) {
      return;
    }
    if (entry.itemName) {
      this.trainerService.addToItems(this.itemsService.getItem(entry.itemName));
    } else {
      this.trainerService.addToItems(this.randomCapsule());
    }
    void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
  }

  private randomCapsule() {
    const capsules = this.itemsService.getAbilityCapsules();
    return capsules[Math.floor(Math.random() * capsules.length)];
  }

  private buildStock(): void {
    const items: Array<{ id: MarketEntryId; itemName: RegularItemName }> = [
      { id: 'potion', itemName: 'potion' },
      { id: 'super-potion', itemName: 'super-potion' },
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
        sprite: ''
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
      sprite: CAPSULE_SPRITE
    });
  }
}
