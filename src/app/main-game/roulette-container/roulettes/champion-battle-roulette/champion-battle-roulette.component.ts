import { Component, EventEmitter, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { championByGeneration } from './champion-by-generation';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { PokemonType } from '../../../../interfaces/pokemon-type';
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepPanelComponent } from '../../battle-prep-panel/battle-prep-panel.component';

@Component({
  selector: 'app-champion-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './champion-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './champion-battle-roulette.component.css'
})
export class ChampionBattleRouletteComponent extends BaseBattleRouletteComponent {

  protected override readonly battleKey = 'champion-battle';
  protected override readonly textPrefix = 'game.main.roulette.champion';
  protected override readonly baseNoCount = 3;

  championByGeneration = championByGeneration;

  @ViewChild('presentationModalRef', { static: true }) declare presentationModalRef: TemplateRef<unknown>;
  @ViewChild('itemUsedModalRef', { static: true }) declare itemUsedModalRef: TemplateRef<unknown>;

  @Output() fromChampionChange = new EventEmitter<number>();

  currentChampion: GymLeader = { name: '', sprite: '', quotes: [''] };

  protected override get opponentTypes(): PokemonType[] | undefined { return this.currentChampion?.types; }
  protected override setCurrentOpponent(opponent: GymLeader): void { this.currentChampion = opponent; }

  protected override prepareOpponentForRound(): void {
    this.currentChampion = this.championByGeneration[this.generation.id][0];
    if (this.generation.id === 7) {
      this.resolveOpponentVariant(
        this.currentChampion,
        n => Math.floor(Math.random() * n),
        (types, i) => types ? [types[i]] : undefined,
        i => this.fromChampionChange.emit(i)
      );
    }
  }
}
