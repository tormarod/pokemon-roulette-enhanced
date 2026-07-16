import { Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgbCollapseModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TrainerTeamComponent } from "../trainer-team/trainer-team.component";
import { ItemsComponent } from "../items/items.component";
import { GameStateService } from '../services/game-state-service/game-state.service';
import { CommonModule } from '@angular/common';
import { ItemItem } from '../interfaces/item-item';
import { RestartGameButtonComponent } from "../restart-game-button/restart-game-button.component";
import { TrainerService } from '../services/trainer-service/trainer.service';
import { AnalyticsService } from '../services/analytics-service/analytics.service';
import { CoffeeButtonComponent } from "./coffee-button/coffee-button.component";
import { NgIconsModule } from '@ng-icons/core';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PendingTypeBiases, TypeBiasEntry } from '../services/trainer-service/trainer.service';
import { getTypeIconUrl } from '../interfaces/pokemon-type';
import { LanguageSelectorComponent } from './language-selector/language-selector.component';
import { RouletteContainerComponent } from './roulette-container/roulette-container.component';
import { SettingsButtonComponent } from '../settings-button/settings-button.component';
import { RareCandyService } from '../services/rare-candy-service/rare-candy.service';
import { MegaStoneService } from '../services/mega-stone-service/mega-stone.service';
import { TypeBiasItemService } from '../services/type-bias-item-service/type-bias-item.service';
import { LinkCableService } from '../services/link-cable-service/link-cable.service';

@Component({
  selector: 'app-main-game',
  imports: [
    CommonModule,
    RouletteContainerComponent,
    SettingsButtonComponent,
    TrainerTeamComponent,
    ItemsComponent,
    RestartGameButtonComponent,
    CoffeeButtonComponent,
    NgIconsModule,
    NgbCollapseModule,
    LanguageSelectorComponent,
    TranslatePipe
  ],
  templateUrl: './main-game.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './main-game.component.css'
})
export class MainGameComponent implements OnInit {

  constructor(
    private darkModeService: DarkModeService,
    private themeService: ThemeService,
    private gameStateService: GameStateService,
    private trainerService: TrainerService,
    private modalService: NgbModal,
    private analyticsService: AnalyticsService,
    private rareCandyService: RareCandyService,
    private megaStoneService: MegaStoneService,
    private typeBiasItemService: TypeBiasItemService,
    private linkCableService: LinkCableService) {
      this.darkMode = this.themeService.isDark$;
  }

  private destroyRef = inject(DestroyRef);
  wheelSpinning: boolean = false;
  pendingTypeBiases: PendingTypeBiases = { toward: null, away: null };
  itemsAvailable: boolean = false;

  ngOnInit(): void {
    this.analyticsService.trackEvent('main-game-loaded', 'Main Game Loaded', 'user acess');

    this.gameStateService.wheelSpinningObserver.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      this.wheelSpinning = state;
    });

    this.trainerService.getPendingTypeBiasesObservable().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(biases => {
      this.pendingTypeBiases = biases;
    });

    // 'start-adventure' is pushed exactly once, at run setup, and never re-pushed — so as
    // long as it's still sitting unpopped in the stack, the player hasn't reached the
    // adventure yet. This (rather than a fixed set of state names) is what correctly tells
    // apart the one-time pre-adventure "check-shininess" (right after picking a starter)
    // from every other "check-shininess" triggered by a catch later in the run — the state
    // name alone is reused throughout the game and can't disambiguate the two.
    this.gameStateService.currentState.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.itemsAvailable = !this.gameStateService.getStateStack().includes('start-adventure');
    });
  }

  getBiasTypeIconUrl(entry: TypeBiasEntry): string {
    return getTypeIconUrl(entry.type);
  }

  getBiasLabelKey(entry: TypeBiasEntry, direction: 'toward' | 'away'): string {
    const modeKey = entry.mode === 'hard' ? 'hard' : 'soft';
    const directionKey = direction === 'toward' ? 'Toward' : 'Away';
    return `game.main.activeBias.${modeKey}${directionKey}`;
  }
  
  darkMode!: Observable<boolean>;
  mapIsCollapsed: boolean = true;

  resetGameAction(): void {
    this.resetGame();
    this.modalService.dismissAll();
  }

  rareCandyInterrupt(rareCandy: ItemItem): void {
    if(this.wheelSpinning || !this.itemsAvailable){
      return;
    }

    this.rareCandyService.triggerRareCandyEvolution(rareCandy);
  }

  megaStoneInterrupt(megaStone: ItemItem): void {
    if (this.wheelSpinning || !this.itemsAvailable) {
      return;
    }

    this.megaStoneService.triggerMegaStoneActivation(megaStone);
  }

  typeBiasItemInterrupt(item: ItemItem): void {
    if (this.wheelSpinning || !this.itemsAvailable) {
      return;
    }

    this.typeBiasItemService.triggerTypeBiasItem(item);
  }

  linkCableInterrupt(item: ItemItem): void {
    if (this.wheelSpinning || !this.itemsAvailable) {
      return;
    }

    this.linkCableService.triggerLinkCable(item);
  }

  resetGame(): void {
    this.trainerService.resetTrainer();
    this.trainerService.resetTeam();
    this.trainerService.resetItems();
    this.trainerService.resetBadges();
    this.gameStateService.resetGameState();
  }
}
