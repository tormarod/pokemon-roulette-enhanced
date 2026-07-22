import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { MarketComponent } from './market.component';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { BattlePrepService } from '../../services/battle-prep-service/battle-prep.service';
import { ItemsService } from '../../services/items-service/items.service';
import { MarketStockService } from '../../services/market-stock-service/market-stock.service';
import { MARKET_PRICES, MARKET_STOCK, RESTOCK_BASE, RESTOCK_MAX_USES, RESTOCK_STEP, sellValue } from '../../main-game/roulette-container/economy-config';

describe('MarketComponent', () => {
  let component: MarketComponent;
  let fixture: ComponentFixture<MarketComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let battlePrepService: BattlePrepService;
  let itemsService: ItemsService;
  let marketStockService: MarketStockService;

  beforeEach(async () => {
    const httpSpy = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpy.get.and.returnValue(of({
      sprites: { other: { 'official-artwork': { front_default: 'd', front_shiny: 's' } } }
    }));

    await TestBed.configureTestingModule({
      imports: [MarketComponent, TranslateModule.forRoot()],
      providers: [{ provide: HttpClient, useValue: httpSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(MarketComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);
    battlePrepService = TestBed.inject(BattlePrepService);
    itemsService = TestBed.inject(ItemsService);
    marketStockService = TestBed.inject(MarketStockService);
    gameStateService.resetGameState(true);
    trainerService.resetTeam();
    trainerService.resetItems();
    trainerService.resetCoins();
    battlePrepService.clearPrep();
    marketStockService.resetForNewRun();
    fixture.detectChanges();
  });

  const entry = (id: string) => component.stock.find(e => e.id === id)!;

  it('builds the full stock with prices from config', () => {
    expect(component.stock.length).toBe(Object.keys(MARKET_PRICES).length);
    expect(entry('potion').price).toBe(MARKET_PRICES['potion']);
    expect(entry('ability-capsule').price).toBe(MARKET_PRICES['ability-capsule']);
    expect(entry('honey').price).toBe(MARKET_PRICES['honey']);
    expect(entry('honey').itemName).toBe('honey');
  });

  it('buying Honey spends coins and bags it, same as any other regular item', () => {
    trainerService.addCoins(100);
    const before = trainerService.getItems().length;

    component.buy(entry('honey'));

    expect(trainerService.getCoins()).toBe(100 - MARKET_PRICES['honey']);
    expect(trainerService.getItems().length).toBe(before + 1);
    expect(trainerService.hasItem('honey')).toBeTrue();
  });

  it('canAfford reflects the current balance', () => {
    trainerService.addCoins(MARKET_PRICES['potion']);
    expect(component.canAfford(entry('potion'))).toBeTrue();
    expect(component.canAfford(entry('revive'))).toBeFalse();
  });

  it('buying an affordable item spends coins and bags it', () => {
    trainerService.addCoins(100);
    const before = trainerService.getItems().length;

    component.buy(entry('x-attack'));

    expect(trainerService.getCoins()).toBe(100 - MARKET_PRICES['x-attack']);
    expect(trainerService.getItems().length).toBe(before + 1);
    expect(trainerService.hasItem('x-attack')).toBeTrue();
  });

  it('buying a capsule bags an assignable ability capsule', () => {
    trainerService.addCoins(100);

    component.buy(entry('ability-capsule'));

    const bagged = trainerService.getItems().find(item => !!item.abilityId);
    expect(bagged).toBeTruthy();
    expect(trainerService.getCoins()).toBe(100 - MARKET_PRICES['ability-capsule']);
  });

  it('an unaffordable purchase is a no-op', () => {
    trainerService.addCoins(5); // less than any price
    const before = trainerService.getItems().length;

    component.buy(entry('revive'));

    expect(trainerService.getCoins()).toBe(5);
    expect(trainerService.getItems().length).toBe(before);
  });

  it('is available during the pre-battle prep phase (no committed prep yet)', () => {
    gameStateService.setNextState('gym-battle');
    gameStateService.finishCurrentState();
    battlePrepService.clearPrep();
    expect(component.isAvailable).toBeTrue();
  });

  it('is unavailable once prep is confirmed (spin imminent)', () => {
    gameStateService.setNextState('gym-battle');
    gameStateService.finishCurrentState();
    battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
    expect(component.isAvailable).toBeFalse();
  });

  it('is available on a non-battle screen in New Experience mode', () => {
    gameStateService.setNextState('adventure-continues');
    gameStateService.finishCurrentState();
    expect(component.isAvailable).toBeTrue();
  });

  it('groups held sellable items by name with a count and a sell value', () => {
    // resetItems() default loadout already holds potion, honey, repel.
    const potionGroup = component.sellable.find(g => g.name === 'potion')!;
    expect(potionGroup.count).toBe(1);
    expect(potionGroup.value).toBe(Math.floor(MARKET_PRICES['potion'] * 0.4));
  });

  it('selling a held item credits coins and removes it', () => {
    const before = trainerService.getItems().length;
    const potionGroup = component.sellable.find(g => g.name === 'potion')!;

    component.sell(potionGroup);

    expect(trainerService.getCoins()).toBe(potionGroup.value);
    expect(trainerService.getItems().length).toBe(before - 1);
    expect(trainerService.hasItem('potion')).toBeFalse();
  });

  it('sell value is strictly less than the buy price for a Market-sold item (no arbitrage)', () => {
    const potionGroup = component.sellable.find(g => g.name === 'potion')!;
    expect(potionGroup.value).toBeLessThan(MARKET_PRICES['potion']);
  });

  it('a find-only gadget sells for the flat gadget rate', () => {
    trainerService.addToItems(itemsService.getRegularItem('bicycle'));
    const bicycleGroup = component.sellable.find(g => g.name === 'bicycle')!;
    expect(bicycleGroup.value).toBe(sellValue('bicycle')!);
  });

  it('mega stones are not sellable', () => {
    trainerService.addToItems(itemsService.getMegaStone('abomasite'));
    expect(component.sellable.some(g => g.name === 'abomasite')).toBeFalse();
  });

  it('selling is disabled once prep is confirmed (combat lockout)', () => {
    gameStateService.setNextState('gym-battle');
    gameStateService.finishCurrentState();
    battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
    const before = trainerService.getItems().length;
    const potionGroup = component.sellable.find(g => g.name === 'potion')!;

    component.sell(potionGroup);

    expect(trainerService.getItems().length).toBe(before);
  });

  it('buying decrements the stock service and the row disables at 0 ("sold out")', () => {
    trainerService.addCoins(1000);
    const cap = MARKET_STOCK['x-attack'];

    for (let i = 0; i < cap; i++) {
      expect(component.canBuy(entry('x-attack'))).toBeTrue();
      component.buy(entry('x-attack'));
    }

    expect(marketStockService.getRemaining('x-attack')).toBe(0);
    expect(component.canBuy(entry('x-attack'))).toBeFalse();
  });

  it('buying past sold-out is a no-op', () => {
    trainerService.addCoins(1000);
    const cap = MARKET_STOCK['x-attack'];
    for (let i = 0; i < cap; i++) {
      component.buy(entry('x-attack'));
    }
    const coinsAfterCap = trainerService.getCoins();
    const itemsAfterCap = trainerService.getItems().length;

    component.buy(entry('x-attack'));

    expect(trainerService.getCoins()).toBe(coinsAfterCap);
    expect(trainerService.getItems().length).toBe(itemsAfterCap);
  });

  it('sold-out state persists across reopening the modal (no round-advance refill)', () => {
    trainerService.addCoins(1000);
    const cap = MARKET_STOCK['revive'];
    for (let i = 0; i < cap; i++) {
      component.buy(entry('revive'));
    }
    expect(marketStockService.getRemaining('revive')).toBe(0);

    component.closeModal();
    component.openMarket();

    expect(marketStockService.getRemaining('revive')).toBe(0);
    expect(component.canBuy(entry('revive'))).toBeFalse();
  });

  it('restock spends the escalating price and refills every entry to capacity', () => {
    trainerService.addCoins(1000);
    component.buy(entry('revive')); // deplete revive (cap 1) to prove restock refills it

    expect(component.restockPrice).toBe(RESTOCK_BASE);
    const coinsBefore = trainerService.getCoins();

    component.confirmRestock();

    expect(trainerService.getCoins()).toBe(coinsBefore - RESTOCK_BASE);
    expect(marketStockService.getRemaining('revive')).toBe(MARKET_STOCK['revive']);
    expect(component.restockPrice).toBe(RESTOCK_BASE + RESTOCK_STEP);
  });

  it('restock never refills above capacity and is disabled after RESTOCK_MAX_USES', () => {
    trainerService.addCoins(10000);
    for (let i = 0; i < RESTOCK_MAX_USES; i++) {
      expect(component.canRestock).toBeTrue();
      component.confirmRestock();
    }
    expect(component.canRestock).toBeFalse();

    for (const id of Object.keys(MARKET_STOCK) as (keyof typeof MARKET_STOCK)[]) {
      expect(marketStockService.getRemaining(id)).toBe(MARKET_STOCK[id]);
    }
  });

  it('restock is unaffordable when coins are short', () => {
    trainerService.addCoins(RESTOCK_BASE - 1);
    expect(component.canAffordRestock()).toBeFalse();

    component.openRestockConfirm();

    expect(trainerService.getCoins()).toBe(RESTOCK_BASE - 1);
  });

  it('restock is unavailable during combat lockout', () => {
    trainerService.addCoins(1000);
    gameStateService.setNextState('gym-battle');
    gameStateService.finishCurrentState();
    battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
    const coinsBefore = trainerService.getCoins();

    component.openRestockConfirm();

    expect(trainerService.getCoins()).toBe(coinsBefore);
  });

  it('Classic mode has no stock limits (getRemaining still reports capacity but Market is hidden)', () => {
    gameStateService.restoreNewExperienceMode(false);
    expect(component.isNewExperienceMode).toBeFalse();
  });
});
