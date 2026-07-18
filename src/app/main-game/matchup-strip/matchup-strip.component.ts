import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';

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
  /** i18n name keys of active team abilities this battle (New Experience only), e.g. ["abilities.blaze.name"]. Translated in the template. */
  @Input() abilityNames: string[] = [];
  readonly getTypeIconUrl = getTypeIconUrl;
}
