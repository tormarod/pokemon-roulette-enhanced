import { ApplicationConfig, importProvidersFrom, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { routes } from './app.routes';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  bootstrapArrowRepeat,
  bootstrapBarChartFill,
  bootstrapCheck,
  bootstrapClock,
  bootstrapController,
  bootstrapCupHotFill,
  bootstrapGear,
  bootstrapMap,
  bootstrapPcDisplayHorizontal,
  bootstrapPeopleFill,
  bootstrapShare,
  bootstrapBook
} from '@ng-icons/bootstrap-icons';
import { TranslateHttpLoader, TRANSLATE_HTTP_LOADER_CONFIG } from '@ngx-translate/http-loader';
import {TranslateService, TranslateLoader, TranslateModule} from '@ngx-translate/core';

const httpLoaderFactory = () => new TranslateHttpLoader();
const SUPPORTED_LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt'];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideIcons(
      { bootstrapArrowRepeat,
        bootstrapBarChartFill,
        bootstrapCheck,
        bootstrapClock,
        bootstrapController,
        bootstrapCupHotFill,
        bootstrapGear,
        bootstrapPcDisplayHorizontal,
        bootstrapPeopleFill,
        bootstrapShare,
        bootstrapMap,
        bootstrapBook
       }),
    provideHttpClient(withXhr()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    importProvidersFrom([TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: []
      },
      defaultLanguage: 'en'
    })]),
    {
      provide: TRANSLATE_HTTP_LOADER_CONFIG,
      useValue: {
        prefix: './assets/i18n/',
        suffix: '.json'
      }
    },
    // Blocks the initial render on the translation file load, instead of
    // firing it from AppComponent's constructor (fire-and-forget, resolving
    // only after the first change-detection pass already rendered raw
    // 'a.b.c' keys). That flash was imperceptible on localhost's near-zero
    // latency but visible on a real network (e.g. GitHub Pages).
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      translate.addLangs(SUPPORTED_LANGS);
      translate.setDefaultLang('en');
      const savedLanguage = localStorage.getItem('language') || 'en';
      return firstValueFrom(translate.use(savedLanguage));
    }),
  ]
};