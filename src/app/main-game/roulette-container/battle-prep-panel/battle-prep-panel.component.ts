import { Component, EventEmitter, Input, OnChanges, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonItem } from '../../../interfaces/pokemon-item';
import { ItemItem } from '../../../interfaces/item-item';
import { PokemonType, getTypeIconUrl } from '../../../interfaces/pokemon-type';
import { TypeMatchupService } from '../../../services/type-matchup-service/type-matchup.service';

export interface BattlePrepConfirmed {
  leadIndex: number;
  xAttackUsed: boolean;
}

@Component({
  selector: 'app-battle-prep-panel',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './battle-prep-panel.component.html',
  styleUrl: './battle-prep-panel.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BattlePrepPanelComponent implements OnChanges {
  @Input() team: PokemonItem[] = [];
  @Input() opponentTypes: PokemonType[] | undefined;
  @Input() items: ItemItem[] = [];
  /** New Experience only: team index the "markedTarget" threat has forced to lead this battle. */
  @Input() forcedIndex: number | null = null;
  @Output() confirmed = new EventEmitter<BattlePrepConfirmed>();

  selectedLeadIndex = 0;
  xAttackSelected = false;

  readonly getTypeIconUrl = getTypeIconUrl;

  constructor(private typeMatchupService: TypeMatchupService) {}

  ngOnChanges(): void {
    if (this.forcedIndex !== null) {
      this.selectedLeadIndex = this.forcedIndex;
    }
  }

  selectLead(index: number): void {
    if (this.forcedIndex !== null) {
      return;
    }
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

  onConfirm(): void {
    this.confirmed.emit({
      leadIndex: this.selectedLeadIndex,
      xAttackUsed: this.xAttackSelected,
    });
  }
}
