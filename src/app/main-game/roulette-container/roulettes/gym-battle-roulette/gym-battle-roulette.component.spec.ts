import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { GymBattleRouletteComponent } from './gym-battle-roulette.component';
import { HttpClient } from '@angular/common/http';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';

describe('GymBattleRouletteComponent', () => {
  let component: GymBattleRouletteComponent;
  let fixture: ComponentFixture<GymBattleRouletteComponent>;
  let trainerService: TrainerService;
  let generationService: GenerationService;
  let modalQueueService: ModalQueueService;
  let gameStateService: GameStateService;

  /** Pre-set sprite prevents loadPokemonSpriteIfMissing from calling HTTP. */
  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.bulbasaur',
    fillStyle: 'green',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  const POTION_ITEM: any = {
    name: 'potion',
    text: 'items.potion.name',
    fillStyle: 'purple',
    weight: 1,
    description: 'items.potion.description',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
  };

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(
      of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } })
    );

    await TestBed.configureTestingModule({
      imports: [GymBattleRouletteComponent, TranslateModule.forRoot()],
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    }).compileComponents();

    fixture = TestBed.createComponent(GymBattleRouletteComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    generationService = TestBed.inject(GenerationService);
    modalQueueService = TestBed.inject(ModalQueueService);
    gameStateService = TestBed.inject(GameStateService);

    gameStateService.resetGameState();
    trainerService.resetTeam();

    component.currentLeader = { name: 'Brock', sprite: '', quotes: ['Quote'] } as GymLeader;
    component.currentRound = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── calcVictoryOdds: slice count by team power ────────────────────────────

  it('should produce 1 yes and 1 no slice with empty team at round 0', () => {
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(1);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(1);
  });

  it('should add yes slices proportional to team power — power 2 gives 3 yes', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2 }));
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // base(1) + power(2) = 3 yes;  round(0) + base(1) = 1 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(3);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(1);
  });

  it('should add extra no slices proportional to current round — round 2 gives 3 no', () => {
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 2;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // empty team → 1 yes;  round(2) + base(1) = 3 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(1);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(3);
  });

  // ── Type-matchup: capped per-Pokémon delta drives yes-ticket count ─────────

  it('should boost yes slices for a single strong-matched Pokémon (team size 1 -> delta 1)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' }));
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // base(1) + effectivePower(2+1=3) = 4 yes;  round(0) + base(1) = 1 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(4);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(1);
    expect(component.advantageLabel).toBe('advantage');
  });

  it('should reduce yes slices for a single weak-matched Pokémon, floored at 1 effective power', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'grass' }));
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // base(1) + effectivePower(max(1, 2-1)=1) = 2 yes;  1 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(2);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(1);
    expect(component.advantageLabel).toBe('disadvantage');
  });

  it('should use the full delta (2) once the team has 5-6 members', () => {
    for (let i = 0; i < 6; i++) {
      trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' }));
    }
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // base(1) + 6 * (2+2=4) = 25 yes;  1 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(25);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(1);
    expect(component.advantageLabel).toBe('overwhelming');
  });

  it('should not adjust yes slices when the leader has no configured types', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'water' }));
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader; // no types
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(4); // base(1) + power(3)
    expect(component.advantageLabel).toBeNull();
  });

  // ── onItemSelected: item-use paths ───────────────────────────────────────

  it('should emit true on winning spin regardless of retries', () => {
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.gym.yes', fillStyle: 'green', weight: 1 },
    ];
    (component as any).retries = 3;
    spyOn(component.battleResultEvent, 'emit');

    component.onItemSelected(0);

    expect(component.battleResultEvent.emit).toHaveBeenCalledWith(true);
  });

  it('should reset retries to 1 and consume potion on failed spin when potion is available', () => {
    spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({} as NgbModalRef));
    // Directly assign trainerItems to bypass resetItems() reference staleness
    (component as any).trainerItems = [POTION_ITEM];
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.gym.no', fillStyle: 'crimson', weight: 1 },
    ];
    (component as any).retries = 1; // will be decremented to 0, triggering potion check
    spyOn(component.battleResultEvent, 'emit');

    component.onItemSelected(0);

    expect(component.battleResultEvent.emit).not.toHaveBeenCalledWith(false);
    // usePotion(potion) → case 'potion': retries = 1 and splices potion out
    expect((component as any).retries).toBe(1);
    expect((component as any).trainerItems.length).toBe(0); // potion consumed
  });

  it('should emit false on failed spin when retries exhausted and no potion available', () => {
    (component as any).trainerItems = []; // no potions
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.gym.no', fillStyle: 'crimson', weight: 1 },
    ];
    (component as any).retries = 1;
    spyOn(component.battleResultEvent, 'emit');

    component.onItemSelected(0);

    expect(component.battleResultEvent.emit).toHaveBeenCalledWith(false);
  });

  // ── getCurrentLeader: multi-leader generation handling ───────────────────

  it('should emit fromLeaderChange when generation is 5 and round is a multi-leader round', (done) => {
    spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({} as NgbModalRef));

    // Override the component's captured generation to Gen 5 (id=5)
    (component as any).generation = { id: 5, text: 'Gen 5', region: 'Unova', fillStyle: 'darkcyan', weight: 1 };
    component.currentRound = 0; // Gen 5 round 0 is a multi-leader round

    component.fromLeaderChange.subscribe((index: number) => {
      expect(index).toBeGreaterThanOrEqual(0);
      done();
    });

    // Trigger onGameStateChange('gym-battle') → getCurrentLeader() → fromLeaderChange.emit()
    gameStateService.setNextState('gym-battle');
    gameStateService.finishCurrentState();
  });
});
