import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { Router } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-page-nav',
  imports: [
    NgIconsModule,
    TranslatePipe
  ],
  templateUrl: './page-nav.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './page-nav.component.css'
})
export class PageNavComponent {

  /** Which entry renders as the current page. */
  @Input() active: 'game' | 'stats' | 'settings' | 'coffee' | 'credits' | null = null;

  readonly entries: ReadonlyArray<{ id: string; route: string; icon: string; labelKey: string }> = [
    { id: 'game',     route: '',         icon: 'bootstrapController',   labelKey: 'game.main.game.button.title' },
    { id: 'settings', route: 'settings', icon: 'bootstrapGear',         labelKey: 'settings.label' },
    { id: 'stats',    route: 'stats',    icon: 'bootstrapBarChartFill', labelKey: 'game.statsButton.label' },
    { id: 'coffee',   route: 'coffee',   icon: 'bootstrapCupHotFill',   labelKey: 'game.coffeeButton.label' },
    { id: 'credits',  route: 'credits',  icon: 'bootstrapPeopleFill',   labelKey: 'game.creditsButton.label' },
  ];

  constructor(private router: Router) {}

  go(route: string): void {
    this.router.navigate([route]);
  }
}
