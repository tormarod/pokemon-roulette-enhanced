import { TestBed } from '@angular/core/testing';

import { SettingsService } from './settings.service';

describe('SettingsServiceService', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default volume to 1 and fastSpin to false', () => {
    expect(service.currentSettings.volume).toBe(1);
    expect(service.currentSettings.fastSpin).toBeFalse();
  });

  it('should set volume', () => {
    service.setVolume(0.4);
    expect(service.currentSettings.volume).toBe(0.4);
  });

  it('should clamp volume to [0, 1]', () => {
    service.setVolume(-0.5);
    expect(service.currentSettings.volume).toBe(0);

    service.setVolume(1.5);
    expect(service.currentSettings.volume).toBe(1);
  });

  it('should toggle fastSpin', () => {
    service.toggleFastSpin();
    expect(service.currentSettings.fastSpin).toBeTrue();

    service.toggleFastSpin();
    expect(service.currentSettings.fastSpin).toBeFalse();
  });

  it('should default newExperienceMode to true', () => {
    expect(service.currentSettings.newExperienceMode).toBeTrue();
  });

  it('should toggle newExperienceMode', () => {
    service.toggleNewExperienceMode();
    expect(service.currentSettings.newExperienceMode).toBeFalse();

    service.toggleNewExperienceMode();
    expect(service.currentSettings.newExperienceMode).toBeTrue();
  });

  it('should persist newExperienceMode across a fresh service instance (localStorage)', () => {
    service.toggleNewExperienceMode();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restored = TestBed.inject(SettingsService);

    expect(restored.currentSettings.newExperienceMode).toBeFalse();
  });
});
