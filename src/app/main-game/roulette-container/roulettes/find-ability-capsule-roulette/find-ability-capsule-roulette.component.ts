import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { ItemsService } from '../../../../services/items-service/items.service';
import { ItemItem } from '../../../../interfaces/item-item';
import { SoundFxHandle, SoundFxService } from '../../../../services/sound-fx-service/sound-fx.service';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { EventPopupComponent } from '../../../../event-popup/event-popup.component';

/**
 * New-Experience-only wheel that awards a single ability capsule. Mirrors
 * FindItemRouletteComponent, but spins over `getAbilityCapsules()` and emits the
 * chosen capsule (an ItemItem with an `abilityId`) for the container to bag.
 * Capsule sprites are baked into the data, so no sprite fetch is needed.
 */
@Component({
  selector: 'app-find-ability-capsule-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe
  ],
  templateUrl: './find-ability-capsule-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './find-ability-capsule-roulette.component.css'
})
export class FindAbilityCapsuleRouletteComponent {

  constructor(private modalQueueService: ModalQueueService,
    private itemService: ItemsService,
    private soundFxService: SoundFxService,
    private translateService: TranslateService) {
    this.capsules = itemService.getAbilityCapsules();
    this.itemFoundAudio = this.soundFxService.createItemFoundSoundFx();
  }

  capsules: ItemItem[] = [];
  selectedCapsule: ItemItem | null = null;
  @Output() capsuleSelectedEvent = new EventEmitter<ItemItem>();
  itemFoundAudio!: SoundFxHandle;

  onCapsuleSelected(index: number): void {
    this.selectedCapsule = this.capsules[index];
    void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
    void this.openCapsuleExplainerModal();
  }

  private async openCapsuleExplainerModal(): Promise<void> {
    if (!this.selectedCapsule) return;
    const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal', keyboard: false });
    modalRef.componentInstance.title = `${this.translateService.instant('game.main.roulette.abilityCapsule.found')} ${this.translateService.instant(this.selectedCapsule.text)}`;
    modalRef.componentInstance.images = [{ src: this.selectedCapsule.sprite ?? '', height: 64 }];
    modalRef.componentInstance.lines = [this.translateService.instant(this.selectedCapsule.description)];
    modalRef.componentInstance.hintLine = this.translateService.instant('game.main.roulette.abilityCapsule.assignHint');
    modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
    const emit = () => { if (this.selectedCapsule) this.capsuleSelectedEvent.emit(this.selectedCapsule); };
    modalRef.result.then(emit, emit);
  }
}
