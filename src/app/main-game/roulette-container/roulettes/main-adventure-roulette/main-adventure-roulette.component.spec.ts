import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { GenerationService } from '../../../../services/generation-service/generation.service';

import { MainAdventureRouletteComponent } from './main-adventure-roulette.component';

describe('MainAdventureRouletteComponent', () => {
  let component: MainAdventureRouletteComponent;
  let fixture: ComponentFixture<MainAdventureRouletteComponent>;
  let generationSubject: BehaviorSubject<GenerationItem>;

  const createGeneration = (id: number): GenerationItem => ({
    id,
    text: `Gen ${id}`,
    region: 'Test Region',
    fillStyle: 'black',
    weight: 1
  });

  beforeEach(async () => {
    generationSubject = new BehaviorSubject<GenerationItem>(createGeneration(1));

    await TestBed.configureTestingModule({
      imports: [MainAdventureRouletteComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: GenerationService,
          useValue: {
            getGeneration: () => generationSubject.asObservable(),
            getCurrentGeneration: () => createGeneration(1)
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainAdventureRouletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should keep the base action list for non-gen-9 generations', () => {
    expect(component.actions.length).toBe(16);
    expect(component.actions.some(action => action.text === 'game.main.roulette.adventure.actions.areaZero')).toBeFalse();
  });

  it('should append the Area Zero action for generation 9', () => {
    generationSubject.next(createGeneration(9));
    fixture.detectChanges();

    expect(component.actions.length).toBe(17);
    expect(component.actions[16].text).toBe('game.main.roulette.adventure.actions.areaZero');
  });

  it('should emit the Area Zero event from the gen-9-only slot', () => {
    spyOn(component.areaZeroEvent, 'emit');

    component.onItemSelected(16);

    expect(component.areaZeroEvent.emit).toHaveBeenCalled();
  });

  it('should not include Go Straight as a wheel option', () => {
    expect(component.actions.some(action => action.text === 'game.main.roulette.adventure.actions.goStraight')).toBeFalse();
  });

  it('should emit doNothingEvent directly from the standalone Go Straight button, bypassing the wheel', () => {
    spyOn(component.doNothingEvent, 'emit');

    fixture.nativeElement.querySelector('button.btn-outline-secondary').click();

    expect(component.doNothingEvent.emit).toHaveBeenCalled();
  });

  // ── onItemSelected: every remaining wheel index must map to its correct event ──
  // (regression coverage for re-indexing after removing Go Straight from the array)

  it('should map every base action index to its correct event, in order', () => {
    const emitterNames = [
      'catchPokemonEvent', 'battleTrainerEvent', 'buyPotionsEvent', 'catchTwoPokemonEvent',
      'visitDaycareEvent', 'teamRocketEncounterEvent', 'mysteriousEggEvent', 'legendaryEncounterEvent',
      'tradePokemonEvent', 'findItemEvent', 'exploreCaveEvent', 'snorlaxEncounterEvent',
      'multitaskEvent', 'goFishingEvent', 'findFossilEvent', 'battleRivalEvent',
    ] as const;

    emitterNames.forEach((emitterName, index) => {
      const spy = spyOn((component as any)[emitterName], 'emit');
      component.onItemSelected(index);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.calls.reset();
    });

    // Sanity check the array itself lines up with the emitter list above, action-by-action
    expect(component.actions.map(a => a.text)).toEqual([
      'game.main.roulette.adventure.actions.catchPokemon',
      'game.main.roulette.adventure.actions.battleTrainer',
      'game.main.roulette.adventure.actions.buyPotions',
      'game.main.roulette.adventure.actions.catchTwoPokemon',
      'game.main.roulette.adventure.actions.visitDaycare',
      'game.main.roulette.adventure.actions.teamRocket',
      'game.main.roulette.adventure.actions.mysteriousEgg',
      'game.main.roulette.adventure.actions.legendaryEncounter',
      'game.main.roulette.adventure.actions.tradePokemon',
      'game.main.roulette.adventure.actions.findItem',
      'game.main.roulette.adventure.actions.exploreCave',
      'game.main.roulette.adventure.actions.snorlaxEncounter',
      'game.main.roulette.adventure.actions.multitask',
      'game.main.roulette.adventure.actions.goFishing',
      'game.main.roulette.adventure.actions.findFossil',
      'game.main.roulette.adventure.actions.battleRival',
    ]);
  });
});
