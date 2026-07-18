import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { EliteFourBattleRouletteComponent } from './elite-four-battle-roulette.component';
import { HttpClient } from '@angular/common/http';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';

describe('EliteFourBattleRouletteComponent', () => {
  let component: EliteFourBattleRouletteComponent;
  let fixture: ComponentFixture<EliteFourBattleRouletteComponent>;
  let trainerService: TrainerService;
  let modalQueueService: ModalQueueService;
  let gameStateService: GameStateService;
  let battlePrepService: BattlePrepService;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 4,
    text: 'pokemon.charmander',
    fillStyle: 'orange',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  const HYPER_POTION_ITEM: any = {
    name: 'hyper-potion',
    text: 'items.hyper-potion.name',
    fillStyle: 'blue',
    weight: 1,
    description: 'items.hyper-potion.description',
    sprite: 'hyper-potion.png',
  };

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(
      of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } })
    );

    await TestBed.configureTestingModule({
      imports: [EliteFourBattleRouletteComponent, TranslateModule.forRoot()],
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    }).compileComponents();

    fixture = TestBed.createComponent(EliteFourBattleRouletteComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    modalQueueService = TestBed.inject(ModalQueueService);
    gameStateService = TestBed.inject(GameStateService);
    battlePrepService = TestBed.inject(BattlePrepService);

    gameStateService.resetGameState();
    trainerService.resetTeam();

    // Elite-four component requires currentElite and currentRound inputs
    component.currentElite = { name: 'Lorelei', sprite: '', quotes: ['...'] } as GymLeader;
    component.currentRound = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── calcVictoryOdds: Elite Four has 2 base-no slices ─────────────────────

  it('should produce 1 yes and 2 no slices with empty team at round 0', () => {
    component.currentElite = { name: 'Lorelei', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.yes').length).toBe(1);
    // E4 starts harder: 0 round extras + 2 base = 2 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.no').length).toBe(2);
  });

  it('should accumulate yes from team power and no from round progression', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 3 }));
    component.currentElite = { name: 'Lorelei', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 1;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // base(1) + power(3) = 4 yes;  ceil(round(1)*1.5) + base(2) = 4 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.yes').length).toBe(4);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.no').length).toBe(4);
  });

  // ── Type-matchup wiring: the formula itself is tested once in
  // base-battle-roulette.component.spec.ts. These just confirm elite-four wires
  // its own baseNoCount(2) into it correctly, plus its own template rendering. ──

  it('should wire a mutual-advantage matchup into elite-four\'s own yes/no baseline', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' })); // SE + resists fire, netScore=2
    component.currentElite = { name: 'Lorelei', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.yes').length).toBe(5); // base(1) + power(2) + delta(2)
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.no').length).toBe(2); // elite's base(2) + round(0)
  });

  it('should wire a mutual-disadvantage matchup into elite-four\'s own No count (not a Yes reduction)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'grass' })); // weak + fire resists grass's counter, netScore=-2
    component.currentElite = { name: 'Lorelei', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();
    fixture.detectChanges();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.yes').length).toBe(3); // base(1) + power(2)
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.no').length).toBe(4);  // elite's base(2) + delta(2)

    const negLabel = fixture.nativeElement.querySelector('.matchup-label-negative');
    const negDelta = fixture.nativeElement.querySelector('.matchup-delta-negative');
    expect(negLabel).not.toBeNull();
    expect(negDelta.textContent.trim()).toBe('-2');
  });

  // ── onItemSelected: hyper-potion gives 3 retries ─────────────────────────

  it('should reset retries to 3 and consume hyper-potion on exhausted spin', () => {
    spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({} as NgbModalRef));
    (component as any).trainerItems = [HYPER_POTION_ITEM];
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.elite.no', fillStyle: 'crimson', weight: 1 },
    ];
    (component as any).retries = 1;
    spyOn(component.battleResultEvent, 'emit');

    component.onItemSelected(0);

    expect(component.battleResultEvent.emit).not.toHaveBeenCalledWith(false);
    expect((component as any).retries).toBe(3); // hyper-potion gives 3 retries
    expect((component as any).trainerItems.length).toBe(0);
  });

  // ── getCurrentElite: Gen 8 multi-elite handling ───────────────────────────

  it('should emit fromEliteChange for Gen 8 at a multi-elite round (round % 4 === 0)', (done) => {
    spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({} as NgbModalRef));

    (component as any).generation = { id: 8, text: 'Gen 8', region: 'Galar', fillStyle: 'purple', weight: 1 };
    component.currentRound = 0; // 0 % 4 === 0 → multi-elite path

    component.fromEliteChange.subscribe((index: number) => {
      expect(index).toBeGreaterThanOrEqual(0);
      done();
    });

    gameStateService.setNextState('elite-four-battle');
    gameStateService.finishCurrentState();
  });

  // ── New Experience mode: prep phase wiring ──────────────────────────────────

  describe('New Experience mode', () => {
    beforeEach(() => {
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({} as NgbModalRef));
      gameStateService.resetGameState(true);
      trainerService.resetTeam();
    });

    it('should show the prep panel (not skip to the wheel) on entering a fresh elite-four battle', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 3 }));
      component.currentRound = 0;

      gameStateService.setNextState('elite-four-battle');
      gameStateService.finishCurrentState();

      expect(component.prepPhase).toBeTrue();
    });

    it('should double the chosen lead\'s delta after confirming the prep', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' })); // SE + resists fire, netScore=2, delta=2
      component.currentElite = { name: 'Lorelei', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
      component.currentRound = 0;

      component.onPrepConfirmed({ leadIndex: 0, xAttackUsed: false });

      expect(component.prepPhase).toBeFalse();
      expect(component.matchupAdvantageDelta).toBe(4);
    });

    it('should consume the x-attack and add its bonus to yes odds after confirming', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 4 }));
      (component as any).trainerItems = [
        { name: 'x-attack', text: 'items.x-attack.name', fillStyle: 'red', weight: 1, description: '', sprite: '' }
      ];
      component.currentElite = { name: 'Lorelei', sprite: '', quotes: [] } as GymLeader;
      component.currentRound = 0;

      component.onPrepConfirmed({ leadIndex: 0, xAttackUsed: true });

      const odds: WheelItem[] = (component as any).victoryOdds;
      // base(1) + power(4) + xAttackBonus(meanPower=4) = 9
      expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.elite.yes').length).toBe(9);
    });


    it('should skip the prep panel and go straight to the wheel on reload after Confirm (anti-reroll)', () => {
      battlePrepService.commitPrep({ battleKey: 'elite-four-battle', leadIndex: 0, xAttackUsed: false });
      component.currentRound = 0;

      gameStateService.setNextState('elite-four-battle');
      gameStateService.finishCurrentState();

      expect(component.prepPhase).toBeFalse();
    });

    it('should clear the prep once the battle resolves (win)', () => {
      battlePrepService.commitPrep({ battleKey: 'elite-four-battle', leadIndex: 0, xAttackUsed: false });
      (component as any).victoryOdds = [
        { text: 'game.main.roulette.elite.yes', fillStyle: 'green', weight: 1 },
      ];
      spyOn(component.battleResultEvent, 'emit');

      component.onItemSelected(0);

      expect(battlePrepService.getPendingPrep()).toBeNull();
    });

    it('should clear the prep once the battle resolves (final loss, no potions left)', () => {
      battlePrepService.commitPrep({ battleKey: 'elite-four-battle', leadIndex: 0, xAttackUsed: false });
      (component as any).trainerItems = [];
      (component as any).victoryOdds = [
        { text: 'game.main.roulette.elite.no', fillStyle: 'crimson', weight: 1 },
      ];
      (component as any).retries = 1;
      spyOn(component.battleResultEvent, 'emit');

      component.onItemSelected(0);

      expect(battlePrepService.getPendingPrep()).toBeNull();
    });
  });
});
