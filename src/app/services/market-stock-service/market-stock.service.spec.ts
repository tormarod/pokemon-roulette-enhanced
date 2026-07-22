import { TestBed } from '@angular/core/testing';
import { take } from 'rxjs';

import { MarketStockService } from './market-stock.service';
import { MARKET_STOCK, RESTOCK_BASE, RESTOCK_MAX_USES, RESTOCK_STEP } from '../../main-game/roulette-container/economy-config';

describe('MarketStockService', () => {
  let service: MarketStockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarketStockService);
  });

  it('starts every entry at capacity with no restocks used', () => {
    for (const id of Object.keys(MARKET_STOCK) as (keyof typeof MARKET_STOCK)[]) {
      expect(service.getRemaining(id)).toBe(MARKET_STOCK[id]);
    }
  });

  it('consume decrements and floors at 0', () => {
    const cap = MARKET_STOCK['potion'];
    for (let i = 0; i < cap; i++) {
      service.consume('potion');
    }
    expect(service.getRemaining('potion')).toBe(0);
    service.consume('potion');
    expect(service.getRemaining('potion')).toBe(0);
  });

  it('consume does not affect other entries', () => {
    service.consume('potion');
    expect(service.getRemaining('revive')).toBe(MARKET_STOCK['revive']);
  });

  it('restockAll refills every entry to capacity (never above) and increments the counter', () => {
    service.consume('potion');
    service.consume('potion');
    service.restockAll();

    expect(service.getRemaining('potion')).toBe(MARKET_STOCK['potion']);
    expect(service.canRestock()).toBeTrue();
    expect(service.restockPrice()).toBe(RESTOCK_BASE + RESTOCK_STEP * 1);
  });

  it('restockPrice escalates 60/100/140', () => {
    expect(service.restockPrice()).toBe(RESTOCK_BASE);
    service.restockAll();
    expect(service.restockPrice()).toBe(RESTOCK_BASE + RESTOCK_STEP);
    service.restockAll();
    expect(service.restockPrice()).toBe(RESTOCK_BASE + RESTOCK_STEP * 2);
  });

  it('canRestock is false after RESTOCK_MAX_USES', () => {
    for (let i = 0; i < RESTOCK_MAX_USES; i++) {
      expect(service.canRestock()).toBeTrue();
      service.restockAll();
    }
    expect(service.canRestock()).toBeFalse();
  });

  it('resetForNewRun restores capacity and zeroes the restock counter', () => {
    service.consume('potion');
    service.restockAll();
    service.consume('honey');

    service.resetForNewRun();

    expect(service.getRemaining('potion')).toBe(MARKET_STOCK['potion']);
    expect(service.getRemaining('honey')).toBe(MARKET_STOCK['honey']);
    expect(service.restockPrice()).toBe(RESTOCK_BASE);
    expect(service.canRestock()).toBeTrue();
  });

  it('marketStock round-trips through restore', () => {
    service.consume('potion');
    service.restockAll();
    service.consume('revive');
    let snapshot!: { remaining: Record<string, number>; timesRestocked: number };
    service.getStateObservable().pipe(take(1)).subscribe(s => snapshot = s);

    service.resetForNewRun();
    service.restore(snapshot);

    expect(service.getRemaining('revive')).toBe(MARKET_STOCK['revive'] - 1);
    expect(service.restockPrice()).toBe(RESTOCK_BASE + RESTOCK_STEP);
  });

  it('restore defaults missing fields to caps / 0', () => {
    service.restore(null);
    for (const id of Object.keys(MARKET_STOCK) as (keyof typeof MARKET_STOCK)[]) {
      expect(service.getRemaining(id)).toBe(MARKET_STOCK[id]);
    }
    expect(service.restockPrice()).toBe(RESTOCK_BASE);

    service.restore({ remaining: { potion: 1 } as any });
    expect(service.getRemaining('potion')).toBe(1);
    expect(service.getRemaining('revive')).toBe(MARKET_STOCK['revive']);
    expect(service.restockPrice()).toBe(RESTOCK_BASE);
  });
});
