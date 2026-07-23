import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { PokemonType } from '../../../../interfaces/pokemon-type';
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';
import { gymLeadersByGeneration } from './gym-leaders-by-generation';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepPanelComponent } from '../../battle-prep-panel/battle-prep-panel.component';

@Component({
  selector: 'app-gym-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './gym-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './gym-battle-roulette.component.css'
})
export class GymBattleRouletteComponent extends BaseBattleRouletteComponent {

  protected override readonly battleKey = 'gym-battle';
  protected override readonly textPrefix = 'game.main.roulette.gym';
  protected override readonly baseNoCount = 1;

  gymLeadersByGeneration = gymLeadersByGeneration;

  @Input() fromLeader!: number;
  @Output() fromLeaderChange = new EventEmitter<number>();

  currentLeader!: GymLeader;

  protected override get opponentTypes(): PokemonType[] | undefined { return this.currentLeader?.types; }
  protected override setCurrentOpponent(opponent: GymLeader): void { this.currentLeader = opponent; }

  protected override prepareOpponentForRound(): void {
    this.currentLeader = this.gymLeadersByGeneration[this.generation.id][this.currentRound];
    if (this.isGymVariantRound()) {
      this.resolveOpponentVariant(
        this.currentLeader,
        n => Math.floor(Math.random() * n),
        (types, i) => types ? [types[i]] : undefined,
        i => this.fromLeaderChange.emit(i)
      );
    }
  }

  private isGymVariantRound(): boolean {
    const g = this.generation.id, r = this.currentRound;
    return (g === 5 && (r === 0 || r === 7))
        || (g === 7 && (r === 2 || r === 4))
        || (g === 8 && (r === 3 || r === 5));
  }

  protected override openPresentationModal(): void {
    void this.openEventPopup({
      title: `${this.translate.instant('game.main.roulette.gym.against')} ${this.translate.instant(this.currentLeader.name)}!`,
      images: [{ src: Array.isArray(this.currentLeader.sprite) ? this.currentLeader.sprite[0] : this.currentLeader.sprite, alt: this.translate.instant(this.currentLeader.name) }],
      lines: this.currentLeader.quotes.map(q => this.translate.instant(q)),
      buttons: [{ label: this.translate.instant('game.main.roulette.gym.go'), variant: 'primary' }],
      size: 'lg'
    });
  }

  protected override openItemUsedModal(): void {
    void this.openEventPopup({
      title: `${this.translate.instant('game.main.roulette.gym.used')} ${this.translate.instant(this.currentItem.text)}!`,
      images: [{ src: this.currentItem.sprite }],
      lines: [this.translate.instant(this.currentItem.description)],
      size: 'md'
    });
  }
}