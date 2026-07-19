import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

import { DangerMeterComponent } from './danger-meter.component';
import { DangerMeterService } from '../../services/danger-meter-service/danger-meter.service';

describe('DangerMeterComponent', () => {
  let component: DangerMeterComponent;
  let fixture: ComponentFixture<DangerMeterComponent>;
  let dangerMeterService: DangerMeterService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DangerMeterComponent, TranslateModule.forRoot()]
    }).compileComponents();

    dangerMeterService = TestBed.inject(DangerMeterService);
    dangerMeterService.resetForNewRun();

    fixture = TestBed.createComponent(DangerMeterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render the current dangerPercent from DangerMeterService', () => {
    dangerMeterService.restore(42, 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('42%');
  });

  it('colorClass should be danger-low below 30, danger-medium below 60, danger-high at 60+', () => {
    component.dangerPercent = 10;
    expect(component.colorClass).toBe('danger-low');

    component.dangerPercent = 45;
    expect(component.colorClass).toBe('danger-medium');

    component.dangerPercent = 75;
    expect(component.colorClass).toBe('danger-high');
  });

  it('should show the shielded/safe badge when isNextStepGuaranteedSafe is true', () => {
    dangerMeterService.restore(50, 2); // PITY - 1 = 2 consecutive threats -> guaranteed safe next
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.danger-meter-safe-badge')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.shielded')).toBeTruthy();
  });

  it('should not show the relief cue on first render', () => {
    dangerMeterService.restore(50, 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.danger-meter-relief-cue')).toBeFalsy();
  });

  it('should show the relief cue when dangerPercent drops after an initial value', () => {
    dangerMeterService.restore(50, 0);
    fixture.detectChanges();

    dangerMeterService.restore(30, 0);
    fixture.detectChanges();

    expect(component.showReliefCue).toBeTrue();
    expect(fixture.nativeElement.querySelector('.danger-meter-relief-cue')).toBeTruthy();
  });

  it('should not show the relief cue when dangerPercent rises', () => {
    dangerMeterService.restore(30, 0);
    fixture.detectChanges();

    dangerMeterService.restore(50, 0);
    fixture.detectChanges();

    expect(component.showReliefCue).toBeFalse();
  });

  it('should wire a hover/tap help tooltip onto the meter', () => {
    fixture.detectChanges();

    const tooltip = fixture.debugElement.query(By.directive(NgbTooltip)).injector.get(NgbTooltip);
    expect(tooltip.ngbTooltip).toBeTruthy();
    expect(tooltip.triggers).toBe('hover click');
  });
});
