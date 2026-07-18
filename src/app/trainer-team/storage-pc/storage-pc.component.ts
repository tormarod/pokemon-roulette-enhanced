import { Component, OnDestroy, OnInit, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { NgIconsModule } from '@ng-icons/core';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { DarkModeService } from '../../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../../services/theme-service/theme.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { GameState } from '../../services/game-state-service/game-state';
import {TranslatePipe} from '@ngx-translate/core';
import { SoundFxHandle, SoundFxService } from '../../services/sound-fx-service/sound-fx.service';
import { Subscription } from 'rxjs';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';

@Component({
  selector: 'app-storage-pc',
  imports: [
    DragDropModule,
    CommonModule,
    NgIconsModule,
    NgbTooltipModule,
    TranslatePipe
  ],
  templateUrl: './storage-pc.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './storage-pc.component.css'
})
export class StoragePcComponent implements OnInit, OnDestroy {

    constructor(private trainerService: TrainerService,
                private darkModeService: DarkModeService,
                private themeService: ThemeService,
                private modalService: NgbModal,
                private gameStateService: GameStateService,
                private soundFxService: SoundFxService) {
      this.pcTurningOn = this.soundFxService.createPcTurningOnSoundFx();
      this.pcLoginAudio = this.soundFxService.createPcLoginSoundFx();
      this.pcLogoutAudio = this.soundFxService.createPcLogoutSoundFx();
    }

    @ViewChild('pcStorageModal', { static: true }) pcStorageModal!: TemplateRef<any>;
    @ViewChild('pcInfoModal', { static: true }) infoModal!: TemplateRef<any>;

    darkMode!: Observable<boolean>;
    pcTurningOn!: SoundFxHandle;
    pcLoginAudio!: SoundFxHandle;
    pcLogoutAudio!: SoundFxHandle;
    trainerTeam!: PokemonItem[];
    storedPokemon!: PokemonItem[];
    wheelSpinning: boolean = false;
    currentGameState!: GameState;
    infoModalTitle = '';
    infoModalMessage = '';
    private readonly subscriptions = new Subscription();
    private removePcTurningOnEndedListener: (() => void) | null = null;

    ngOnInit(): void {
      this.darkMode = this.themeService.isDark$;
      this.removePcTurningOnEndedListener = this.soundFxService.onSoundFxEnded(this.pcTurningOn, () => {
        void this.soundFxService.playSoundFx(this.pcLoginAudio, 0.30);
      });

      this.subscriptions.add(this.gameStateService.wheelSpinningObserver.subscribe(state => {
        this.wheelSpinning = state;
      }));

      this.subscriptions.add(this.gameStateService.currentState.subscribe(state => {
        this.currentGameState = state;
      }));
    }

    ngOnDestroy(): void {
      this.removePcTurningOnEndedListener?.();
      this.subscriptions.unsubscribe();
    }

    showPCModal() {
      if(this.wheelSpinning) {
        return;
      }

      if(this.currentGameState === 'team-rocket-encounter') {
        this.infoModalTitle = 'trainer.storage.unavailable';
        this.infoModalMessage = 'trainer.storage.unavailableMessage';
        const modalRef = this.modalService.open(this.infoModal, {
          centered: true,
          size: 'md'
        });
      } else {
        this.trainerTeam = this.trainerService.getTeam();
        this.storedPokemon = this.trainerService.getStored();
        void this.soundFxService.playSoundFx(this.pcTurningOn, 0.30);

        this.modalService.open(this.pcStorageModal, {
          centered: true,
          size: 'lg',
          backdrop: 'static',
          keyboard: false
        });
      }
    }

    logOut(): void {
      void this.soundFxService.playSoundFx(this.pcLogoutAudio, 0.30);
      this.modalService.dismissAll();
    }

    closeModal(): void {
      this.modalService.dismissAll();
    }

    getSprite(pokemon: PokemonItem): string {
      if (pokemon.shiny) {
        return pokemon.sprite?.front_shiny || 'place-holder-pixel.png';
      }
      return pokemon.sprite?.front_default || 'place-holder-pixel.png';
    }

    getPokemonTypes(pokemon: PokemonItem): PokemonType[] {
      return [pokemon.type1, pokemon.type2].filter((type): type is PokemonType => !!type);
    }

    getTypeIconUrl(type: PokemonType): string {
      return getTypeIconUrl(type);
    }

    drop(event: CdkDragDrop<PokemonItem[]>) {
      if (event.previousContainer === event.container) {
        moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      } else {
        transferArrayItem(
          event.previousContainer.data,
          event.container.data,
          event.previousIndex,
          event.currentIndex,
        );
      }
      this.trainerService.commitTeamAndStorage(this.trainerTeam, this.storedPokemon);
    }

    lastPokemonPredicate  = () => this.trainerTeam.length > 1
    teamIsFullPredicate = () => this.trainerTeam.length < 6;

    hasRevive(): boolean {
      return this.trainerService.hasItem('revive');
    }

    /** Consumes a Revive and clears the fainted flag — the mon is now a normal stored Pokémon, draggable back into the team. */
    revivePokemon(pokemon: PokemonItem): void {
      const revive = this.trainerService.getItem('revive');
      if (!revive) {
        return;
      }
      this.trainerService.removeItem(revive);
      pokemon.fainted = false;
      this.trainerService.commitTeamAndStorage(this.trainerTeam, this.storedPokemon);
    }
}
