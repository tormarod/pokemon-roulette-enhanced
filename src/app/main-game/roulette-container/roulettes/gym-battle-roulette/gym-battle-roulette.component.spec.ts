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
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';
import { MarkedTargetService } from '../../../../services/marked-target-service/marked-target.service';

describe('GymBattleRouletteComponent', () => {
  let component: GymBattleRouletteComponent;
  let fixture: ComponentFixture<GymBattleRouletteComponent>;
  let trainerService: TrainerService;
  let generationService: GenerationService;
  let modalQueueService: ModalQueueService;
  let gameStateService: GameStateService;
  let battlePrepService: BattlePrepService;
  let markedTargetService: MarkedTargetService;

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
    battlePrepService = TestBed.inject(BattlePrepService);
    markedTargetService = TestBed.inject(MarkedTargetService);

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

  it('should add extra no slices proportional to current round — round 2 gives 4 no', () => {
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 2;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // empty team → 1 yes;  ceil(round(2)*1.5) + base(1) = 4 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(1);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(4);
  });

  // ── Type-matchup wiring: the formula itself is tested once in
  // base-battle-roulette.component.spec.ts. These just confirm gym wires its
  // own baseNoCount(1) into it correctly, plus gym's own template rendering. ──

  it('should wire a mutual-advantage matchup into gym\'s own yes/no baseline', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' })); // SE + resists fire, netScore=2
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(5); // base(1) + power(2) + delta(2)
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.no').length).toBe(1); // gym's base(1) + round(0)
  });

  it('should not adjust yes slices when the leader has no configured types', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'water' }));
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader; // no types
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(4); // base(1) + power(3)
    expect(component.matchupAdvantageDelta).toBe(0);
    expect(component.matchupDisadvantageDelta).toBe(0);
  });

  it('should render separate Advantage/Disadvantage sections with the correct TOTAL delta, for multiple distinct disadvantage types', () => {
    // Poison is strong against grass; water AND ground are BOTH weak against
    // grass (grass beats ground, rock, water) — two distinct disadvantage types
    // from two different Pokémon, which must both show, with a combined total.
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'poison' })); // SE + resists grass, netScore=2
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'water' }));  // weak + grass resists water, netScore=-2
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'ground' })); // weak + grass resists ground, netScore=-2
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'normal' })); // neutral
    component.currentLeader = { name: 'Erika', sprite: '', quotes: [], types: ['grass'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();
    fixture.detectChanges();

    expect(component.matchupSuperEffectiveTypes).toEqual(['poison']);
    expect(component.matchupResistTypes).toEqual(['poison']);
    expect(component.matchupDisadvantageTypes).toEqual(['water', 'ground']);
    expect(component.matchupAdvantageDelta).toBe(2);      // 1 mutual-advantage member * (netScore(2) * unit(1))
    expect(component.matchupDisadvantageDelta).toBe(4);   // 2 mutual-disadvantage members * (netScore(2) * unit(1)) = 4

    const sectionLabels = fixture.nativeElement.querySelectorAll('.matchup-label-positive, .matchup-label-negative');
    // poison is both super-effective AND resists grass, plus the weak heading: 3 labels total
    expect(sectionLabels.length).toBe(3);

    const deltaEls = fixture.nativeElement.querySelectorAll('.matchup-delta');
    const deltaTexts = Array.from(deltaEls).map((el: any) => el.textContent.trim());
    expect(deltaTexts).toContain('+2');
    expect(deltaTexts).toContain('-4');
  });

  it('should still show a small, non-zero Disadvantage for a low-power weak Pokémon (no more "-0")', () => {
    // A power-1 Pokémon's penalty is never 0 — eliminating the old "-0" display
    // bug entirely, by construction (getMemberDelta's unit is never 0).
    trainerService.addToTeam(makeTestPokemon({ power: 1, type1: 'fire' })); // weak to rock, and rock resists fire's counter: netScore=-2
    component.currentLeader = { name: 'Brock', sprite: '', quotes: [], types: ['rock'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();
    fixture.detectChanges();

    expect(component.matchupDisadvantageTypes).toEqual(['fire']);
    expect(component.matchupDisadvantageDelta).toBe(2); // netScore(2) * unit(ceil(1/4)=1)

    const negLabel = fixture.nativeElement.querySelector('.matchup-label-negative');
    const negDelta = fixture.nativeElement.querySelector('.matchup-delta-negative');
    expect(negLabel).not.toBeNull();
    expect(negDelta.textContent.trim()).toBe('-2');
  });

  it('renders every entry in the leader\'s types list, including a repeated emphasis type', () => {
    // Drayden/Iris-style repeated type: ['dragon', 'dragon'] is an intentional
    // emphasis lever (see GymLeader.types doc comment), not a dedupe bug — the
    // opponent-type icon row should render both entries, not collapse them.
    component.currentLeader = { name: 'Drayden', sprite: '', quotes: [], types: ['dragon', 'dragon'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();
    fixture.detectChanges();

    const opponentIcons = fixture.nativeElement.querySelectorAll('.matchup-icons-row')[0].querySelectorAll('img');
    expect(opponentIcons.length).toBe(2);
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

  it('should clear any pending Forced Retreat lock on a winning spin', () => {
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.gym.yes', fillStyle: 'green', weight: 1 },
    ];
    (component as any).retries = 3;
    spyOn(trainerService, 'clearForcedRetreatLock');

    component.onItemSelected(0);

    expect(trainerService.clearForcedRetreatLock).toHaveBeenCalled();
  });

  it('should clear any pending Forced Retreat lock on a losing spin with retries exhausted', () => {
    (component as any).trainerItems = []; // no potions
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.gym.no', fillStyle: 'crimson', weight: 1 },
    ];
    (component as any).retries = 1;
    spyOn(trainerService, 'clearForcedRetreatLock');

    component.onItemSelected(0);

    expect(trainerService.clearForcedRetreatLock).toHaveBeenCalled();
  });

  it('should clear any pending Marked Target mark on a winning spin', () => {
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.gym.yes', fillStyle: 'green', weight: 1 },
    ];
    (component as any).retries = 3;
    spyOn(markedTargetService, 'clearMark');

    component.onItemSelected(0);

    expect(markedTargetService.clearMark).toHaveBeenCalled();
  });

  it('should clear any pending Marked Target mark on a losing spin with retries exhausted', () => {
    (component as any).trainerItems = []; // no potions
    (component as any).victoryOdds = [
      { text: 'game.main.roulette.gym.no', fillStyle: 'crimson', weight: 1 },
    ];
    (component as any).retries = 1;
    spyOn(markedTargetService, 'clearMark');

    component.onItemSelected(0);

    expect(markedTargetService.clearMark).toHaveBeenCalled();
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

  // ── New Experience mode: prep phase wiring ──────────────────────────────────

  describe('New Experience mode', () => {
    beforeEach(() => {
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({} as NgbModalRef));
      gameStateService.resetGameState(true);
      trainerService.resetTeam();
    });

    it('should show the prep panel (not skip to the wheel) on entering a fresh gym battle', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 3 }));
      component.currentRound = 0;

      gameStateService.setNextState('gym-battle');
      gameStateService.finishCurrentState();

      expect(component.prepPhase).toBeTrue();
    });

    it('should double the chosen lead\'s delta after confirming the prep', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' })); // SE + resists fire, netScore=2, delta=2
      component.currentLeader = { name: 'Brock', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
      component.currentRound = 0;

      component.onPrepConfirmed({ leadIndex: 0, xAttackUsed: false });

      expect(component.prepPhase).toBeFalse();
      // Without lead doubling this would be matchupAdvantageDelta=2; with lead doubling it's 4.
      expect(component.matchupAdvantageDelta).toBe(4);
    });

    it('should consume the x-attack and add its bonus to yes odds after confirming', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 4 }));
      (component as any).trainerItems = [
        { name: 'x-attack', text: 'items.x-attack.name', fillStyle: 'red', weight: 1, description: '', sprite: '' }
      ];
      component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader;
      component.currentRound = 0;

      component.onPrepConfirmed({ leadIndex: 0, xAttackUsed: true });

      const odds: WheelItem[] = (component as any).victoryOdds;
      // base(1) + power(4) + xAttackBonus(meanPower=4) = 9
      expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.gym.yes').length).toBe(9);
    });


    it('should skip the prep panel and go straight to the wheel on reload after Confirm (anti-reroll)', () => {
      battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
      component.currentRound = 0;

      gameStateService.setNextState('gym-battle');
      gameStateService.finishCurrentState();

      expect(component.prepPhase).toBeFalse();
    });

    it('should clear the prep once the battle resolves (win)', () => {
      battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
      (component as any).victoryOdds = [
        { text: 'game.main.roulette.gym.yes', fillStyle: 'green', weight: 1 },
      ];
      spyOn(component.battleResultEvent, 'emit');

      component.onItemSelected(0);

      expect(battlePrepService.getPendingPrep()).toBeNull();
    });

    it('should clear the prep once the battle resolves (final loss, no potions left)', () => {
      battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
      (component as any).trainerItems = [];
      (component as any).victoryOdds = [
        { text: 'game.main.roulette.gym.no', fillStyle: 'crimson', weight: 1 },
      ];
      (component as any).retries = 1;
      spyOn(component.battleResultEvent, 'emit');

      component.onItemSelected(0);

      expect(battlePrepService.getPendingPrep()).toBeNull();
    });

    it('Serene Grace (extra-retry) grants exactly one working respin before a loss', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 2, ability: 'serene-grace' }));
      component.currentLeader = { name: 'Brock', sprite: '', quotes: [] } as GymLeader;
      component.currentRound = 0;
      (component as any).trainerItems = []; // no potions — only the ability can save a loss

      (component as any).calcVictoryOdds();
      // Seeded to 2, not 1: onItemSelected decrements retries on the first spin, so
      // 1 would be spent before it could buy an extra spin (the original bug).
      expect((component as any).retries).toBe(2);

      (component as any).victoryOdds = [
        { text: 'game.main.roulette.gym.no', fillStyle: 'crimson', weight: 1 },
      ];
      spyOn(component.battleResultEvent, 'emit');

      // First losing spin: banked retry absorbs it, no loss emitted yet.
      component.onItemSelected(0);
      expect(component.battleResultEvent.emit).not.toHaveBeenCalled();
      expect((component as any).retries).toBe(1);

      // Second losing spin: retry exhausted, the loss now lands.
      component.onItemSelected(0);
      expect(component.battleResultEvent.emit).toHaveBeenCalledWith(false);
    });
  });
});
