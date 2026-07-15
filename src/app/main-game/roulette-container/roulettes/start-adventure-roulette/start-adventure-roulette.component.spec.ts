import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { StartAdventureRouletteComponent } from './start-adventure-roulette.component';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { TranslateModule } from '@ngx-translate/core';

describe('StartAdventureRouletteComponent', () => {
  let component: StartAdventureRouletteComponent;
  let fixture: ComponentFixture<StartAdventureRouletteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StartAdventureRouletteComponent, TranslateModule.forRoot()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StartAdventureRouletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not include Go Straight as a wheel option', () => {
    expect(component.actions.some(action => action.text === 'game.main.roulette.start.actions.goStraight')).toBeFalse();
  });

  it('should emit doNothingEvent directly from the standalone Go Straight button, bypassing the wheel', () => {
    spyOn(component.doNothingEvent, 'emit');

    fixture.nativeElement.querySelector('button.go-straight-button').click();

    expect(component.doNothingEvent.emit).toHaveBeenCalled();
  });

  it('should disable the Go Straight button while the wheel is spinning', () => {
    const wheel = fixture.debugElement.query(By.directive(WheelComponent)).componentInstance as WheelComponent;

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.go-straight-button');
    expect(button.disabled).toBeFalse();

    wheel.spinning = true;
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();

    wheel.spinning = false;
    fixture.detectChanges();
    expect(button.disabled).toBeFalse();
  });

  // ── onItemSelected: every remaining wheel index must map to its correct event ──

  it('should map every action index to its correct event, in order', () => {
    const emitterNames = ['catchPokemonEvent', 'battleTrainerEvent', 'buyPotionsEvent'] as const;

    emitterNames.forEach((emitterName, index) => {
      const spy = spyOn((component as any)[emitterName], 'emit');
      component.onItemSelected(index);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.calls.reset();
    });

    expect(component.actions.map(a => a.text)).toEqual([
      'game.main.roulette.start.actions.catchPokemon',
      'game.main.roulette.start.actions.battleTrainer',
      'game.main.roulette.start.actions.buyPotions',
    ]);
  });
});
