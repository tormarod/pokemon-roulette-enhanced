import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

import { EliteFourPrepRouletteComponent } from './elite-four-prep-roulette.component';
import { WheelComponent } from '../../../../wheel/wheel.component';

describe('EliteFourPrepRouletteComponent', () => {
  let component: EliteFourPrepRouletteComponent;
  let fixture: ComponentFixture<EliteFourPrepRouletteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliteFourPrepRouletteComponent, TranslateModule.forRoot()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EliteFourPrepRouletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not include Go Straight as a wheel option', () => {
    expect(component.actions.some(action => action.text === 'game.main.roulette.elite.prep.actions.goStraight')).toBeFalse();
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
  // (regression coverage for re-indexing after removing Go Straight from the array)

  it('should map every action index to its correct event, in order', () => {
    const emitterNames = [
      'battleTrainerEvent', 'buyPotionsEvent', 'catchTwoPokemonEvent', 'catchThreePokemonEvent',
      'legendaryEncounterEvent', 'findItemEvent', 'teamRocketEncounterEvent',
    ] as const;

    emitterNames.forEach((emitterName, index) => {
      const spy = spyOn((component as any)[emitterName], 'emit');
      component.onItemSelected(index);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.calls.reset();
    });

    expect(component.actions.map(a => a.text)).toEqual([
      'game.main.roulette.elite.prep.actions.trainingArc',
      'game.main.roulette.elite.prep.actions.buyPotions',
      'game.main.roulette.elite.prep.actions.catchTwoPokemon',
      'game.main.roulette.elite.prep.actions.catchThreePokemon',
      'game.main.roulette.elite.prep.actions.huntLegendary',
      'game.main.roulette.elite.prep.actions.findItem',
      'game.main.roulette.elite.prep.actions.teamRocket',
    ]);
  });
});
