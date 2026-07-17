import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageSelectorComponent } from "../main-game/language-selector/language-selector.component";
import { TranslatePipe } from '@ngx-translate/core';
import { MainGameButtonComponent } from "../main-game-button/main-game-button.component";
import { RestartGameButtonComponent } from '../restart-game-button/restart-game-button.component';
import { ThemeSelectorComponent } from './theme-selector/theme-selector.component';
import { NgIconsModule } from '@ng-icons/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { SettingsService, GameSettings } from '../services/settings-service/settings.service';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { RunPersistenceService } from '../services/run-persistence-service/run-persistence.service';
import { WhatsNewService } from '../services/whats-new-service/whats-new.service';

@Component({
  selector: 'app-settings',
  imports: [
    ThemeSelectorComponent,
    LanguageSelectorComponent,
    TranslatePipe,
    MainGameButtonComponent,
    RestartGameButtonComponent,
    NgIconsModule,
    CommonModule
],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {

  settings$!: Observable<GameSettings>;

  constructor(
    private settingsService: SettingsService,
    private trainerService: TrainerService,
    private gameStateService: GameStateService,
    private runPersistenceService: RunPersistenceService,
    private router: Router,
    private whatsNew: WhatsNewService,
  ) {}

  ngOnInit(): void {
    this.settings$ = this.settingsService.settings$;
  }

  onToggleVerbosity(): void {
    this.settingsService.toggleLessExplanations();
  }

  onToggleMuteAudio(): void {
    this.settingsService.toggleMuteAudio();
  }

  onVolumeChange(value: string): void {
    this.settingsService.setVolume(Number(value));
  }

  onToggleSkipShinyRolls(): void {
    this.settingsService.toggleSkipShinyRolls();
  }

  onToggleSkipMegaEvolutionAnimation(): void {
    this.settingsService.toggleSkipMegaEvolutionAnimation();
  }

  onToggleFastSpin(): void {
    this.settingsService.toggleFastSpin();
  }

  onSelectGender(gender: 'male' | 'female' | 'always-choose'): void {
    this.settingsService.setDefaultGender(gender);
  }

  onRestartGame(): void {
    this.trainerService.resetTrainer();
    this.trainerService.resetTeam();
    this.trainerService.resetItems();
    this.trainerService.resetBadges();
    this.trainerService.clearPendingTypeBiases();
    this.gameStateService.resetGameState();
    this.runPersistenceService.clearRun();
    this.router.navigate(['']);
  }

  openWhatsNew(): void {
    this.whatsNew.showWhatsNew();
  }

}
