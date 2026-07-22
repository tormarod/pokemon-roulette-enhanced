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
import { StatsButtonComponent } from "./stats-button/stats-button.component";
import { NgIconsModule } from '@ng-icons/core';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PendingTypeBiases, TypeBiasEntry } from '../services/trainer-service/trainer.service';
import { cancelOpposingSoftCounts, countByType } from '../services/trainer-service/apply-type-bias';
import { PokemonType, getTypeIconUrl } from '../interfaces/pokemon-type';
import { LanguageSelectorComponent } from './language-selector/language-selector.component';
import { RouletteContainerComponent } from './roulette-container/roulette-container.component';
import { SettingsButtonComponent } from '../settings-button/settings-button.component';
import { RareCandyService } from '../services/rare-candy-service/rare-candy.service';
import { MegaStoneService } from '../services/mega-stone-service/mega-stone.service';
import { TypeBiasItemService } from '../services/type-bias-item-service/type-bias-item.service';
import { LinkCableService } from '../services/link-cable-service/link-cable.service';
import { SettingsService } from '../services/settings-service/settings.service';
import { RunPersistenceService } from '../services/run-persistence-service/run-persistence.service';

interface GroupedBias {
  type: PokemonType;
  mode: 'soft' | 'hard';
  count: number;
}

interface HoneyBiasGroup {
  type: PokemonType;
  /** Number of pending Honey uses contributing to the target-share (shared across every type in this use's set). */
  count: number;
}

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
    StatsButtonComponent,
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
    private linkCableService: LinkCableService,
    private settingsService: SettingsService,
    private runPersistenceService: RunPersistenceService) {
      this.darkMode = this.themeService.isDark$;
  }

  private destroyRef = inject(DestroyRef);
  wheelSpinning: boolean = false;
  groupedTowardBiases: GroupedBias[] = [];
  groupedAwayBiases: GroupedBias[] = [];
  groupedHoneyBiases: HoneyBiasGroup[] = [];
  itemsAvailable: boolean = false;

  ngOnInit(): void {
    this.analyticsService.trackEvent('main-game-loaded', 'Main Game Loaded', 'user acess');

    this.gameStateService.wheelSpinningObserver.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      this.wheelSpinning = state;
    });

    this.trainerService.getPendingTypeBiasesObservable().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(biases => {
      const display = this.computeDisplayBiases(biases);
      this.groupedTowardBiases = display.toward;
      this.groupedAwayBiases = display.away;
      this.groupedHoneyBiases = this.groupHoneyBiases(biases.honey);
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

  getBiasTypeIconUrl(bias: GroupedBias | HoneyBiasGroup): string {
    return getTypeIconUrl(bias.type);
  }

  getBiasLabelKey(bias: GroupedBias, direction: 'toward' | 'away'): string {
    const modeKey = bias.mode === 'hard' ? 'hard' : 'soft';
    const directionKey = direction === 'toward' ? 'Toward' : 'Away';
    return `game.main.activeBias.${modeKey}${directionKey}`;
  }

  /**
   * Mirrors the cancellation applyTypeBias() actually performs (see
   * apply-type-bias.ts) so the badges never show a "boosted toward Fire" and
   * a "steered away from Fire" at the same time when they'd net to nothing.
   * Hard-mode entries don't stack/cancel (a guarantee is already absolute),
   * so only soft entries go through cancelOpposingSoftCounts().
   */
  private computeDisplayBiases(biases: PendingTypeBiases): { toward: GroupedBias[]; away: GroupedBias[] } {
    const { toward: netTowardSoftCounts, away: netAwaySoftCounts } = cancelOpposingSoftCounts(
      countByType(biases.toward.filter(e => e.mode === 'soft')),
      countByType(biases.away.filter(e => e.mode === 'soft'))
    );

    return {
      toward: [
        ...this.groupByType(biases.toward.filter(e => e.mode === 'hard')),
        ...this.countsToGroupedBias(netTowardSoftCounts)
      ],
      away: [
        ...this.groupByType(biases.away.filter(e => e.mode === 'hard')),
        ...this.countsToGroupedBias(netAwaySoftCounts)
      ]
    };
  }

  private groupByType(entries: TypeBiasEntry[]): GroupedBias[] {
    const grouped = new Map<string, GroupedBias>();
    for (const entry of entries) {
      const key = `${entry.type}-${entry.mode}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count++;
      } else {
        grouped.set(key, { type: entry.type, mode: entry.mode, count: 1 });
      }
    }
    return [...grouped.values()];
  }

  private countsToGroupedBias(counts: Map<PokemonType, number>): GroupedBias[] {
    return [...counts.entries()].map(([type, count]) => ({ type, mode: 'soft' as const, count }));
  }

  /** One badge per type across all pending Honey uses; count is the shared use count (see HONEY_STACK_CAP in apply-type-bias.ts). */
  private groupHoneyBiases(honey: PokemonType[][]): HoneyBiasGroup[] {
    const types = new Set(honey.flat());
    return [...types].map(type => ({ type, count: honey.length }));
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
    this.runPersistenceService.startFreshRun(this.settingsService.currentSettings.newExperienceMode);
  }
}
