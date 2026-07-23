import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AsyncPipe, NgClass } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ThemeService } from '../../services/theme-service/theme.service';
import { GymLeader } from '../../interfaces/gym-leader';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';
import { DangerMeterComponent } from '../danger-meter/danger-meter.component';

/**
 * Reusable run-context card ("2e Status Header"): the upcoming opponent with
 * its type icons, the New-Experience danger meter, and an optional prompt
 * line — stacked by RouletteContainerComponent above whichever screen is
 * active. Consolidates the former ad-hoc `.opponent-preview` block and the
 * bare `<app-danger-meter>` into one themed card matching the wheel-card /
 * adventure-panel language.
 */
@Component({
  selector: 'app-run-status-header',
  imports: [TranslatePipe, AsyncPipe, NgClass, DangerMeterComponent],
  templateUrl: './run-status-header.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './run-status-header.component.css'
})
export class RunStatusHeaderComponent {
  @Input() opponent: GymLeader | null = null;
  @Input() showDanger = false;
  /**
   * i18n keys for the screen title / context question at the bottom of the
   * card, translated and space-joined (empty = no prompt line). Resolved per
   * game state by RouletteContainerComponent.statusPrompt from
   * ROULETTE_SCREEN_TITLES.
   */
  @Input() promptKeys: string[] = [];
  /** Raw (untranslated) tail appended after the keys, e.g. "(Red / Blue / Yellow)" or "Kanto!". */
  @Input() promptSuffix: string | null = null;

  /** Binary dark/light card, same precedent as WheelComponent's wheel-card. */
  isDark$: Observable<boolean>;

  constructor(private themeService: ThemeService) {
    this.isDark$ = this.themeService.isDark$;
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }
}
