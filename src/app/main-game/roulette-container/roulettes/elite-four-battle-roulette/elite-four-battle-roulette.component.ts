import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { eliteFourByGeneration } from './elite-four-by-generation';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { PokemonType } from '../../../../interfaces/pokemon-type';
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepPanelComponent } from '../../battle-prep-panel/battle-prep-panel.component';

@Component({
  selector: 'app-elite-four-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './elite-four-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './elite-four-battle-roulette.component.css'
})
export class EliteFourBattleRouletteComponent extends BaseBattleRouletteComponent {

  protected override readonly battleKey = 'elite-four-battle';
  protected override readonly textPrefix = 'game.main.roulette.elite';
  protected override readonly baseNoCount = 2;

  eliteFourByGeneration = eliteFourByGeneration;

  @Output() fromEliteChange = new EventEmitter<number>();

  currentElite!: GymLeader;

  protected override get opponentTypes(): PokemonType[] | undefined { return this.currentElite?.types; }
  protected override setCurrentOpponent(opponent: GymLeader): void { this.currentElite = opponent; }

  protected override prepareOpponentForRound(): void {
    this.currentElite = this.eliteFourByGeneration[this.generation.id][this.currentRound % 4];
    if (this.isEliteVariantRound()) {
      this.resolveOpponentVariant(
        this.currentElite,
        n => Math.floor(Math.random() * n),
        (types, i) => types ? [types[i]] : undefined,
        i => this.fromEliteChange.emit(i)
      );
    }
  }

  private isEliteVariantRound(): boolean {
    const g = this.generation.id, r = this.currentRound % 4;
    return g === 8 && (r === 0 || r === 2);
  }

  protected override openPresentationModal(): void {
    void this.openEventPopup({
      title: `${this.translate.instant('game.main.roulette.elite.elite4')} ${this.translate.instant(this.currentElite.name)}!`,
      images: [{ src: Array.isArray(this.currentElite.sprite) ? this.currentElite.sprite[0] : this.currentElite.sprite, alt: this.translate.instant(this.currentElite.name) }],
      lines: this.currentElite.quotes.map(q => this.translate.instant(q)),
      buttons: [{ label: this.translate.instant('game.main.roulette.elite.go'), variant: 'primary' }],
      size: 'lg'
    });
  }

  protected override openItemUsedModal(): void {
    void this.openEventPopup({
      title: `${this.translate.instant('game.main.roulette.elite.use')} ${this.translate.instant(this.currentItem.text)}!`,
      images: [{ src: this.currentItem.sprite }],
      lines: [this.translate.instant(this.currentItem.description)],
      size: 'md'
    });
  }
}
