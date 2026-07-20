import { Component, EventEmitter, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { rivalByGeneration } from './rival-by-generation';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { PokemonType } from '../../../../interfaces/pokemon-type';
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepPanelComponent } from '../../battle-prep-panel/battle-prep-panel.component';
import { PokemonItem } from '../../../../interfaces/pokemon-item';

@Component({
  selector: 'app-rival-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './rival-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './rival-battle-roulette.component.css'
})
export class RivalBattleRouletteComponent extends BaseBattleRouletteComponent {

  protected override readonly battleKey = 'battle-rival';
  protected override readonly textPrefix = 'game.main.roulette.rival';
  protected override readonly baseNoCount = 1;
  protected override readonly skipRetriesInClassicMode = true;

  rivalByGeneration = rivalByGeneration;

  @ViewChild('presentationModalRef', { static: true }) declare presentationModalRef: TemplateRef<unknown>;
  @ViewChild('itemUsedModalRef', { static: true }) declare itemUsedModalRef: TemplateRef<unknown>;
  @ViewChild('faintedModal', { static: true }) faintedModal!: TemplateRef<any>;

  @Output() fromRivalChange = new EventEmitter<number>();

  currentRival!: GymLeader;
  /** Set by onFinalLoss(), read by the faintedModal template. */
  faintedPokemon: PokemonItem | null = null;

  protected override get opponentTypes(): PokemonType[] | undefined { return this.currentRival?.types; }
  protected override setCurrentOpponent(opponent: GymLeader): void { this.currentRival = opponent; }

  protected override prepareOpponentForRound(): void {
    this.currentRival = this.rivalByGeneration[this.generation.id];
    if (this.generation.id === 6) {
      this.resolveOpponentVariant(
        this.currentRival,
        () => this.trainerService.gender === 'male' ? 1 : 0,
        types => types,
        i => this.fromRivalChange.emit(i)
      );
    }
  }

  /**
   * New Experience only: faints the committed lead on a rival loss —
   * game-balance-v4 Part B. Frees the team slot immediately and moves the
   * fainted Pokémon into storage via the same commitTeamAndStorage plumbing
   * StoragePcComponent.drop() uses, so no new persistence wiring is needed.
   * A lead with the Sturdy ability (faint-immune-lead, see abilities-data.ts)
   * survives instead — flavor only, no other effect.
   */
  protected override onFinalLoss(): void {
    const leadIndex = this.battlePrepService.getPendingPrep()?.leadIndex;
    const team = this.trainerService.getTeam();
    if (leadIndex == null || !team[leadIndex]) {
      return;
    }

    const lead = team[leadIndex];
    if (this.abilityService.getMemberAbility(lead)?.effect === 'faint-immune-lead') {
      return;
    }

    const updatedTeam = [...team];
    const [faintedMon] = updatedTeam.splice(leadIndex, 1);
    faintedMon.fainted = true;
    this.trainerService.commitTeamAndStorage(updatedTeam, [...this.trainerService.getStored(), faintedMon]);

    this.faintedPokemon = faintedMon;
    this.modalService.open(this.faintedModal, { centered: true, size: 'md' });
  }
}
