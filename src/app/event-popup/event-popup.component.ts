import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { EventPopupImage } from '../interfaces/event-popup-image';
import { EventPopupButtonConfig } from '../interfaces/event-popup-button';

/**
 * Shared card for every gameplay event/announcement popup and confirm dialog
 * (evolutions, threats, rewards, battle intros, restart/reset confirms, etc).
 * Always opened as a component (not a TemplateRef) with
 * windowClass: 'event-popup-modal' so src/styles.css can theme it (see the
 * body.theme-* rules there). Callers pre-resolve every string via
 * translateService.instant(...) before setting inputs — this component does
 * no translation of its own.
 */
@Component({
  selector: 'app-event-popup',
  standalone: true,
  imports: [],
  templateUrl: './event-popup.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './event-popup.component.css'
})
export class EventPopupComponent {
  @Input() title = '';
  /** 0, 1, or 2 tiles. images[0] renders before the message box, images[1] after (evolution/trade-style flanking). */
  @Input() images: EventPopupImage[] = [];
  @Input() lines: string[] = [];
  /** Optional smaller/italic trailing line (e.g. ability-capsule's "assign later" hint). */
  @Input() hintLine?: string;
  @Input() buttons: EventPopupButtonConfig[] = [];

  constructor(public activeModal: NgbActiveModal) {}

  /** Closes with the clicked button's index so 2-button callers can branch (see restart/stats/market restock). */
  onButtonClick(index: number): void {
    this.activeModal.close(index);
  }
}
