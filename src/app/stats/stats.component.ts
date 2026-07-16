import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MainGameButtonComponent } from '../main-game-button/main-game-button.component';
import { CoffeeButtonComponent } from '../main-game/coffee-button/coffee-button.component';
import { CreditsButtonComponent } from '../main-game/credits-button/credits-button.component';
import { BattleType, StatsService } from '../services/stats-service/stats.service';
import { PlayerStatsSummary, TopEntry } from '../services/stats-service/stats-selectors';
import { PokemonService } from '../services/pokemon-service/pokemon.service';
import { GenerationService } from '../services/generation-service/generation.service';
import { getTypeIconUrl, PokemonType } from '../interfaces/pokemon-type';

export const BATTLE_TYPES: BattleType[] = ['gym', 'rival', 'eliteFour', 'champion'];

@Component({
  selector: 'app-stats',
  imports: [
    CommonModule,
    TranslatePipe,
    MainGameButtonComponent,
    CoffeeButtonComponent,
    CreditsButtonComponent
  ],
  templateUrl: './stats.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './stats.component.css'
})
export class StatsComponent {

  readonly battleTypes = BATTLE_TYPES;

  summary$: Observable<PlayerStatsSummary>;

  @ViewChild('resetStatsModal', { static: true }) resetStatsModal!: TemplateRef<any>;

  constructor(
    private statsService: StatsService,
    private pokemonService: PokemonService,
    private generationService: GenerationService,
    private modalService: NgbModal,
  ) {
    this.summary$ = this.statsService.getSummaryObservable();
  }

  showResetConfirmModal(): void {
    this.modalService.open(this.resetStatsModal, {
      centered: true,
      size: 'lg'
    });
  }

  confirmReset(): void {
    this.statsService.reset();
    this.closeModal();
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  pokemonText(pokemonId: number): string {
    return this.pokemonService.getPokemonById(pokemonId)?.text ?? 'pokemon.unknown';
  }

  pokemonSprite(pokemonId: number): string | null {
    return this.pokemonService.getPokemonById(pokemonId)?.sprite?.front_default ?? null;
  }

  generationLabel(generationId: number): string {
    const generation = this.generationService.getGenerationList().find(g => g.id === generationId);
    return generation ? `${generation.text} (${generation.region})` : `Gen ${generationId}`;
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }

  formatRate(rate: number | null): string {
    return rate === null ? '—' : `${Math.round(rate * 100)}%`;
  }

  trackByPokemonId(_index: number, entry: TopEntry): number {
    return entry.pokemonId;
  }
}
