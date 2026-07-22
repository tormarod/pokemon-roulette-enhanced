import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { Observable, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ItemItem } from '../interfaces/item-item';
import { CommonModule } from '@angular/common';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TrainerService } from '../services/trainer-service/trainer.service';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import { isMegaStoneItemName } from '../services/items-service/item-names';
import { ITEM_SPRITE_FALLBACK } from '../services/item-sprite-service/item-sprite.service';

@Component({
  selector: 'app-items',
  imports: [CommonModule,
    NgbTooltipModule, TranslatePipe],
  templateUrl: './items.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './items.component.css'
})
export class ItemsComponent implements OnInit, OnDestroy {

  constructor(
    private darkModeService: DarkModeService,
    private themeService: ThemeService,
    private trainerService: TrainerService,
    private translateService: TranslateService
  ) {
    this.darkMode = this.themeService.isDark$;
    this.darkMode.pipe(takeUntilDestroyed()).subscribe(v => this.isDark = v);
  }

  trainerItems!: ItemItem[];
  @Output() rareCandyInterrupt = new EventEmitter<ItemItem>();
  @Output() megaStoneInterrupt = new EventEmitter<ItemItem>();
  @Output() typeBiasItemInterrupt = new EventEmitter<ItemItem>();
  @Output() linkCableInterrupt = new EventEmitter<ItemItem>();
  @Output() threatShieldInterrupt = new EventEmitter<ItemItem>();

  private static readonly TYPE_BIAS_ITEM_NAMES = new Set(['honey', 'poke-radar']);
  private static readonly THREAT_SHIELD_ITEM_NAMES = new Set(['repel', 'max-repel']);

  darkMode!: Observable<boolean>;
  isDark = false;
  private itemsSubscription!: Subscription;

  ngOnInit(): void {
    this.itemsSubscription = this.trainerService.getItemsObservable().subscribe(items => {
      this.trainerItems = items;
    })
  }

  ngOnDestroy(): void {
    this.itemsSubscription?.unsubscribe();
  }

  useItem(item: ItemItem | undefined) {
    if(item) {
      if (item.name === 'rare-candy') {
        this.rareCandyInterrupt.emit(item);
      } else if (isMegaStoneItemName(item.name)) {
        this.megaStoneInterrupt.emit(item);
      } else if (item.name === 'link-cable') {
        this.linkCableInterrupt.emit(item);
      } else if (ItemsComponent.THREAT_SHIELD_ITEM_NAMES.has(item.name)) {
        this.threatShieldInterrupt.emit(item);
      } else if (ItemsComponent.TYPE_BIAS_ITEM_NAMES.has(item.name)) {
        this.typeBiasItemInterrupt.emit(item);
      }
    }
  }

  getItemSprite(index: number): string {
    const item = this.trainerItems[index];
    if (!item) {
      // Empty slot — keep the transparent placeholder, not an item icon.
      return './place-holder-pixel.png';
    }
    // Present item whose sprite never resolved: show the common-item fallback.
    return item.sprite ? item.sprite : ITEM_SPRITE_FALLBACK;
  }

  /** Swap a broken/blocked item sprite for the local common-item fallback. */
  onSpriteError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(ITEM_SPRITE_FALLBACK)) {
      img.src = ITEM_SPRITE_FALLBACK;
    }
  }

  getItemText(index: number): string {
    const item = this.trainerItems[index];
    if (item) {
      const name = this.translateService.instant(item.text);
      const description = this.translateService.instant(item.description);
      return `${name} — ${description}`;
    }
    return 'Empty';
  }
}
