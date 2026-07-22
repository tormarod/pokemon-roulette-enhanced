import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  MARKET_STOCK,
  MarketEntryId,
  RESTOCK_BASE,
  RESTOCK_MAX_USES,
  RESTOCK_STEP,
} from '../../main-game/roulette-container/economy-config';

export interface MarketStockState {
  remaining: Record<MarketEntryId, number>;
  timesRestocked: number;
}

function fullStock(): Record<MarketEntryId, number> {
  return { ...MARKET_STOCK };
}

/**
 * Per-run Market stock: each entry starts at `MARKET_STOCK` capacity and only
 * depletes — round advance does NOT refill it (the scarcity). The only refill
 * is the paid `restockAll()` action, which is very expensive, escalating, and
 * capped at `RESTOCK_MAX_USES` per run (see docs/plans/economy-market-reconciliation.md
 * Phase 3). Persisted via `RunPersistenceService` like any other run state —
 * a reload must not refresh stock or reset the restock counter.
 */
@Injectable({ providedIn: 'root' })
export class MarketStockService {
  private state = new BehaviorSubject<MarketStockState>({
    remaining: fullStock(),
    timesRestocked: 0,
  });

  getStateObservable(): Observable<MarketStockState> {
    return this.state.asObservable();
  }

  getRemaining(id: MarketEntryId): number {
    return this.state.value.remaining[id];
  }

  /** Decrements stock for `id`, floored at 0 (no-op if already sold out). */
  consume(id: MarketEntryId): void {
    const current = this.state.value;
    if (current.remaining[id] <= 0) {
      return;
    }
    this.state.next({
      ...current,
      remaining: { ...current.remaining, [id]: current.remaining[id] - 1 },
    });
  }

  /** Refills every entry back to its capacity (never above) and counts the use. */
  restockAll(): void {
    const current = this.state.value;
    this.state.next({
      remaining: fullStock(),
      timesRestocked: current.timesRestocked + 1,
    });
  }

  restockPrice(): number {
    return RESTOCK_BASE + RESTOCK_STEP * this.state.value.timesRestocked;
  }

  canRestock(): boolean {
    return this.state.value.timesRestocked < RESTOCK_MAX_USES;
  }

  resetForNewRun(): void {
    this.state.next({ remaining: fullStock(), timesRestocked: 0 });
  }

  /** Restores persisted state; a missing/undefined id defaults to capacity. */
  restore(record: Partial<MarketStockState> | null | undefined): void {
    const remaining = fullStock();
    if (record?.remaining) {
      for (const id of Object.keys(remaining) as MarketEntryId[]) {
        const value = record.remaining[id];
        if (typeof value === 'number') {
          remaining[id] = value;
        }
      }
    }
    this.state.next({
      remaining,
      timesRestocked: record?.timesRestocked ?? 0,
    });
  }
}
