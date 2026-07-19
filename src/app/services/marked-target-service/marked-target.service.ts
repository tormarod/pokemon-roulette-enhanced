import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Holds the New-Experience "marked target" threat's pending team-index lock —
 * that team member can't be picked as lead in the next real battle's prep
 * screen, then clears once that battle resolves. Persisted so a reload can't
 * shake off the mark. Tracked by team index at mark time (like leadIndex),
 * not object identity — acceptable because nothing reorders the team between
 * a threat draw and the following battle's prep screen.
 */
@Injectable({ providedIn: 'root' })
export class MarkedTargetService {
  private pendingMark = new BehaviorSubject<number | null>(null);

  getPendingMarkObservable(): Observable<number | null> {
    return this.pendingMark.asObservable();
  }

  get currentMarkedIndex(): number | null {
    return this.pendingMark.value;
  }

  setMark(index: number): void {
    this.pendingMark.next(index);
  }

  clearMark(): void {
    this.pendingMark.next(null);
  }

  restoreMark(index: number | null): void {
    this.pendingMark.next(index);
  }
}
