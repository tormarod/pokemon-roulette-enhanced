import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
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
import { EventPopupComponent } from '../../../../event-popup/event-popup.component';

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
  protected override readonly allowPotions = false;

  rivalByGeneration = rivalByGeneration;

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
    this.openFaintedModal();
  }

  protected override openPresentationModal(): void {
    void this.openEventPopup({
      title: `${this.translate.instant('game.main.roulette.rival.against')} ${this.translate.instant(this.currentRival.name)}!`,
      images: [{ src: Array.isArray(this.currentRival.sprite) ? this.currentRival.sprite[0] : this.currentRival.sprite, alt: this.translate.instant(this.currentRival.name) }],
      lines: this.currentRival.quotes.map(q => this.translate.instant(q)),
      buttons: [{ label: this.translate.instant('game.main.roulette.rival.go'), variant: 'primary' }],
      size: 'lg'
    });
  }

  protected override openItemUsedModal(): void {
    void this.openEventPopup({
      title: `${this.translate.instant('game.main.roulette.rival.used')} ${this.translate.instant(this.currentItem.text)}!`,
      images: [{ src: this.currentItem.sprite }],
      lines: [this.translate.instant(this.currentItem.description)],
      size: 'md'
    });
  }

  /** Image-only popup (no message box) — deliberately not routed through ModalQueueService, matching the pre-migration behavior. */
  private openFaintedModal(): void {
    if (!this.faintedPokemon) return;
    const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
    modalRef.componentInstance.title = `${this.translate.instant(this.faintedPokemon.text)} ${this.translate.instant('game.main.roulette.rival.fainted')}`;
    modalRef.componentInstance.images = [{ src: this.faintedPokemon.sprite?.front_default ?? '' }];
    modalRef.componentInstance.buttons = [{ label: this.translate.instant('common.ok'), variant: 'primary' }];
  }
}
