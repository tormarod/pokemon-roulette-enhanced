import { Component, Renderer2, ChangeDetectionStrategy, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { environment } from '../environments/environment';
import { ThemeService } from './services/theme-service/theme.service';
import { RunPersistenceService } from './services/run-persistence-service/run-persistence.service';
import { AchievementToastComponent } from './achievement-toast/achievement-toast.component';
import { WhatsNewService } from './services/whats-new-service/whats-new.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TranslateModule, AchievementToastComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'pokemon-roulette';

  constructor(
    private translate: TranslateService,
    private renderer: Renderer2,
    // Eagerly instantiate ThemeService so the stored theme is applied on startup,
    // before any settings panel is opened.
    _theme: ThemeService,
    // Eagerly instantiate so a saved run (if any) is restored before the game
    // renders its first screen.
    _runPersistence: RunPersistenceService,
    private whatsNew: WhatsNewService,
  ) {
    // Language setup (addLangs/setDefaultLang/use the saved language) now
    // happens in app.config.ts's provideAppInitializer, so it's awaited
    // before the app renders instead of firing from here as fire-and-forget.

    if (environment.production && environment.googleAnalyticsId) {
      this.loadGoogleAnalytics(environment.googleAnalyticsId);
    }

    afterNextRender(() => this.whatsNew.maybeShowOnStartup());
  }

  changeLang(lang: string) {
    this.translate.use(lang);
    localStorage.setItem('language', lang);
  }

  private loadGoogleAnalytics(measurementId: string): void {
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    this.renderer.appendChild(document.head, script);

    const inlineScript = this.renderer.createElement('script') as HTMLScriptElement;
    inlineScript.text = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}');
    `;
    this.renderer.appendChild(document.head, inlineScript);
  }
}
