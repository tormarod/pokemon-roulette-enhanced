import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Badge } from '../../interfaces/badge';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { BadgesService } from '../../services/badges-service/badges.service';
import { GenerationService } from '../../services/generation-service/generation.service';

@Component({
  selector: 'app-badges',
  imports: [
    CommonModule,
    TranslatePipe
  ],
  templateUrl: './badges.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './badges.component.css'
})
export class BadgesComponent {

  @Input() trainerBadges!: Badge[];

  /** True while the earned-badges popover is open. */
  expanded = false;

  constructor(private badgesService: BadgesService, private generationService: GenerationService) { }

  /** One slot per obtainable badge for the current generation (5 or 8), true where earned. */
  get badgeSlots(): boolean[] {
    const total = this.badgesService.getTotalBadgeCount(this.generationService.getCurrentGeneration());
    const earned = this.trainerBadges?.length ?? 0;
    return Array.from({ length: total }, (_, i) => i < earned);
  }

  toggleExpanded(): void {
    if (!this.trainerBadges?.length) {
      return;
    }
    this.expanded = !this.expanded;
  }
}
