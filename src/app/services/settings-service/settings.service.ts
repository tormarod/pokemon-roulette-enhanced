import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, Observable } from 'rxjs';

export interface GameSettings {
  muteAudio: boolean;
  volume: number;
  skipShinyRolls: boolean;
  skipMegaEvolutionAnimation: boolean;
  fastSpin: boolean;
  lessExplanations: boolean;
  defaultGender: 'male' | 'female' | 'always-choose';
  newExperienceMode: boolean;
}

@Injectable({
  providedIn: 'root'
})

export class SettingsService {
  private readonly STORAGE_KEY = 'pokemon-roulette-settings';
  private readonly defaultSettings: GameSettings = {
    muteAudio: false,
    volume: 1,
    skipShinyRolls: false,
    skipMegaEvolutionAnimation: false,
    fastSpin: false,
    lessExplanations: false,
    defaultGender: 'always-choose',
    newExperienceMode: true
  };

  private settingsSubject$: BehaviorSubject<GameSettings>;

  constructor() {
    this.settingsSubject$ = new BehaviorSubject(this.getInitialSettings());
  }

  get settings$(): Observable<GameSettings> {
    return this.settingsSubject$.asObservable().pipe(distinctUntilChanged());
  }

  get currentSettings(): GameSettings {
    return this.settingsSubject$.getValue();
  }

  toggleMuteAudio(): void {
    const currentSettings = this.currentSettings;
    const newSettings = { ...currentSettings, muteAudio: !currentSettings.muteAudio };
    this.updateSettings(newSettings);
  }

  toggleSkipShinyRolls(): void {
    const currentSettings = this.currentSettings;
    const newSettings = { ...currentSettings, skipShinyRolls: !currentSettings.skipShinyRolls };
    this.updateSettings(newSettings);
  }

  /** Clamped to [0, 1]. Independent of muteAudio, which stays a fast full-silence toggle. */
  setVolume(volume: number): void {
    const currentSettings = this.currentSettings;
    const newSettings = { ...currentSettings, volume: Math.max(0, Math.min(1, volume)) };
    this.updateSettings(newSettings);
  }

  toggleFastSpin(): void {
    const currentSettings = this.currentSettings;
    const newSettings = { ...currentSettings, fastSpin: !currentSettings.fastSpin };
    this.updateSettings(newSettings);
  }

  toggleSkipMegaEvolutionAnimation(): void {
    const currentSettings = this.currentSettings;
    const newSettings = {
      ...currentSettings,
      skipMegaEvolutionAnimation: !currentSettings.skipMegaEvolutionAnimation
    };
    this.updateSettings(newSettings);
  }

  toggleLessExplanations(): void {
    const currentSettings = this.currentSettings;
    const newSettings = { ...currentSettings, lessExplanations: !currentSettings.lessExplanations };
    this.updateSettings(newSettings);
  }

  setDefaultGender(gender: 'male' | 'female' | 'always-choose'): void {
    const currentSettings = this.currentSettings;
    const newSettings = { ...currentSettings, defaultGender: gender };
    this.updateSettings(newSettings);
  }

  toggleNewExperienceMode(): void {
    const currentSettings = this.currentSettings;
    const newSettings = { ...currentSettings, newExperienceMode: !currentSettings.newExperienceMode };
    this.updateSettings(newSettings);
  }

  resetSettings(): void {
    this.updateSettings(this.defaultSettings);
  }

  private updateSettings(newSettings: GameSettings): void {
    this.saveSettingsToStorage(newSettings);
    this.settingsSubject$.next(newSettings);
  }

  private getInitialSettings(): GameSettings {
    const settingsFromStorage = this.getSettingsFromStorage();
    return { ...this.defaultSettings, ...settingsFromStorage };
  }

  private saveSettingsToStorage(settings: GameSettings): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }

  private getSettingsFromStorage(): Partial<GameSettings> | null {
    const storageItem = localStorage.getItem(this.STORAGE_KEY);

    if (storageItem) {
      try {
        return JSON.parse(storageItem);
      } catch (error) {
        console.error(
          'Invalid settings localStorage item:',
          storageItem,
          'falling back to default settings'
        );
      }
    }

    return null;
  }
}
