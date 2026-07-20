import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { EliteFourPrepRouletteComponent } from './elite-four-prep-roulette.component';

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

  // ── onItemSelected: every wheel index must map to its correct event ──

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
