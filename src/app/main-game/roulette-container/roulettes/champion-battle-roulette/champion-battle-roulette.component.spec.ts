import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChampionBattleRouletteComponent } from './champion-battle-roulette.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';

describe('ChampionBattleRouletteComponent', () => {
  let component: ChampionBattleRouletteComponent;
  let fixture: ComponentFixture<ChampionBattleRouletteComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let battlePrepService: BattlePrepService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 6,
    text: 'pokemon.charizard',
    fillStyle: 'orange',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);

    await TestBed.configureTestingModule({
      imports: [ChampionBattleRouletteComponent, TranslateModule.forRoot()],
      providers: [
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChampionBattleRouletteComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);
    battlePrepService = TestBed.inject(BattlePrepService);

    gameStateService.resetGameState();
    trainerService.resetTeam();

    component.currentRound = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Champion battles now factor type matchup, same as gym/elite four ──────

  it('should produce 1 yes and 3 no slices with an empty, untyped team at round 0', () => {
    component.currentChampion = { name: 'Blue', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.yes').length).toBe(1);
    // Champion battles are the toughest: 0 round extras + 3 base = 3 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.no').length).toBe(3);
  });

  // Type-matchup formula itself is tested once in
  // base-battle-roulette.component.spec.ts. This just confirms champion wires
  // its own baseNoCount(3) into it correctly.

  it('should wire a mutual-disadvantage matchup into champion\'s own No count (not a Yes reduction)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'grass' })); // weak + fire resists grass's counter, netScore=-2
    component.currentChampion = { name: 'Blue', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.yes').length).toBe(3); // base(1) + power(2)
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.no').length).toBe(5);  // champion's base(3) + delta(2)
  });

  // ── New Experience mode: prep phase wiring ──────────────────────────────────

  describe('New Experience mode', () => {
    beforeEach(() => {
      gameStateService.resetGameState(true);
      trainerService.resetTeam();
    });

    it('should show the prep panel (not skip to the wheel) on entering a fresh champion battle', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 3 }));
      component.currentRound = 0;

      gameStateService.setNextState('champion-battle');
      gameStateService.finishCurrentState();

      expect(component.prepPhase).toBeTrue();
    });

    it('should double the chosen lead\'s delta after confirming the prep', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' })); // SE + resists fire, netScore=2, delta=2
      component.currentChampion = { name: 'Blue', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
      component.currentRound = 0;

      component.onPrepConfirmed({ leadIndex: 0, xAttackUsed: false, potionUsed: null });

      expect(component.prepPhase).toBeFalse();
      expect(component.matchupAdvantageDelta).toBe(4);
    });

    it('should consume the x-attack and add its bonus to yes odds after confirming', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 4 }));
      (component as any).trainerItems = [
        { name: 'x-attack', text: 'items.x-attack.name', fillStyle: 'red', weight: 1, description: '', sprite: '' }
      ];
      component.currentChampion = { name: 'Blue', sprite: '', quotes: [] } as GymLeader;
      component.currentRound = 0;

      component.onPrepConfirmed({ leadIndex: 0, xAttackUsed: true, potionUsed: null });

      const odds: WheelItem[] = (component as any).victoryOdds;
      // base(1) + power(4) + xAttackBonus(meanPower=4) = 9
      expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.yes').length).toBe(9);
    });

    it('should bank a retry when a potion is chosen during prep', () => {
      (component as any).trainerItems = [
        { name: 'super-potion', text: 'items.super-potion.name', fillStyle: 'blue', weight: 1, description: '', sprite: '' }
      ];
      component.currentChampion = { name: 'Blue', sprite: '', quotes: [] } as GymLeader;
      component.currentRound = 0;

      component.onPrepConfirmed({ leadIndex: 0, xAttackUsed: false, potionUsed: 'super-potion' });

      expect((component as any).retries).toBe(2);
      expect((component as any).trainerItems.length).toBe(0);
    });

    it('should skip the prep panel and go straight to the wheel on reload after Confirm (anti-reroll)', () => {
      battlePrepService.commitPrep({ battleKey: 'champion-battle', leadIndex: 0, xAttackUsed: false, potionUsed: null });
      component.currentRound = 0;

      gameStateService.setNextState('champion-battle');
      gameStateService.finishCurrentState();

      expect(component.prepPhase).toBeFalse();
    });

    it('should clear the prep once the battle resolves (win)', () => {
      battlePrepService.commitPrep({ battleKey: 'champion-battle', leadIndex: 0, xAttackUsed: false, potionUsed: null });
      (component as any).victoryOdds = [
        { text: 'game.main.roulette.champion.yes', fillStyle: 'green', weight: 1 },
      ];
      spyOn(component.battleResultEvent, 'emit');

      component.onItemSelected(0);

      expect(battlePrepService.getPendingPrep()).toBeNull();
    });

    it('should clear the prep once the battle resolves (final loss, no potions left)', () => {
      battlePrepService.commitPrep({ battleKey: 'champion-battle', leadIndex: 0, xAttackUsed: false, potionUsed: null });
      (component as any).trainerItems = [];
      (component as any).victoryOdds = [
        { text: 'game.main.roulette.champion.no', fillStyle: 'crimson', weight: 1 },
      ];
      (component as any).retries = 1;
      spyOn(component.battleResultEvent, 'emit');

      component.onItemSelected(0);

      expect(battlePrepService.getPendingPrep()).toBeNull();
    });
  });
});
