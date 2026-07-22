import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ItemItem } from '../../interfaces/item-item';

@Injectable({
  providedIn: 'root'
})
export class ThreatShieldService {
  private threatShieldTriggerSubject = new Subject<ItemItem>();

  get threatShieldTrigger$() {
    return this.threatShieldTriggerSubject.asObservable();
  }

  triggerThreatShield(item: ItemItem): void {
    this.threatShieldTriggerSubject.next(item);
  }
}
