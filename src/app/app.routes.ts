import { Routes } from '@angular/router';
import { MainGameComponent } from './main-game/main-game.component';

export const routes: Routes = [
    { path: '', component: MainGameComponent },
    { path: 'credits', loadComponent: () => import('./credits/credits.component').then(m => m.CreditsComponent) },
    { path: 'coffee', loadComponent: () => import('./coffee/coffee.component').then(m => m.CoffeeComponent) },
    { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) },
    { path: '**', loadComponent: () => import('./not-found/not-found.component').then(m => m.NotFoundComponent) },
];
