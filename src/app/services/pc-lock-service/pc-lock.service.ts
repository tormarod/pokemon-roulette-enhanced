import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Holds the New-Experience "PC lockout" threat's pending freeze — while true, the PC
 * storage is locked both directions (no withdraw, no deposit) until the next real battle
 * resolves. Persisted so a reload can't shake it off.
 */
@Injectable({ providedIn: 'root' })
export class PcLockService {
  private locked = new BehaviorSubject<boolean>(false);

  getLockedObservable(): Observable<boolean> {
    return this.locked.asObservable();
  }

  get isLocked(): boolean {
    return this.locked.value;
  }

  setLock(value: boolean): void {
    this.locked.next(value);
  }

  clearLock(): void {
    this.locked.next(false);
  }
}
