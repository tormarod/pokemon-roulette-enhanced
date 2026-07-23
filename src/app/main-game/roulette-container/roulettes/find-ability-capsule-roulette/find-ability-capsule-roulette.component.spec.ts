import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { FindAbilityCapsuleRouletteComponent } from './find-ability-capsule-roulette.component';

describe('FindAbilityCapsuleRouletteComponent', () => {
  let component: FindAbilityCapsuleRouletteComponent;
  let fixture: ComponentFixture<FindAbilityCapsuleRouletteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FindAbilityCapsuleRouletteComponent, TranslateModule.forRoot()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FindAbilityCapsuleRouletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load the capsule pool', () => {
    expect(component).toBeTruthy();
    expect(component.capsules.length).toBe(30);
  });

  it('emits the selected capsule after the explainer modal resolves', (done) => {
    const spy = spyOn(component.capsuleSelectedEvent, 'emit');
    // Stub the modal so the flow completes synchronously without a real modal.
    spyOn(component['modalQueueService'], 'open').and.returnValue(
      Promise.resolve({ componentInstance: {}, result: Promise.resolve(true) } as any)
    );

    component.onCapsuleSelected(0);

    // Let the chained promises resolve.
    setTimeout(() => {
      expect(component.selectedCapsule).toBe(component.capsules[0]);
      expect(spy).toHaveBeenCalledWith(component.capsules[0]);
      done();
    });
  });
});
