import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, ElementRef, TemplateRef, ViewChild } from '@angular/core';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import domtoimage from 'dom-to-image-more';
import { MainGameButtonComponent } from '../main-game-button/main-game-button.component';
import { CoffeeButtonComponent } from '../main-game/coffee-button/coffee-button.component';
import { CreditsButtonComponent } from '../main-game/credits-button/credits-button.component';
import { BattleType, StatsService } from '../services/stats-service/stats.service';
import { PlayerGenerationStatsSummary, PlayerStatsSummary, TopEntry, TypeEntry } from '../services/stats-service/stats-selectors';
import { RunLogEntry } from '../interfaces/player-stats';
import { ProfileBackupService } from '../services/profile-backup-service/profile-backup.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { PokemonService } from '../services/pokemon-service/pokemon.service';
import { GenerationService } from '../services/generation-service/generation.service';
import { GenerationItem } from '../interfaces/generation-item';
import { getTypeIconUrl, PokemonType } from '../interfaces/pokemon-type';

export const BATTLE_TYPES: BattleType[] = ['gym', 'rival', 'eliteFour', 'champion'];

/** Sections with their own reset, beyond V1's reset-all (plan V2 §3.E). */
export type ResettableSection = 'luck' | 'runHistory' | 'achievements';

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

  /** Per-generation filter (plan V3 §4) — the lifetime totals are already shown in the sections above, so this stays gen-scoped only, defaulting to the first generation. */
  readonly generations: GenerationItem[];
  private readonly selectedGenerationId$: BehaviorSubject<number>;
  generationSummary$: Observable<PlayerGenerationStatsSummary>;

  @ViewChild('resetStatsModal', { static: true }) resetStatsModal!: TemplateRef<any>;
  @ViewChild('sectionResetModal', { static: true }) sectionResetModal!: TemplateRef<any>;
  @ViewChild('importFileInput') importFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('shareCard') shareCard?: ElementRef<HTMLElement>;

  pendingResetSection: ResettableSection | null = null;
  importResult: 'success' | 'invalid' | 'unsupported-version' | null = null;

  constructor(
    private statsService: StatsService,
    private profileBackupService: ProfileBackupService,
    private pokemonService: PokemonService,
    private generationService: GenerationService,
    private modalService: NgbModal,
    private translate: TranslateService,
    private themeService: ThemeService,
  ) {
    this.summary$ = this.statsService.getSummaryObservable();
    this.generations = this.generationService.getGenerationList();
    this.selectedGenerationId$ = new BehaviorSubject<number>(this.generations[0]?.id ?? 1);
    this.generationSummary$ = this.selectedGenerationId$.pipe(
      switchMap(id => this.statsService.getGenerationSummaryObservable(id))
    );
  }

  onGenerationFilterChange(event: Event): void {
    this.selectedGenerationId$.next(Number((event.target as HTMLSelectElement).value));
  }

  /**
   * The shareable stats card uses the starters tiled image as a fill for the
   * plain-light/plain-dark themes (where it reads as a distinct pattern), but
   * a solid color for the starters theme itself (see stats.component.css) —
   * otherwise the card would blend into the page's own identical tiled
   * background.
   */
  get shareCardBackgroundImage(): string {
    return this.themeService.currentTheme === 'starters'
      ? 'none'
      : `url('${this.themeService.startersBackgroundImageUrl}')`;
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

  showSectionResetConfirm(section: ResettableSection): void {
    this.pendingResetSection = section;
    this.modalService.open(this.sectionResetModal, {
      centered: true,
      size: 'lg'
    });
  }

  confirmSectionReset(): void {
    switch (this.pendingResetSection) {
      case 'luck': this.statsService.resetLuckStats(); break;
      case 'runHistory': this.statsService.resetRunHistory(); break;
      case 'achievements': this.statsService.resetAchievements(); break;
    }
    this.pendingResetSection = null;
    this.closeModal();
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  exportProfile(): void {
    const json = this.profileBackupService.exportProfile();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pokemon-roulette-profile-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  triggerImport(): void {
    this.importResult = null;
    this.importFileInput.nativeElement.click();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.importResult = this.profileBackupService.importProfile(reader.result as string);
    };
    reader.onerror = () => {
      this.importResult = 'invalid';
    };
    reader.readAsText(file);
  }

  /** Renders #shareCard to a PNG via dom-to-image-more and shares/downloads it (plan V2 §7.4). */
  async shareStatsCard(): Promise<void> {
    const element = this.shareCard?.nativeElement;
    if (!element) {
      return;
    }

    const scale = 2;
    try {
      const blob: Blob | null = await domtoimage.toBlob(element, {
        width: element.scrollWidth * scale,
        height: element.scrollHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${element.scrollWidth}px`,
          height: `${element.scrollHeight}px`,
        },
      });
      if (!blob) {
        return;
      }

      const file = new File([blob], 'pokemon-roulette-stats.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: this.translate.instant('stats.share.title'),
          text: this.translate.instant('stats.share.text'),
        });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'pokemon-roulette-stats.png';
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (error) {
      console.error('Error capturing stats card image:', error);
    }
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

  formatDate(timestampMs: number): string {
    return new Date(timestampMs).toLocaleDateString();
  }

  formatDuration(ms: number): string {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  trackByRunEnd(_index: number, entry: RunLogEntry): number {
    return entry.endedAt;
  }

  unlockedAchievementCount(summary: PlayerStatsSummary): number {
    return summary.achievements.filter(a => a.unlocked).length;
  }

  /** Bar width as a 0-100 percentage of the largest entry — favoriteTypes is already sorted descending. */
  typeBarWidth(entry: TypeEntry, allEntries: TypeEntry[]): number {
    const max = allEntries[0]?.count ?? 0;
    return max > 0 ? (entry.count / max) * 100 : 0;
  }

  /**
   * SVG polyline `points` for a 0-100 x / 0-100 y viewBox from a chronological
   * win-rate-trend series (plan V2 §3.E hand-rolled chart, no charting dep).
   */
  winRateTrendPoints(trend: number[]): string {
    if (trend.length === 0) {
      return '';
    }
    if (trend.length === 1) {
      const y = 100 - trend[0] * 100;
      return `0,${y} 100,${y}`;
    }
    return trend.map((value, index) => `${(index / (trend.length - 1)) * 100},${100 - value * 100}`).join(' ');
  }
}
