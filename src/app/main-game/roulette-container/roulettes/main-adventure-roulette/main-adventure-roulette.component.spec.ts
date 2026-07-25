import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { AdventureDrawService } from '../../../../services/adventure-draw-service/adventure-draw.service';
import { DangerMeterService } from '../../../../services/danger-meter-service/danger-meter.service';

import { MainAdventureRouletteComponent } from './main-adventure-roulette.component';

describe('MainAdventureRouletteComponent', () => {
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
    gameStateService.resetGameState();
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

  it('should create', () => {
    spyOn(dangerMeterService, 'rollStep').and.returnValue('reward');
    createFixture();
    expect(component).toBeTruthy();
  });

  it('should render 3 pick rows instead of the wheel', () => {
    spyOn(dangerMeterService, 'rollStep').and.returnValue('reward');
    createFixture();

    expect(fixture.nativeElement.querySelectorAll('button.adventure-row').length).toBe(3);
  });

  it('should draw 3 distinct candidates and commit them via AdventureDrawService', () => {
    spyOn(dangerMeterService, 'rollStep').and.returnValue('reward');
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
    spyOn(component.foundCoinsEvent, 'emit');
    // Force a known draw so the test isn't at the mercy of the random pool.
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'foundCoins', 'findItem'], picked: null });
    component.candidates = component['resolveCandidates'](['catchPokemon', 'foundCoins', 'findItem']);

    component.onCandidatePicked(1);

    expect(component.foundCoinsEvent.emit).toHaveBeenCalled();
    expect(adventureDrawService.getPendingDraw()).toBeNull();
  });

  it('should ignore a second pick once one has already been committed', () => {
    createFixture();
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'foundCoins', 'findItem'], picked: 0 });

    spyOn(component.foundCoinsEvent, 'emit');
    component.onCandidatePicked(1);

    expect(component.foundCoinsEvent.emit).not.toHaveBeenCalled();
  });

  it('should re-show the same candidates on reload when a draw exists with no pick yet', () => {
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'foundCoins', 'findItem'], picked: null });

    createFixture();

    expect(component.candidates.map(c => c.id)).toEqual(['catchPokemon', 'foundCoins', 'findItem']);
  });

  it('should replay the picked outcome immediately on reload when a pick was already committed', async () => {
    adventureDrawService.restoreDraw({ stepType: 'reward', candidates: ['catchPokemon', 'foundCoins', 'findItem'], picked: 1 });

    fixture = TestBed.createComponent(MainAdventureRouletteComponent);
    component = fixture.componentInstance;
    spyOn(component.foundCoinsEvent, 'emit');

    fixture.detectChanges(); // runs ngOnInit, which should replay the committed pick
    await Promise.resolve(); // flush the routing microtask (see initializeDraw()'s comment)

    expect(component.foundCoinsEvent.emit).toHaveBeenCalled();
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
    spyOn(dangerMeterService, 'rollStep').and.returnValue('reward');
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

  // ── V2 Part A phase 3: threat pool ──────────────────────────────────────

  it('should auto-draw and auto-route a single threat candidate when rollStep returns "threat", without going through onCandidatePicked', async () => {
    spyOn(dangerMeterService, 'rollStep').and.returnValue('threat');

    createFixture();

    // stepType and candidates are set synchronously inside createFixture() (ngOnInit's
    // state subscription -> initializeDraw()) — no cards are ever shown. The actual
    // routing is deferred to a microtask (see initializeDraw()'s comment on why: routing
    // can itself trigger another state transition, which would otherwise be reentrant
    // with the CD pass that's still mounting this very component) — flush it before
    // asserting the draw was consumed.
    expect(component.stepType).toBe('threat');
    expect(component.candidates.length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('button.adventure-row').length).toBe(0);

    await Promise.resolve();

    expect(adventureDrawService.getPendingDraw()).toBeNull();
  });

  it('should route each threat id to its matching output event via the auto-draw/auto-route path', async () => {
    const cases: { id: string; emitterName: keyof MainAdventureRouletteComponent }[] = [
      { id: 'itemTheft', emitterName: 'itemTheftEvent' },
      { id: 'forcedRetreat', emitterName: 'forcedRetreatEvent' },
      { id: 'badOmen', emitterName: 'badOmenEvent' },
      { id: 'spooked', emitterName: 'spookedEvent' },
      { id: 'markedTarget', emitterName: 'markedTargetEvent' },
      { id: 'pokeballMalfunction', emitterName: 'pokeballMalfunctionEvent' },
      { id: 'teamRocketAmbush', emitterName: 'teamRocketAmbushEvent' },
      { id: 'tollBooth', emitterName: 'tollBoothEvent' },
      { id: 'scoutingReport', emitterName: 'scoutingReportEvent' },
      { id: 'pcLockout', emitterName: 'pcLockoutEvent' },
    ];

    for (const { id, emitterName } of cases) {
      // Mirrors the reload-replay test's pattern: a threat draw is already
      // committed with picked === 0 (as the new auto-draw path always leaves it),
      // and initializeDraw() should replay routeCandidate on mount either way.
      adventureDrawService.restoreDraw({ stepType: 'threat', candidates: [id], picked: 0 });

      fixture = TestBed.createComponent(MainAdventureRouletteComponent);
      component = fixture.componentInstance;
      const spy = spyOn(component[emitterName] as any, 'emit');

      fixture.detectChanges();
      await Promise.resolve(); // flush the routing microtask

      expect(spy).toHaveBeenCalledTimes(1);
      expect(adventureDrawService.getPendingDraw()).toBeNull();
    }
  });

  it('should set stepType to "reward" after a reward draw and "threat" after a threat draw', () => {
    const rollStepSpy = spyOn(dangerMeterService, 'rollStep').and.returnValue('reward');
    createFixture();
    expect(component.stepType).toBe('reward');

    adventureDrawService.clearDraw();
    rollStepSpy.and.returnValue('threat');
    gameStateService.setNextState('adventure-continues');
    gameStateService.finishCurrentState();

    expect(component.stepType).toBe('threat');
  });

  it('should replay a threat draw on reload before it was routed', async () => {
    adventureDrawService.restoreDraw({ stepType: 'threat', candidates: ['itemTheft'], picked: 0 });

    fixture = TestBed.createComponent(MainAdventureRouletteComponent);
    component = fixture.componentInstance;
    spyOn(component.itemTheftEvent, 'emit');

    fixture.detectChanges(); // runs ngOnInit, which should replay the committed threat pick
    await Promise.resolve(); // flush the routing microtask

    expect(component.itemTheftEvent.emit).toHaveBeenCalled();
    expect(adventureDrawService.getPendingDraw()).toBeNull();
  });

  it('should never draw an excluded threat id (Phase 1 draw-filter)', async () => {
    spyOn(dangerMeterService, 'rollStep').and.returnValue('threat');
    createFixture();
    await Promise.resolve(); // flush the initial (unfiltered) draw's routing microtask

    fixture.componentRef.setInput('excludedThreatIds', ['forcedRetreat', 'markedTarget']);
    const forcedRetreatSpy = spyOn(component.forcedRetreatEvent, 'emit');
    const markedTargetSpy = spyOn(component.markedTargetEvent, 'emit');

    for (let i = 0; i < 50; i++) {
      adventureDrawService.clearDraw();
      gameStateService.setNextState('adventure-continues');
      gameStateService.finishCurrentState();
      await Promise.resolve();
    }

    expect(forcedRetreatSpy).not.toHaveBeenCalled();
    expect(markedTargetSpy).not.toHaveBeenCalled();
  });
});
