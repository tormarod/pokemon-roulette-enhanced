import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { AdventureDrawService } from '../../../../services/adventure-draw-service/adventure-draw.service';
import { DangerMeterService } from '../../../../services/danger-meter-service/danger-meter.service';

import { MainAdventureRouletteComponent } from './main-adventure-roulette.component';
import { WheelComponent } from '../../../../wheel/wheel.component';

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

describe('MainAdventureRouletteComponent — New Experience mode', () => {
  let component: MainAdventureRouletteComponent;
  let fixture: ComponentFixture<MainAdventureRouletteComponent>;
  let gameStateService: GameStateService;
  let adventureDrawService: AdventureDrawService;
  let dangerMeterService: DangerMeterService;

  const createGeneration = (id: number): GenerationItem => ({
    id,
    text: `Gen ${id}`,
    region: 'Test Region',
    fillStyle: 'black',
    weight: 1
  });

  const configureFreshTestBed = () => {
    TestBed.configureTestingModule({
      imports: [MainAdventureRouletteComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: GenerationService,
          useValue: {
            getGeneration: () => new BehaviorSubject<GenerationItem>(createGeneration(1)).asObservable(),
            getCurrentGeneration: () => createGeneration(1)
          }
        }
      ]
    });
  };

  beforeEach(() => {
    configureFreshTestBed();
    gameStateService = TestBed.inject(GameStateService);
    adventureDrawService = TestBed.inject(AdventureDrawService);
    dangerMeterService = TestBed.inject(DangerMeterService);
    gameStateService.resetGameState(true);
    // Match production reality: this component only ever mounts once the
    // real state machine (RouletteContainerComponent's @switch) has already
    // reached 'adventure-continues' — the component's own state subscription
    // relies on that being true at subscribe time (see main-adventure-roulette
    // .component.ts ngOnInit for why).
    gameStateService.setNextState('adventure-continues');
    gameStateService.finishCurrentState();
  });

  const createFixture = () => {
    fixture = TestBed.createComponent(MainAdventureRouletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should render the danger meter and 3 pick cards instead of the wheel', () => {
    createFixture();

    expect(fixture.nativeElement.querySelector('app-danger-meter')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('button.adventure-card').length).toBe(3);
    expect(fixture.debugElement.query(By.directive(WheelComponent))).toBeFalsy();
  });

  it('should draw 3 distinct candidates and commit them via AdventureDrawService', () => {
    createFixture();

    expect(component.candidates.length).toBe(3);
    const ids = component.candidates.map(c => c.id);
    expect(new Set(ids).size).toBe(3);

    const draw = adventureDrawService.getPendingDraw();
    expect(draw).toBeTruthy();
    expect(draw!.candidates).toEqual(ids);
    expect(draw!.picked).toBeNull();
  });

  it('should route a picked candidate to its matching output event and clear the draw', () => {
    createFixture();
    spyOn(component.buyPotionsEvent, 'emit');
    // Force a known draw so the test isn't at the mercy of the random pool.
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'buyPotions', 'findItem'], picked: null });
    component.candidates = component['resolveCandidates'](['catchPokemon', 'buyPotions', 'findItem']);

    component.onCandidatePicked(1);

    expect(component.buyPotionsEvent.emit).toHaveBeenCalled();
    expect(adventureDrawService.getPendingDraw()).toBeNull();
  });

  it('should ignore a second pick once one has already been committed', () => {
    createFixture();
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'buyPotions', 'findItem'], picked: 0 });

    spyOn(component.buyPotionsEvent, 'emit');
    component.onCandidatePicked(1);

    expect(component.buyPotionsEvent.emit).not.toHaveBeenCalled();
  });

  it('should re-show the same candidates on reload when a draw exists with no pick yet', () => {
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'buyPotions', 'findItem'], picked: null });

    createFixture();

    expect(component.candidates.map(c => c.id)).toEqual(['catchPokemon', 'buyPotions', 'findItem']);
  });

  it('should replay the picked outcome immediately on reload when a pick was already committed', () => {
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'buyPotions', 'findItem'], picked: 1 });

    fixture = TestBed.createComponent(MainAdventureRouletteComponent);
    component = fixture.componentInstance;
    spyOn(component.buyPotionsEvent, 'emit');

    fixture.detectChanges(); // runs ngOnInit, which should replay the committed pick

    expect(component.buyPotionsEvent.emit).toHaveBeenCalled();
    expect(adventureDrawService.getPendingDraw()).toBeNull();
  });

  it('should call DangerMeterService.rollStep with the current round when drawing fresh', () => {
    spyOn(dangerMeterService, 'rollStep').and.callThrough();

    createFixture();

    expect(dangerMeterService.rollStep).toHaveBeenCalledWith(0);
  });

  // ── Regression: multitask returned to the same 'adventure-continues' state ──
  // without the component being destroyed/recreated (Angular's @switch only
  // rebuilds on a genuine case change), so a fresh draw never happened and the
  // choose-between panel appeared frozen. Fixed by subscribing to
  // gameStateService.currentState instead of only drawing once in ngOnInit.

  it('should draw a fresh set of candidates when the state re-enters adventure-continues without the component being recreated', () => {
    createFixture();
    const firstDraw = adventureDrawService.getPendingDraw();
    expect(firstDraw).toBeTruthy();

    // Simulate what routeCandidate() + multitask() do: clear the committed
    // draw, then push/pop back to the SAME 'adventure-continues' state —
    // the exact same component instance is still mounted throughout.
    adventureDrawService.clearDraw();
    expect(adventureDrawService.getPendingDraw()).toBeNull();

    gameStateService.setNextState('adventure-continues');
    gameStateService.finishCurrentState();

    const secondDraw = adventureDrawService.getPendingDraw();
    expect(secondDraw).toBeTruthy();
    expect(component.candidates.length).toBe(3);
  });

  it('onGoStraight should clear the pending draw and emit doNothingEvent', () => {
    createFixture();
    spyOn(component.doNothingEvent, 'emit');
    expect(adventureDrawService.getPendingDraw()).toBeTruthy();

    fixture.nativeElement.querySelector('button.go-straight-button').click();

    expect(component.doNothingEvent.emit).toHaveBeenCalled();
    expect(adventureDrawService.getPendingDraw()).toBeNull();
  });

  // ── V2 Part A phase 3: threat pool ──────────────────────────────────────

  it('should draw from the threat pool when rollStep returns "threat"', () => {
    spyOn(dangerMeterService, 'rollStep').and.returnValue('threat');

    createFixture();

    const draw = adventureDrawService.getPendingDraw();
    expect(draw!.stepType).toBe('threat');
    const threatIds = ['teamRocketAmbush', 'itemTheft', 'toll', 'badOmen'];
    expect(component.candidates.every(c => threatIds.includes(c.id))).toBeTrue();
    expect(component.candidates.length).toBe(3);
  });

  it('should route itemTheft/toll/badOmen/teamRocketAmbush threat picks to their matching output events', () => {
    createFixture();
    const cases: { id: string; emitterName: keyof MainAdventureRouletteComponent }[] = [
      { id: 'itemTheft', emitterName: 'itemTheftEvent' },
      { id: 'toll', emitterName: 'tollEvent' },
      { id: 'badOmen', emitterName: 'badOmenEvent' },
      { id: 'teamRocketAmbush', emitterName: 'teamRocketEncounterEvent' },
    ];

    cases.forEach(({ id, emitterName }) => {
      adventureDrawService.restoreDraw({ stepType: 'threat', candidates: [id, 'toll', 'badOmen'], picked: null });
      component.candidates = (component as any).resolveCandidates([id, 'toll', 'badOmen']);
      const spy = spyOn(component[emitterName] as any, 'emit');

      component.onCandidatePicked(0);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(adventureDrawService.getPendingDraw()).toBeNull();
    });
  });
});
