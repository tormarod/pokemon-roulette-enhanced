import { Component, EventEmitter, Input, OnChanges, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonItem } from '../../../interfaces/pokemon-item';
import { ItemItem } from '../../../interfaces/item-item';
import { PokemonType, getTypeIconUrl } from '../../../interfaces/pokemon-type';
import { TypeMatchupService } from '../../../services/type-matchup-service/type-matchup.service';
import { BattleOddsService, BattleOddsBreakdown } from '../../../services/battle-odds-service/battle-odds.service';
import { BattleDebuffService } from '../../../services/battle-debuff-service/battle-debuff.service';
import { GameStateService } from '../../../services/game-state-service/game-state.service';

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
  /** Battle type's base No-ticket count (gym 1, elite 2, champion 3, rival 1) — feeds the live odds preview. */
  @Input() baseNoCount = 1;
  @Input() currentRound = 0;
  @Output() confirmed = new EventEmitter<BattlePrepConfirmed>();

  selectedLeadIndex = 0;
  xAttackSelected = false;
  /** Live preview of the odds the wheel will be built with on confirm — same computeOdds() call as buildVictoryOdds(), so it never drifts from the real wheel. */
  oddsPreview: BattleOddsBreakdown | null = null;

  readonly getTypeIconUrl = getTypeIconUrl;

  constructor(
    private typeMatchupService: TypeMatchupService,
    private battleOddsService: BattleOddsService,
    private battleDebuffService: BattleDebuffService,
    private gameStateService: GameStateService,
  ) {}

  ngOnChanges(): void {
    if (this.forcedIndex !== null) {
      this.selectedLeadIndex = this.forcedIndex;
    }
    this.recomputePreview();
  }

  private recomputePreview(): void {
    if (!this.team.length) {
      this.oddsPreview = null;
      return;
    }
    this.oddsPreview = this.battleOddsService.computeOdds({
      team: this.team,
      opponentTypes: this.opponentTypes ?? [],
      baseNoCount: this.baseNoCount,
      currentRound: this.currentRound,
      leadIndex: this.selectedLeadIndex,
      xAttackBonus: this.xAttackSelected
        ? this.battleOddsService.xAttackBonus(this.team, this.currentRound) : 0,
      classicPlusModifiers: 0,
      badOmen: this.battleDebuffService.currentDebuff,
      abilitiesActive: this.gameStateService.isNewExperienceMode,
    });
  }

  selectLead(index: number): void {
    if (this.forcedIndex !== null) {
      return;
    }
    this.selectedLeadIndex = index;
    this.recomputePreview();
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
    this.recomputePreview();
  }

  onConfirm(): void {
    this.confirmed.emit({
      leadIndex: this.selectedLeadIndex,
      xAttackUsed: this.xAttackSelected,
    });
  }
}
