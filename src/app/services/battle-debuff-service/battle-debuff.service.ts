import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Holds the New-Experience "bad omen" threat's pending battle debuff — extra
 * No tickets added to the very next battle's odds, then cleared once that
 * battle resolves. Persisted so a reload can't shake off the omen.
 */
@Injectable({
  providedIn: 'root'
})
export class BattleDebuffService {
  private pendingDebuff = new BehaviorSubject<number>(0);

  getPendingDebuffObservable(): Observable<number> {
    return this.pendingDebuff.asObservable();
  }

  get currentDebuff(): number {
    return this.pendingDebuff.value;
  }

  setDebuff(amount: number): void {
    this.pendingDebuff.next(amount);
  }

  clearDebuff(): void {
    this.pendingDebuff.next(0);
  }

  restoreDebuff(amount: number): void {
    this.pendingDebuff.next(amount);
  }
}
