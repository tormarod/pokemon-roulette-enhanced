import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { SettingsComponent } from './settings.component';
import { TranslateModule } from '@ngx-translate/core';
import { provideIcons } from '@ng-icons/core';
import { bootstrapController, bootstrapGear } from '@ng-icons/bootstrap-icons';
import { SettingsService } from '../services/settings-service/settings.service';
import { RunPersistenceService } from '../services/run-persistence-service/run-persistence.service';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  beforeEach(async () => {
    localStorage.clear();
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } }));

    await TestBed.configureTestingModule({
      imports: [SettingsComponent, TranslateModule.forRoot()],
      providers: [
        provideIcons({ bootstrapController, bootstrapGear }),
        { provide: HttpClient, useValue: httpSpyObj },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set volume via the settings service on volume change', () => {
    const settingsService = TestBed.inject(SettingsService);
    spyOn(settingsService, 'setVolume');

    component.onVolumeChange('0.5');

    expect(settingsService.setVolume).toHaveBeenCalledWith(0.5);
  });

  it('should toggle fast spin via the settings service', () => {
    const settingsService = TestBed.inject(SettingsService);
    spyOn(settingsService, 'toggleFastSpin');

    component.onToggleFastSpin();

    expect(settingsService.toggleFastSpin).toHaveBeenCalled();
  });

  it('should start a fresh run and navigate home on restart', () => {
    const runPersistenceService = TestBed.inject(RunPersistenceService);
    const router = TestBed.inject(Router);
    spyOn(runPersistenceService, 'startFreshRun');
    spyOn(router, 'navigate');

    component.onRestartGame();

    expect(runPersistenceService.startFreshRun).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['']);
  });
});
