import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';
import { BattleOddsBreakdown } from '../../services/battle-odds-service/battle-odds.service';

@Component({
  selector: 'app-matchup-strip',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './matchup-strip.component.html',
  styleUrl: './matchup-strip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchupStripComponent {
  @Input() opponentTypes: PokemonType[] = [];
  @Input() superEffectiveTypes: PokemonType[] = [];
  @Input() resistTypes: PokemonType[] = [];
  @Input() weakTypes: PokemonType[] = [];
  @Input() advantageDelta = 0;
  @Input() disadvantageDelta = 0;
  /** Full odds breakdown for the win-% headline + hidden-threat rows; null suppresses both (e.g. during prep, where the prep panel owns the preview). */
  @Input() odds: BattleOddsBreakdown | null = null;
  readonly getTypeIconUrl = getTypeIconUrl;
}
