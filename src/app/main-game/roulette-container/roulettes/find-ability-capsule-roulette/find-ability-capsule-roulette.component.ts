import { Component, EventEmitter, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { ItemsService } from '../../../../services/items-service/items.service';
import { ItemItem } from '../../../../interfaces/item-item';
import { SoundFxHandle, SoundFxService } from '../../../../services/sound-fx-service/sound-fx.service';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';

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

  constructor(private modalService: NgbModal,
    private modalQueueService: ModalQueueService,
    private itemService: ItemsService,
    private soundFxService: SoundFxService) {
    this.capsules = itemService.getAbilityCapsules();
    this.itemFoundAudio = this.soundFxService.createItemFoundSoundFx();
  }

  @ViewChild('capsuleExplainerModal', { static: true }) capsuleExplainerModal!: TemplateRef<any>;
  capsules: ItemItem[] = [];
  selectedCapsule: ItemItem | null = null;
  @Output() capsuleSelectedEvent = new EventEmitter<ItemItem>();
  itemFoundAudio!: SoundFxHandle;

  onCapsuleSelected(index: number): void {
    this.selectedCapsule = this.capsules[index];

    void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);

    this.modalQueueService.open(this.capsuleExplainerModal, {
      centered: true,
      size: 'md',
      keyboard: false
    }).then(modalRef => {
      const emit = () => {
        if (this.selectedCapsule) {
          this.capsuleSelectedEvent.emit(this.selectedCapsule);
        }
      };
      modalRef.result.then(emit, emit);
    });
  }

  closeCapsuleExplainerModal(): void {
    this.modalService.dismissAll();
  }
}
