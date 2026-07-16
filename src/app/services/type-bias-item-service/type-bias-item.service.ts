import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ItemItem } from '../../interfaces/item-item';

@Injectable({
  providedIn: 'root'
})
export class TypeBiasItemService {
  private typeBiasItemTriggerSubject = new Subject<ItemItem>();

  get typeBiasItemTrigger$() {
    return this.typeBiasItemTriggerSubject.asObservable();
  }

  triggerTypeBiasItem(item: ItemItem): void {
    this.typeBiasItemTriggerSubject.next(item);
  }
}
