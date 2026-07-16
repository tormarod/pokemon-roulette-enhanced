import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ItemItem } from '../../interfaces/item-item';

@Injectable({
  providedIn: 'root'
})
export class LinkCableService {
  private linkCableTriggerSubject = new Subject<ItemItem>();

  get linkCableTrigger$() {
    return this.linkCableTriggerSubject.asObservable();
  }

  triggerLinkCable(item: ItemItem): void {
    this.linkCableTriggerSubject.next(item);
  }
}
