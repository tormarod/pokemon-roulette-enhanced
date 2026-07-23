import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { ItemItem } from '../interfaces/item-item';
import { Observable, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { isMegaStoneItemName, isAbilityCapsuleName } from '../services/items-service/item-names';
import { ITEM_SPRITE_FALLBACK } from '../services/item-sprite-service/item-sprite.service';
import { getItemCategory, ItemCategory } from '../services/items-service/item-category';

interface CategorizedItemEntry {
  item: ItemItem;
  /** Index into trainerItems — identifies this exact owned instance for hover/click. */
  index: number;
}

interface ItemCategoryGroup {
  id: ItemCategory;
  labelKey: string;
  entries: CategorizedItemEntry[];
}

const CATEGORY_LABEL_KEYS: Record<ItemCategory, string> = {
  battle: 'items.category.battleAids',
  field: 'items.category.fieldItems',
  mega: 'items.category.megaStones',
  capsule: 'items.category.abilityCapsules',
};

/** Fixed display order for the 2x2 category grid — empty categories are filtered out, not left blank. */
const CATEGORY_ORDER: ItemCategory[] = ['battle', 'field', 'mega', 'capsule'];

@Component({
  selector: 'app-items',
  imports: [CommonModule, TranslatePipe],
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
  /** Index (into trainerItems) currently hovered — drives the name/description popover. */
  hoveredItemIndex: number | null = null;
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

  /** Owned items grouped into the 4 display categories, empty categories omitted. */
  get categories(): ItemCategoryGroup[] {
    const groups: Record<ItemCategory, CategorizedItemEntry[]> = { battle: [], field: [], mega: [], capsule: [] };
    (this.trainerItems ?? []).forEach((item, index) => {
      groups[getItemCategory(item.name)].push({ item, index });
    });
    return CATEGORY_ORDER
      .filter(id => groups[id].length > 0)
      .map(id => ({ id, labelKey: CATEGORY_LABEL_KEYS[id], entries: groups[id] }));
  }

  isCapsule(item: ItemItem): boolean {
    return isAbilityCapsuleName(item.name);
  }

  /** Ability capsules have no per-ability sprite — a flat two-tone pill colored by the ability's flavor type instead. */
  getCapsuleGlyphBackground(item: ItemItem): string {
    return `linear-gradient(to right, #fff 50%, ${item.fillStyle} 50%)`;
  }

  getItemSprite(item: ItemItem): string {
    return item.sprite ? item.sprite : ITEM_SPRITE_FALLBACK;
  }

  /** Swap a broken/blocked item sprite for the local common-item fallback. */
  onSpriteError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(ITEM_SPRITE_FALLBACK)) {
      img.src = ITEM_SPRITE_FALLBACK;
    }
  }

  getItemName(item: ItemItem): string {
    return this.translateService.instant(item.text);
  }

  getItemDescription(item: ItemItem): string {
    return this.translateService.instant(item.description);
  }

  setHoveredItem(index: number | null): void {
    this.hoveredItemIndex = index;
  }
}
