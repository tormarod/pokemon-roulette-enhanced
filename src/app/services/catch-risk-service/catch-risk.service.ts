import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Holds the New-Experience "poké ball malfunction" threat's pending escape
 * chance (0 = none) for the very next catch attempt, then clears once that
 * attempt resolves (whether it succeeds or the Pokémon escapes). Persisted so
 * a reload can't shake it off.
 */
@Injectable({ providedIn: 'root' })
export class CatchRiskService {
  private pendingEscapeChance = new BehaviorSubject<number>(0);

  getPendingEscapeChanceObservable(): Observable<number> {
    return this.pendingEscapeChance.asObservable();
  }

  get currentEscapeChance(): number {
    return this.pendingEscapeChance.value;
  }

  setEscapeChance(chance: number): void {
    this.pendingEscapeChance.next(chance);
  }

  clearEscapeChance(): void {
    this.pendingEscapeChance.next(0);
  }

  restoreEscapeChance(chance: number): void {
    this.pendingEscapeChance.next(chance);
  }
}
