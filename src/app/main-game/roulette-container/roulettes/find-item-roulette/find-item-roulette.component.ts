import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { ItemsService } from '../../../../services/items-service/items.service';
import { ItemSpriteService, ITEM_SPRITE_FALLBACK } from '../../../../services/item-sprite-service/item-sprite.service';
import { ItemItem } from '../../../../interfaces/item-item';
import { SoundFxHandle, SoundFxService } from '../../../../services/sound-fx-service/sound-fx.service';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { EventPopupComponent } from '../../../../event-popup/event-popup.component';

@Component({
  selector: 'app-find-item-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe
  ],
  templateUrl: './find-item-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './find-item-roulette.component.css'
})
export class FindItemRouletteComponent {

  constructor(private modalQueueService: ModalQueueService,
    private itemService: ItemsService,
    private itemSpriteService: ItemSpriteService,
    private soundFxService: SoundFxService,
    private translateService: TranslateService) {
    this.items = itemService.getFindableItems();
    this.itemFoundAudio = this.soundFxService.createItemFoundSoundFx();
  }

  items: ItemItem[] = [];
  selectedItem: ItemItem | null = null;
  @Output() itemSelectedEvent = new EventEmitter<ItemItem>();
  itemFoundAudio!: SoundFxHandle;

  onItemSelected(index: number): void {
    this.selectedItem = this.items[index];

    this.itemSpriteService.getItemSprite(this.selectedItem.name).pipe(take(1)).subscribe(response => {
      if (this.selectedItem && response) {
        this.selectedItem.sprite = response.sprite;
      }
    });

    void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
    void this.openItemExplainerModal();
  }

  private async openItemExplainerModal(): Promise<void> {
    if (!this.selectedItem) return;
    const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal', keyboard: false });
    modalRef.componentInstance.title = `${this.translateService.instant('game.main.roulette.item.found')} ${this.translateService.instant(this.selectedItem.text)}`;
    modalRef.componentInstance.images = [{ src: this.selectedItem.sprite || ITEM_SPRITE_FALLBACK, height: 64 }];
    modalRef.componentInstance.lines = [this.translateService.instant(this.selectedItem.description)];
    modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
    const emit = () => { if (this.selectedItem) this.itemSelectedEvent.emit(this.selectedItem); };
    modalRef.result.then(emit, emit);
  }
}
