import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { DangerMeterComponent } from './danger-meter.component';

describe('DangerMeterComponent', () => {
  let component: DangerMeterComponent;
  let fixture: ComponentFixture<DangerMeterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DangerMeterComponent, TranslateModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(DangerMeterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render the dangerPercent value', () => {
    fixture.componentRef.setInput('dangerPercent', 42);
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
    fixture.componentRef.setInput('isNextStepGuaranteedSafe', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.danger-meter-safe-badge')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.shielded')).toBeTruthy();
  });

  it('should not show the relief cue on first render', () => {
    fixture.componentRef.setInput('dangerPercent', 50);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.danger-meter-relief-cue')).toBeFalsy();
  });

  it('should show the relief cue when dangerPercent drops after an initial value', () => {
    fixture.componentRef.setInput('dangerPercent', 50);
    fixture.detectChanges();

    fixture.componentRef.setInput('dangerPercent', 30);
    fixture.detectChanges();

    expect(component.showReliefCue).toBeTrue();
    expect(fixture.nativeElement.querySelector('.danger-meter-relief-cue')).toBeTruthy();
  });

  it('should not show the relief cue when dangerPercent rises', () => {
    fixture.componentRef.setInput('dangerPercent', 30);
    fixture.detectChanges();

    fixture.componentRef.setInput('dangerPercent', 50);
    fixture.detectChanges();

    expect(component.showReliefCue).toBeFalse();
  });
});
