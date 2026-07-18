import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonItem } from '../../../interfaces/pokemon-item';
import { ItemItem } from '../../../interfaces/item-item';
import { PokemonType, getTypeIconUrl } from '../../../interfaces/pokemon-type';
import { RegularItemName } from '../../../services/items-service/regular-item-names';
import { TypeMatchupService } from '../../../services/type-matchup-service/type-matchup.service';

export interface BattlePrepConfirmed {
  leadIndex: number;
  xAttackUsed: boolean;
  potionUsed: RegularItemName | null;
}

/** Weakest to strongest — mirrors BaseBattleRouletteComponent.hasPotions's ranking. */
const POTION_RANKING: RegularItemName[] = ['potion', 'super-potion', 'hyper-potion'];

@Component({
  selector: 'app-battle-prep-panel',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './battle-prep-panel.component.html',
  styleUrl: './battle-prep-panel.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BattlePrepPanelComponent {
  @Input() team: PokemonItem[] = [];
  @Input() opponentTypes: PokemonType[] | undefined;
  @Input() items: ItemItem[] = [];
  @Output() confirmed = new EventEmitter<BattlePrepConfirmed>();

  selectedLeadIndex = 0;
  xAttackSelected = false;
  selectedPotion: RegularItemName | null = null;

  readonly getTypeIconUrl = getTypeIconUrl;

  constructor(private typeMatchupService: TypeMatchupService) {}

  selectLead(index: number): void {
    this.selectedLeadIndex = index;
  }

  getPokemonTypes(pokemon: PokemonItem): PokemonType[] {
    return ([pokemon.type1, pokemon.type2] as Array<PokemonType | null | undefined>)
      .filter((t): t is PokemonType => !!t);
  }

  /** Per-member signed delta preview, before the pick is made. */
  getMemberDelta(pokemon: PokemonItem): number {
    if (!this.opponentTypes?.length) {
      return 0;
    }
    return this.typeMatchupService.getMemberSignedDelta(pokemon, this.opponentTypes);
  }

  hasXAttack(): boolean {
    return this.items.some(item => item.name === 'x-attack');
  }

  toggleXAttack(): void {
    if (!this.hasXAttack()) {
      return;
    }
    this.xAttackSelected = !this.xAttackSelected;
  }

  /** Available potion tiers held, weakest-first (matches inventory display order elsewhere). */
  availablePotionTiers(): RegularItemName[] {
    return POTION_RANKING.filter(name => this.items.some(item => item.name === name));
  }

  togglePotion(name: RegularItemName): void {
    this.selectedPotion = this.selectedPotion === name ? null : name;
  }

  onConfirm(): void {
    this.confirmed.emit({
      leadIndex: this.selectedLeadIndex,
      xAttackUsed: this.xAttackSelected,
      potionUsed: this.selectedPotion,
    });
  }
}
