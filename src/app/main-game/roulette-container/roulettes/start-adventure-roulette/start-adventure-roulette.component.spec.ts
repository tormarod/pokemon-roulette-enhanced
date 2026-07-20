import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartAdventureRouletteComponent } from './start-adventure-roulette.component';
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

  // ── onItemSelected: every wheel index must map to its correct event ──

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
