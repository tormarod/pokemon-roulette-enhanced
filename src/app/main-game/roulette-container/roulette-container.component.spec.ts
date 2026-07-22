import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventEmitter } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import {
  bootstrapArrowRepeat,
  bootstrapBook,
  bootstrapCheck,
  bootstrapClock,
  bootstrapController,
  bootstrapCupHotFill,
  bootstrapGear,
  bootstrapMap,
  bootstrapPcDisplayHorizontal,
  bootstrapPeopleFill,
  bootstrapShare,
} from '@ng-icons/bootstrap-icons';
import { provideIcons } from '@ng-icons/core';
import { PokemonService } from '../../services/pokemon-service/pokemon.service';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { PokedexService } from '../../services/pokedex-service/pokedex.service';

import { RouletteContainerComponent } from './roulette-container.component';
import { ModalQueueService } from '../../services/modal-queue-service/modal-queue.service';
import { BattleDebuffService } from '../../services/battle-debuff-service/battle-debuff.service';
import { DangerMeterService } from '../../services/danger-meter-service/danger-meter.service';
import { MarkedTargetService } from '../../services/marked-target-service/marked-target.service';
import { CatchRiskService } from '../../services/catch-risk-service/catch-risk.service';
import { ScoutingReportService } from '../../services/scouting-report-service/scouting-report.service';
import { PcLockService } from '../../services/pc-lock-service/pc-lock.service';
import { gymLeadersByGeneration } from './roulettes/gym-battle-roulette/gym-leaders-by-generation';
import { eliteFourByGeneration } from './roulettes/elite-four-battle-roulette/elite-four-by-generation';
import { battleWinReward, PASSIVE_PER_ROUND, CARD_COIN_MIN, CARD_COIN_MAX } from './economy-config';

describe('RouletteContainerComponent', () => {
  let component: RouletteContainerComponent;
  let fixture: ComponentFixture<RouletteContainerComponent>;
  let pokemonService: PokemonService;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let pokedexService: PokedexService;
  let modalQueueService: ModalQueueService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouletteContainerComponent, TranslateModule.forRoot()],
      providers: [
        provideIcons({
          bootstrapArrowRepeat,
          bootstrapBook,
          bootstrapCheck,
          bootstrapClock,
          bootstrapController,
          bootstrapCupHotFill,
          bootstrapGear,
          bootstrapMap,
          bootstrapPcDisplayHorizontal,
          bootstrapPeopleFill,
          bootstrapShare,
        }),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RouletteContainerComponent);
    component = fixture.componentInstance;
    pokemonService = TestBed.inject(PokemonService);
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);
    pokedexService = TestBed.inject(PokedexService);
    modalQueueService = TestBed.inject(ModalQueueService);
    gameStateService.resetGameState();
    trainerService.resetTeam();
    localStorage.clear();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // multitask — queues exactly two adventure-continues rounds
  // ══════════════════════════════════════════════════════════════════════════

  describe('multitask', () => {
    it('queues exactly two adventure-continues rounds before returning to the pre-built flow', () => {
      gameStateService.resetGameState(true);
      const states: string[] = [];
      gameStateService.currentState.subscribe(s => states.push(s));
      states.length = 0; // drop the initial replay emission from subscribing

      component.multitask(); // shows the first bonus round
      expect(states[states.length - 1]).toBe('adventure-continues');

      component.doNothing(); // resolve round 1 with a bare pop
      expect(states[states.length - 1]).toBe('adventure-continues');

      component.doNothing(); // resolve round 2 with a bare pop
      expect(states[states.length - 1]).not.toBe('adventure-continues');
    });

    it('grants two guaranteed threat-free steps on the danger meter (so a reward cannot cause a threat)', () => {
      const dangerMeterService = TestBed.inject(DangerMeterService);
      dangerMeterService.resetForNewRun();

      component.multitask();

      expect(dangerMeterService.currentGuaranteedRewardSteps).toBe(2);
    });

    // Regression coverage: chaining a second multitask() call while already inside
    // the first one's bonus rounds used to leave the rendered "Multitask xN" note
    // exactly one action stale (still showing the PREVIOUS action's value) — the
    // component field (respinReason) itself was always correct, but nothing told
    // Angular's zoneless change detection to re-check the child's @Input() binding
    // for it. Fixed by calling ChangeDetectorRef.markForCheck() in the private
    // finishCurrentState() wrapper every action funnels through.
    it('renders the correct "Multitask xN" note at every step, including a chained 2nd multitask()', () => {
      gameStateService.resetGameState(true);
      const respinReasonText = () => fixture.nativeElement.querySelector('.respin-reason')?.textContent?.trim();

      component.multitask(); // 1st call: queues 2 rounds
      fixture.detectChanges();
      expect(respinReasonText()).toBe('Multitask x2');

      component.doNothing(); // resolve round 1 of the 1st call
      fixture.detectChanges();
      expect(respinReasonText()).toBe('Multitask x1');

      component.multitask(); // chained 2nd call, mid-bonus-round
      fixture.detectChanges();
      expect(respinReasonText()).toBe('Multitask x2');

      component.doNothing(); // resolve round 1 of the 2nd call
      fixture.detectChanges();
      expect(respinReasonText()).toBe('Multitask x1');

      component.doNothing(); // resolve round 2 of the 2nd call, exits the bonus stretch
      fixture.detectChanges();
      expect(component.getGameState()).not.toBe('adventure-continues');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Bicycle — its one bonus adventure step is guaranteed threat-free too
  // ══════════════════════════════════════════════════════════════════════════

  describe('bicycle bonus step', () => {
    it('grants one guaranteed threat-free step on the danger meter when it queues its bonus round', () => {
      const dangerMeterService = TestBed.inject(DangerMeterService);
      dangerMeterService.resetForNewRun();
      trainerService.addToItems({ text: '', name: 'bicycle', sprite: 'x', fillStyle: '', weight: 1, description: '' });

      // Transition INTO an adventure-continues step — the moment finishCurrentState
      // sees the item unused and queues the bonus round.
      gameStateService.restoreState('gym-battle', ['adventure-continues'], 0);
      component.doNothing();

      expect(component.getGameState()).toBe('adventure-continues');
      expect(dangerMeterService.currentGuaranteedRewardSteps).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Opponent preview
  // ══════════════════════════════════════════════════════════════════════════

  describe('opponent preview', () => {
    const reachStartAdventure = () => {
      gameStateService.finishCurrentState(); // character-select
      gameStateService.finishCurrentState(); // starter-pokemon
      gameStateService.finishCurrentState(); // start-adventure
      fixture.detectChanges();
    };

    it('is hidden before the adventure has started', () => {
      expect(component.showOpponentPreview).toBeFalse();
      expect(component.previewOpponent).toBeNull();
    });

    it('shows the upcoming gym leader once the adventure starts', () => {
      reachStartAdventure();

      expect(component.showOpponentPreview).toBeTrue();
      expect(component.previewOpponent).toEqual(gymLeadersByGeneration[1][0]);
    });

    it('stays visible on a later check-shininess triggered by catching a Pokemon mid-run', () => {
      reachStartAdventure();
      gameStateService.setNextState('check-shininess');
      gameStateService.finishCurrentState();
      fixture.detectChanges();

      expect(component.showOpponentPreview).toBeTrue();
    });

    it('is hidden during an actual gym battle', () => {
      reachStartAdventure();
      gameStateService.setNextState('gym-battle');
      gameStateService.finishCurrentState();
      fixture.detectChanges();

      expect(component.showOpponentPreview).toBeFalse();
      expect(component.previewOpponent).toBeNull();
    });

    it('shows the first Elite Four member during elite-four-preparation', () => {
      reachStartAdventure();
      gameStateService.setNextState('elite-four-preparation');
      gameStateService.finishCurrentState();
      fixture.detectChanges();

      expect(component.previewOpponent).toEqual(eliteFourByGeneration[1][0]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Danger meter — always-visible persistent meter (New Experience Mode only)
  // ══════════════════════════════════════════════════════════════════════════

  describe('danger meter', () => {
    const reachStartAdventureNE = () => {
      gameStateService.resetGameState(true);
      gameStateService.finishCurrentState(); // character-select
      gameStateService.finishCurrentState(); // starter-pokemon
      gameStateService.finishCurrentState(); // start-adventure
      fixture.detectChanges();
    };

    it('is hidden in Classic mode even once the adventure has started', () => {
      gameStateService.finishCurrentState(); // character-select
      gameStateService.finishCurrentState(); // starter-pokemon
      gameStateService.finishCurrentState(); // start-adventure
      fixture.detectChanges();

      expect(component.showDangerMeter).toBeFalse();
    });

    it('is hidden before the adventure has started in New Experience Mode', () => {
      gameStateService.resetGameState(true);
      fixture.detectChanges();

      expect(component.showDangerMeter).toBeFalse();
    });

    it('is visible once the adventure starts in New Experience Mode', () => {
      reachStartAdventureNE();

      expect(component.showDangerMeter).toBeTrue();
    });

    it('is hidden during an actual gym battle in New Experience Mode', () => {
      reachStartAdventureNE();
      gameStateService.setNextState('gym-battle');
      gameStateService.finishCurrentState();
      fixture.detectChanges();

      expect(component.showDangerMeter).toBeFalse();
    });
  });

  it('should route to form selection when captured pokemon has multiple forms', () => {
    const deoxys = pokemonService.getPokemonById(386);
    expect(deoxys).toBeDefined();

    component.capturePokemon(deoxys!);

    expect(component.getGameState()).toBe('select-form');
    expect(component.pokemonForms.map(form => form.pokemonId)).toEqual([386, 10001, 10002, 10003]);
    expect(trainerService.getTeam().length).toBe(0);
  });

  it('should capture immediately when pokemon has no forms', () => {
    const bulbasaur = pokemonService.getPokemonById(1);
    expect(bulbasaur).toBeDefined();

    component.capturePokemon(bulbasaur!);

    expect(component.getGameState()).toBe('check-shininess');
    expect(trainerService.getTeam().length).toBe(1);
    expect(trainerService.getTeam()[0].pokemonId).toBe(1);
  });

  it('should register base national dex ID in Pokédex when alt form is selected — ALT-FORM-01', () => {
    const raichu = pokemonService.getPokemonById(26);
    expect(raichu).toBeDefined();
    component.capturePokemon(raichu!);

    // Select Alolan Raichu form (pokemonId 10100)
    const forms = component.pokemonForms;
    const alolanRaichu = forms.find(f => f.pokemonId === 10100);
    expect(alolanRaichu).toBeDefined();
    component.selectPokemonForm(alolanRaichu!);

    // Base national dex entry (26) should be registered
    expect(pokedexService.currentPokedex.caught['26']).toBeTruthy();
  });

  // ALT-FORM-02: shiny alt form propagates shiny flag to base national dex entry
  it('should propagate shiny flag to base national dex entry when shiny alt form captured — ALT-FORM-02', () => {
    const raichu = pokemonService.getPokemonById(26);
    expect(raichu).toBeDefined();
    const shinyRaichu = { ...raichu!, shiny: true };
    component.capturePokemon(shinyRaichu);

    const forms = component.pokemonForms;
    const alolanRaichu = forms.find(f => f.pokemonId === 10100);
    expect(alolanRaichu).toBeDefined();
    component.selectPokemonForm(alolanRaichu!);

    // Base entry should have shiny: true
    expect(pokedexService.currentPokedex.caught['26']?.shiny).toBeTrue();
  });

  // SHINY-03: shiny flag must be persisted to Pokédex after shiny roulette
  it('should update Pokédex entry with shiny: true after setShininess(true) — SHINY-03', () => {
    const bulbasaur = pokemonService.getPokemonById(1);
    expect(bulbasaur).toBeDefined();

    // Capture Bulbasaur (no forms → goes straight to check-shininess)
    component.capturePokemon(bulbasaur!);

    // Simulate shiny roulette resolving to shiny
    component.setShininess(true);

    expect(pokedexService.currentPokedex.caught['1']?.shiny).toBeTrue();
  });

  it('should mark base national dex ID as won after Champion win with alt-form on team — ALTW-01', () => {
    const raichu = pokemonService.getPokemonById(26);
    expect(raichu).toBeDefined();

    // Capture Raichu → triggers form selection
    component.capturePokemon(raichu!);

    // Select Alolan Raichu form (pokemonId 10100) — adds alt-form to team
    const alolanRaichu = component.pokemonForms.find(f => f.pokemonId === 10100);
    expect(alolanRaichu).toBeDefined();
    component.selectPokemonForm(alolanRaichu!);

    // Beat the Champion
    component.championBattleResult(true);

    // Base national dex entry (26 = Raichu) must be marked won
    expect(pokedexService.currentPokedex.caught['26']?.won).toBeTrue();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // rivalBattleResult — empty-team edge case (game-balance-v4 Part B)
  // ══════════════════════════════════════════════════════════════════════════

  describe('rivalBattleResult(false) — empty-team edge case', () => {
    it('ends the run when the faint mechanic emptied the team in New Experience mode', () => {
      gameStateService.resetGameState(true);
      trainerService.resetTeam();
      let latestState: string | undefined;
      gameStateService.currentState.subscribe(s => latestState = s);

      component.rivalBattleResult(false);

      expect(latestState).toBe('game-over');
    });

    it('does not end the run when the team still has a Pokemon left after the loss', () => {
      gameStateService.resetGameState(true);
      trainerService.resetTeam();
      trainerService.addToTeam({
        pokemonId: 1, text: 'pokemon.bulbasaur', fillStyle: 'green',
        sprite: null, shiny: false, power: 1, weight: 1
      } as any);
      let latestState: string | undefined;
      gameStateService.currentState.subscribe(s => latestState = s);

      component.rivalBattleResult(false);

      expect(latestState).not.toBe('game-over');
    });

    it('does not end the run on an empty team in Classic mode (faint mechanic does not apply)', () => {
      gameStateService.resetGameState(false);
      trainerService.resetTeam();
      let latestState: string | undefined;
      gameStateService.currentState.subscribe(s => latestState = s);

      component.rivalBattleResult(false);

      expect(latestState).not.toBe('game-over');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-02: chooseWhoWillEvolve — 8 zero-evolvable branches
  // ══════════════════════════════════════════════════════════════════════════

  describe('chooseWhoWillEvolve — zero evolvable pokemon', () => {
    beforeEach(() => {
      spyOn(trainerService, 'getPokemonThatCanEvolve').and.returnValue([]);
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('gym-battle → buyPotions()', () => {
      spyOn(component, 'buyPotions');
      component.chooseWhoWillEvolve('gym-battle');
      expect(component.buyPotions).toHaveBeenCalled();
    });

    it('visit-daycare → mysteriousEgg()', () => {
      spyOn(component, 'mysteriousEgg');
      component.chooseWhoWillEvolve('visit-daycare');
      expect(component.mysteriousEgg).toHaveBeenCalled();
    });

    it('battle-rival → findItem()', () => {
      spyOn(component, 'findItem');
      component.chooseWhoWillEvolve('battle-rival');
      expect(component.findItem).toHaveBeenCalled();
    });

    it('battle-trainer → buyPotions()', () => {
      spyOn(component, 'buyPotions');
      component.chooseWhoWillEvolve('battle-trainer');
      expect(component.buyPotions).toHaveBeenCalled();
    });

    it('team-rocket-encounter → findItem()', () => {
      spyOn(component, 'findItem');
      component.chooseWhoWillEvolve('team-rocket-encounter');
      expect(component.findItem).toHaveBeenCalled();
    });

    it('snorlax-encounter → findItem()', () => {
      spyOn(component, 'findItem');
      component.chooseWhoWillEvolve('snorlax-encounter');
      expect(component.findItem).toHaveBeenCalled();
    });

    it('rare-candy → doNothing()', () => {
      spyOn(component, 'doNothing');
      component.chooseWhoWillEvolve('rare-candy');
      expect(component.doNothing).toHaveBeenCalled();
    });

    it('default (unknown eventSource) → doNothing()', () => {
      spyOn(component, 'doNothing');
      component.chooseWhoWillEvolve('explore-cave' as any);
      expect(component.doNothing).toHaveBeenCalled();
    });
  });

  describe('chooseWhoWillEvolve — single evolvable pokemon', () => {
    it('length === 1 → evolvePokemon called with the pokemon', () => {
      const caterpie: any = {
        pokemonId: 10, text: 'pokemon.caterpie', fillStyle: 'green',
        sprite: { front_default: 'c.png', front_shiny: 'cs.png' },
        shiny: false, power: 1, weight: 1,
      };
      spyOn(trainerService, 'getPokemonThatCanEvolve').and.returnValue([caterpie]);
      const evolveSpy = jasmine.createSpy('evolvePokemon');
      (component as any).evolvePokemon = evolveSpy;

      component.chooseWhoWillEvolve('gym-battle');

      expect(evolveSpy).toHaveBeenCalledWith(caterpie);
    });
  });

  describe('chooseWhoWillEvolve — multiple evolvable pokemon', () => {
    it('length > 1 → current state becomes select-from-pokemon-list', () => {
      const poke1: any = {
        pokemonId: 1, text: 'pokemon.bulbasaur', fillStyle: 'green',
        sprite: { front_default: 'b.png', front_shiny: 'bs.png' }, shiny: false, power: 2, weight: 1,
      };
      const poke2: any = {
        pokemonId: 10, text: 'pokemon.caterpie', fillStyle: 'lime',
        sprite: { front_default: 'c.png', front_shiny: 'cs.png' }, shiny: false, power: 1, weight: 1,
      };
      spyOn(trainerService, 'getPokemonThatCanEvolve').and.returnValue([poke1, poke2]);

      component.chooseWhoWillEvolve('gym-battle');

      // pushes 'evolve-pokemon' then 'select-from-pokemon-list', finishCurrentState() pops 'select-from-pokemon-list'
      expect(component.getGameState()).toBe('select-from-pokemon-list');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-02: stealPokemon
  // ══════════════════════════════════════════════════════════════════════════

  describe('stealPokemon', () => {
    const makePokemon = (id: number): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'green',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power: 1, weight: 1,
    });

    it('with team >= 2 and no escape-rope → transitions to select-from-pokemon-list', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(4));

      component.stealPokemon();

      expect(component.getGameState()).toBe('select-from-pokemon-list');
    });

    it('with team >= 2 and no escape-rope → auxPokemonList contains both team members', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(4));

      component.stealPokemon();

      expect((component as any).auxPokemonList.length).toBe(2);
    });

    it('with team >= 2 and no escape-rope → auxPokemonListPickMode stays false (still a wheel spin)', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(4));

      component.stealPokemon();

      expect(component.auxPokemonListPickMode).toBeFalse();
    });

    it('weights each candidate inversely to its power — a stronger Pokemon is harder to steal', () => {
      const weak: any = { ...makePokemon(1), power: 1 };
      const strong: any = { ...makePokemon(4), power: 4 };
      trainerService.addToTeam(weak);
      trainerService.addToTeam(strong);

      component.stealPokemon();

      const list = (component as any).auxPokemonList;
      expect(list.find((p: any) => p.pokemonId === 1).weight).toBe(1);
      expect(list.find((p: any) => p.pokemonId === 4).weight).toBe(0.25);
    });

    it('does not mutate the real team objects\' weight', () => {
      const strong: any = { ...makePokemon(4), power: 4 };
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(strong);

      component.stealPokemon();

      expect(trainerService.getTeam().find(p => p.pokemonId === 4)!.weight).toBe(1);
    });

    it('picking a steal candidate removes the correct original team member, not a clone', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam({ ...makePokemon(4), power: 4 });
      const storedTarget = trainerService.getTeam().find(p => p.pokemonId === 4)!;

      component.stealPokemon();
      const weightedClone = (component as any).auxPokemonList.find((p: any) => p.pokemonId === 4);
      component.continueWithPokemon(weightedClone);

      expect(trainerService.getTeam().length).toBe(1);
      expect(trainerService.getTeam()[0].pokemonId).toBe(1);
      expect((component as any).stolenPokemon).toBe(storedTarget);
    });

    it('with team < 2 → opens teamRocketFailsModal', () => {
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));

      component.stealPokemon();

      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('steal weighting is bias-independent — a pending type bias never skews which Pokemon is easier to steal', () => {
      // Regression guard for the "Honey/Repel affecting Team Rocket steal" report
      // (docs/plans/bug-team-rocket-bias.md): traced and confirmed the steal wheel
      // has no bias wiring at all — 'select-from-pokemon-list' isn't in
      // obtainWheelStates, and pokemon-from-aux-list-roulette never reads
      // TrainerService's pending bias. This pins that contract down so it can't
      // silently regress. Two same-power Pokemon of different types must always
      // get equal steal weight, whatever bias is pending.
      trainerService.restorePendingTypeBiases({
        toward: [{ type: 'water', mode: 'soft' }],
        honey: [],
      });
      trainerService.addToTeam({ ...makePokemon(1), power: 3, type1: 'water' });
      trainerService.addToTeam({ ...makePokemon(2), power: 3, type1: 'fire' });

      component.stealPokemon();

      const list = (component as any).auxPokemonList;
      const waterWeight = list.find((p: any) => p.pokemonId === 1).weight;
      const fireWeight = list.find((p: any) => p.pokemonId === 2).weight;
      expect(waterWeight).toBe(fireWeight);
      expect(waterWeight).toBe(1 / 3);
    });

    it('a Restart clears a leftover stolenPokemon — it never leaks into the new run', () => {
      // Regression: RouletteContainerComponent survives a Restart (only the
      // underlying services get reset), so a Pokemon stolen-then-recovered in a
      // PREVIOUS run stayed in this.stolenPokemon. TeamRocketRouletteComponent's
      // wheel always includes a "defeat" outcome (even before any steal has
      // happened this run — see its ngOnInit weighting), and
      // teamRocketDefeated() trusts stolenPokemon unconditionally. So the very
      // first Team Rocket encounter of a new run could hand back a Pokemon the
      // player never had this run, the moment the wheel landed on "defeat".
      const leftoverFromPreviousRun: any = { ...makePokemon(999), power: 3 };
      (component as any).stolenPokemon = leftoverFromPreviousRun;

      gameStateService.resetGameState(); // what the in-app "Restart" button triggers

      expect((component as any).stolenPokemon).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-02: tradePokemon
  // ══════════════════════════════════════════════════════════════════════════

  describe('tradePokemon', () => {
    const makePokemon = (id: number): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'blue',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power: 1, weight: 1,
    });

    it('with single-member team → sets currentContextPokemon to that pokemon', () => {
      const bulbasaur = makePokemon(1);
      trainerService.addToTeam(bulbasaur);

      component.tradePokemon();

      expect((component as any).currentContextPokemon?.pokemonId).toBe(1);
    });

    it('with multi-member team → transitions to select-from-pokemon-list', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(4));

      component.tradePokemon();

      expect(component.getGameState()).toBe('select-from-pokemon-list');
    });

    it('with multi-member team → auxPokemonList contains all team members', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(4));

      component.tradePokemon();

      expect((component as any).auxPokemonList.length).toBe(2);
    });

    it('with multi-member team → auxPokemonListPickMode is true (direct pick, not a wheel)', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(4));

      component.tradePokemon();

      expect(component.auxPokemonListPickMode).toBeTrue();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-02: handleRareCandyEvolution
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleRareCandyEvolution', () => {
    const RARE_CANDY: any = {
      name: 'rare-candy',
      text: 'items.rare-candy.name',
      fillStyle: 'pink',
      weight: 1,
      description: 'items.rare-candy.description',
      sprite: 'rare-candy.png',
    };

    it('calls chooseWhoWillEvolve("rare-candy") and removes item when there are evolvable pokemon', () => {
      const evolvablePokemon: any = {
        pokemonId: 10, text: 'pokemon.caterpie', fillStyle: 'green',
        sprite: { front_default: 'c.png', front_shiny: 'cs.png' }, shiny: false, power: 1, weight: 1,
      };
      spyOn(trainerService, 'getPokemonThatCanEvolve').and.returnValue([evolvablePokemon]);
      spyOn(trainerService, 'removeItem');
      spyOn(component, 'chooseWhoWillEvolve');

      component.handleRareCandyEvolution(RARE_CANDY);

      expect(component.chooseWhoWillEvolve).toHaveBeenCalledWith('rare-candy');
      expect(trainerService.removeItem).toHaveBeenCalledWith(RARE_CANDY);
    });

    it('does nothing when no pokemon can evolve', () => {
      spyOn(trainerService, 'getPokemonThatCanEvolve').and.returnValue([]);
      spyOn(component, 'chooseWhoWillEvolve');
      spyOn(trainerService, 'removeItem');

      component.handleRareCandyEvolution(RARE_CANDY);

      expect(component.chooseWhoWillEvolve).not.toHaveBeenCalled();
      expect(trainerService.removeItem).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-03: handleTypeBiasItemUse / continueWithType
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleTypeBiasItemUse / continueWithType', () => {
    const HONEY: any = { name: 'honey', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };
    const POKE_RADAR: any = { name: 'poke-radar', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };

    it('re-queues the current state, removes the item, and opens the type picker', () => {
      spyOn(gameStateService, 'repeatCurrentState').and.callThrough();
      spyOn(trainerService, 'removeItem');

      (component as any).handleTypeBiasItemUse(HONEY);

      expect(gameStateService.repeatCurrentState).toHaveBeenCalled();
      expect(trainerService.removeItem).toHaveBeenCalledWith(HONEY);
      expect(component.getGameState()).toBe('select-from-type-list');
    });

    it('adds a Honey use for the chosen type instead of a toward bias', () => {
      (component as any).handleTypeBiasItemUse(HONEY);
      component.continueWithType(['water']);

      expect(trainerService.currentPendingTypeBiases.honey).toEqual([['water']]);
      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('sets a hard toward bias for Poké Radar', () => {
      (component as any).handleTypeBiasItemUse(POKE_RADAR);
      component.continueWithType(['grass']);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'grass', mode: 'hard' }]);
    });

    it('stacks a second Honey use as an additional entry instead of overwriting the first', () => {
      (component as any).handleTypeBiasItemUse(HONEY);
      component.continueWithType(['water']);
      (component as any).handleTypeBiasItemUse(HONEY);
      component.continueWithType(['electric']);

      expect(trainerService.currentPendingTypeBiases.honey).toEqual([['water'], ['electric']]);
    });

    it('does nothing if continueWithType is called with no pending item', () => {
      component.continueWithType(['psychic']);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-03a: handleThreatShieldUse (Repel / Max Repel)
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleThreatShieldUse', () => {
    const REPEL: any = { name: 'repel', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };
    const MAX_REPEL: any = { name: 'max-repel', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };
    let dangerMeterService: DangerMeterService;

    beforeEach(() => {
      dangerMeterService = TestBed.inject(DangerMeterService);
      gameStateService.resetGameState(true);
    });

    it('grants 1 threat shield for Repel and removes the item', () => {
      spyOn(trainerService, 'removeItem');

      (component as any).handleThreatShieldUse(REPEL);

      expect(dangerMeterService.currentShieldedSteps).toBe(1);
      expect(trainerService.removeItem).toHaveBeenCalledWith(REPEL);
    });

    it('grants 3 threat shields for Max Repel', () => {
      (component as any).handleThreatShieldUse(MAX_REPEL);

      expect(dangerMeterService.currentShieldedSteps).toBe(3);
    });

    it('is a no-op outside New Experience mode', () => {
      gameStateService.resetGameState(false);
      spyOn(trainerService, 'removeItem');

      (component as any).handleThreatShieldUse(REPEL);

      expect(dangerMeterService.currentShieldedSteps).toBe(0);
      expect(trainerService.removeItem).not.toHaveBeenCalled();
    });

    it('does not repeat the current state — it is a bonus action', () => {
      spyOn(gameStateService, 'repeatCurrentState');

      (component as any).handleThreatShieldUse(REPEL);

      expect(gameStateService.repeatCurrentState).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-03b: handleTypeBiasItemUse — in-place application on obtain wheels
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleTypeBiasItemUse on an obtain wheel (in-place)', () => {
    const HONEY: any = { name: 'honey', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };

    const openFakeModal = () => {
      const selectedTypesEvent = new EventEmitter<any>();
      let closeCalled = false;
      const modalRef: any = {
        componentInstance: { selectedTypesEvent },
        result: Promise.resolve(),
        close: () => { closeCalled = true; }
      };
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve(modalRef));
      return { selectedTypesEvent, isClosed: () => closeCalled, modalRef };
    };

    it('opens a modal picker instead of leaving the screen when on catch-pokemon', async () => {
      (component as any).currentGameState = 'catch-pokemon';
      spyOn(gameStateService, 'repeatCurrentState').and.callThrough();
      const { selectedTypesEvent } = openFakeModal();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();

      expect(modalQueueService.open).toHaveBeenCalled();
      expect(gameStateService.repeatCurrentState).not.toHaveBeenCalled();
      selectedTypesEvent.unsubscribe();
    });

    it('sets maxSelections to HONEY_MAX_TYPES (3) on the modal for Honey', async () => {
      (component as any).currentGameState = 'catch-pokemon';
      const { modalRef, selectedTypesEvent } = openFakeModal();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();
      await Promise.resolve();

      expect(modalRef.componentInstance.maxSelections).toBe(3);
      selectedTypesEvent.unsubscribe();
    });

    it('applies the bias, removes the item, and closes the modal on type selection', async () => {
      (component as any).currentGameState = 'trade-pokemon';
      spyOn(trainerService, 'removeItem');
      const { selectedTypesEvent, isClosed } = openFakeModal();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();
      selectedTypesEvent.emit(['water']);

      expect(trainerService.removeItem).toHaveBeenCalledWith(HONEY);
      expect(trainerService.currentPendingTypeBiases.honey).toEqual([['water']]);
      expect(isClosed()).toBeTrue();
    });

    it('applies all selected types when Honey is used with 3 types', async () => {
      (component as any).currentGameState = 'trade-pokemon';
      const { selectedTypesEvent } = openFakeModal();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();
      selectedTypesEvent.emit(['fire', 'water', 'grass']);

      expect(trainerService.currentPendingTypeBiases.honey).toEqual([['fire', 'water', 'grass']]);
    });

    it('does not change GameState when applying a bias in place', async () => {
      (component as any).currentGameState = 'find-fossil';
      const { selectedTypesEvent } = openFakeModal();
      const stateBefore = component.getGameState();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();
      selectedTypesEvent.emit(['fire']);

      expect(component.getGameState()).toBe(stateBefore);
    });

    it('still uses the deferred flow when not on an obtain wheel', () => {
      (component as any).currentGameState = 'main-adventure' as any;
      spyOn(gameStateService, 'repeatCurrentState').and.callThrough();
      spyOn(modalQueueService, 'open');

      (component as any).handleTypeBiasItemUse(HONEY);

      expect(gameStateService.repeatCurrentState).toHaveBeenCalled();
      expect(modalQueueService.open).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-03c: single-wheel-use bias consumption
  // ══════════════════════════════════════════════════════════════════════════

  describe('pending type bias is consumed by the wheel resolution it weighted', () => {
    it('capturePokemon() clears any pending bias', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      trainerService.setTowardBias({ type: 'grass', mode: 'soft' });

      component.capturePokemon(bulbasaur);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('legendaryCaptureChance() clears any pending bias', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      trainerService.setTowardBias({ type: 'grass', mode: 'soft' });

      component.legendaryCaptureChance(bulbasaur);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('paradoxCaptureChance() clears any pending bias', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      trainerService.setTowardBias({ type: 'fire', mode: 'soft' });

      component.paradoxCaptureChance(bulbasaur);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('performTrade() clears any pending bias', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      const squirtle = pokemonService.getPokemonById(7)!;
      (component as any).currentContextPokemon = bulbasaur;
      trainerService.setTowardBias({ type: 'water', mode: 'soft' });

      component.performTrade(squirtle);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('clears a hard-mode bias (Poké Radar) the same as a soft one', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      trainerService.setTowardBias({ type: 'grass', mode: 'hard' });

      component.capturePokemon(bulbasaur);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('does not let a bias used on one wheel carry over to a second wheel later in the same stretch', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      const charmander = pokemonService.getPokemonById(4)!;
      trainerService.setTowardBias({ type: 'grass', mode: 'soft' });

      // First catch consumes the bias.
      component.capturePokemon(bulbasaur);
      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);

      // A second catch later in the same gym stretch (no new item used) must
      // see an unbiased pool — nothing left over from the first use.
      const poolBeforeSecondCatch = trainerService.currentPendingTypeBiases;
      component.capturePokemon(charmander);
      expect(poolBeforeSecondCatch.toward).toEqual([]);
      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-04: handleLinkCable
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleLinkCable', () => {
    const LINK_CABLE: any = { name: 'link-cable', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };

    it('re-queues the current state, removes the item, and triggers a trade', () => {
      spyOn(gameStateService, 'repeatCurrentState').and.callThrough();
      spyOn(trainerService, 'removeItem');
      spyOn(component, 'tradePokemon').and.callThrough();

      (component as any).handleLinkCable(LINK_CABLE);

      expect(gameStateService.repeatCurrentState).toHaveBeenCalled();
      expect(trainerService.removeItem).toHaveBeenCalledWith(LINK_CABLE);
      expect(component.tradePokemon).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // V2 New Experience threats: itemTheft, forcedRetreat, badOmen
  // ══════════════════════════════════════════════════════════════════════════

  describe('excludedThreatIds', () => {
    const makePokemon = (id: number): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'green',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power: 1, weight: 1,
    });

    it('excludes pcLockout, forcedRetreat, and markedTarget for a 1-Pokemon roster', () => {
      trainerService.addToTeam(makePokemon(1));

      expect(component.excludedThreatIds().sort()).toEqual(['forcedRetreat', 'markedTarget', 'pcLockout']);
    });

    it('excludes only forcedRetreat/markedTarget for a 1-team + 2-PC roster', () => {
      trainerService.commitTeamAndStorage([makePokemon(1)], [makePokemon(2), makePokemon(3)]);

      expect(component.excludedThreatIds().sort()).toEqual(['forcedRetreat', 'markedTarget']);
    });

    it('excludes nothing for a healthy 4-team roster', () => {
      trainerService.commitTeamAndStorage(
        [makePokemon(1), makePokemon(2), makePokemon(3), makePokemon(4)], []
      );

      expect(component.excludedThreatIds()).toEqual([]);
    });
  });

  describe('teamRocketAmbush', () => {
    beforeEach(() => {
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('shows a modal and transitions into the shared Team Rocket encounter', () => {
      component.teamRocketAmbush();

      expect(modalQueueService.open).toHaveBeenCalled();
      expect(component.getGameState()).toBe('team-rocket-encounter');
    });
  });

  describe('itemTheft', () => {
    const ITEM: any = { name: 'potion', text: 'items.potion.name', fillStyle: '', weight: 1, description: '', sprite: '' };

    beforeEach(() => {
      trainerService.resetItems();
      trainerService.getItems().slice().forEach(item => trainerService.removeItem(item));
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('removes one item from the inventory and shows a modal', () => {
      trainerService.addToItems(ITEM);

      component.itemTheft();

      expect(trainerService.getItems().length).toBe(0);
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('shows a "nothing found" modal without throwing when the inventory is empty', () => {
      spyOn(component, 'doNothing').and.callThrough();

      expect(() => component.itemTheft()).not.toThrow();

      expect(modalQueueService.open).toHaveBeenCalled();
      expect(component.doNothing).toHaveBeenCalled();
    });
  });

  describe('markedTarget', () => {
    const makePokemon = (id: number, power = 1): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'green',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power, weight: 1,
    });
    let markedTargetService: MarkedTargetService;

    beforeEach(() => {
      markedTargetService = TestBed.inject(MarkedTargetService);
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('with team >= 2 → marks one team index and shows a modal', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(2));
      spyOn(component, 'doNothing').and.callThrough();

      component.markedTarget();

      expect(markedTargetService.currentMarkedIndex).not.toBeNull();
      expect([0, 1]).toContain(markedTargetService.currentMarkedIndex as number);
      expect(modalQueueService.open).toHaveBeenCalled();
      expect(component.doNothing).toHaveBeenCalled();
    });

    it('with team < 2 → does nothing (never marks the only Pokemon)', () => {
      trainerService.addToTeam(makePokemon(1));
      spyOn(component, 'doNothing').and.callThrough();

      component.markedTarget();

      expect(component.doNothing).toHaveBeenCalled();
      expect(markedTargetService.currentMarkedIndex).toBeNull();
    });
  });

  describe('forcedRetreat', () => {
    const makePokemon = (id: number, power = 1): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'green',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power, weight: 1,
    });

    beforeEach(() => {
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('with team >= 2 → transitions to select-from-pokemon-list, weighted toward weaker members, and shows a modal', () => {
      trainerService.addToTeam(makePokemon(1, 1));
      trainerService.addToTeam(makePokemon(4, 4));

      component.forcedRetreat();

      expect(component.getGameState()).toBe('select-from-pokemon-list');
      const list = (component as any).auxPokemonList;
      expect(list.find((p: any) => p.pokemonId === 1).weight).toBe(1);
      expect(list.find((p: any) => p.pokemonId === 4).weight).toBe(0.25);
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('picking a Pokemon for the forced retreat moves it to storage locked, and never sets stolenPokemon (unlike Team Rocket)', () => {
      trainerService.addToTeam(makePokemon(1, 1));
      trainerService.addToTeam(makePokemon(4, 4));

      component.forcedRetreat();
      const weightedClone = (component as any).auxPokemonList.find((p: any) => p.pokemonId === 4);
      component.continueWithPokemon(weightedClone);

      expect(trainerService.getTeam().length).toBe(1);
      expect(trainerService.getTeam()[0].pokemonId).toBe(1);
      const stored = trainerService.getStored();
      expect(stored.length).toBe(1);
      expect(stored[0].pokemonId).toBe(4);
      expect(stored[0].retreatLocked).toBe(true);
      expect((component as any).stolenPokemon).toBeNull();
    });

    it('with team < 2 → does nothing (never benches the last Pokemon)', () => {
      trainerService.addToTeam(makePokemon(1, 1));
      spyOn(component, 'doNothing').and.callThrough();

      component.forcedRetreat();

      expect(component.doNothing).toHaveBeenCalled();
      expect(trainerService.getTeam().length).toBe(1);
    });
  });

  describe('badOmen', () => {
    let battleDebuffService: BattleDebuffService;

    beforeEach(() => {
      battleDebuffService = TestBed.inject(BattleDebuffService);
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('sets a pending battle debuff and shows a modal', () => {
      spyOn(component, 'doNothing').and.callThrough();

      component.badOmen();

      expect(battleDebuffService.currentDebuff).toBeGreaterThan(0);
      expect(modalQueueService.open).toHaveBeenCalled();
      expect(component.doNothing).toHaveBeenCalled();
    });
  });

  describe('spooked', () => {
    let dangerMeterService: DangerMeterService;

    beforeEach(() => {
      dangerMeterService = TestBed.inject(DangerMeterService);
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('spikes the Danger meter, leaves consecutiveThreats unchanged, and shows a modal', () => {
      dangerMeterService.restore(40, 2);

      component.spooked();

      expect(dangerMeterService.currentDangerPercent).toBe(70);
      expect(dangerMeterService.currentConsecutiveThreats).toBe(2);
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('caps the spike at 100', () => {
      dangerMeterService.restore(90, 0);

      component.spooked();

      expect(dangerMeterService.currentDangerPercent).toBe(100);
    });

    it('resolves the state', () => {
      spyOn(component, 'doNothing').and.callThrough();

      component.spooked();

      expect(component.doNothing).toHaveBeenCalled();
    });
  });

  describe('pokeballMalfunction', () => {
    let catchRiskService: CatchRiskService;

    beforeEach(() => {
      catchRiskService = TestBed.inject(CatchRiskService);
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('sets a pending catch escape chance and shows a modal', () => {
      spyOn(component, 'doNothing').and.callThrough();

      component.pokeballMalfunction();

      expect(catchRiskService.currentEscapeChance).toBeGreaterThan(0);
      expect(modalQueueService.open).toHaveBeenCalled();
      expect(component.doNothing).toHaveBeenCalled();
    });

    it('makes the next capture fail and clears the pending chance when the roll is below the escape chance', () => {
      const bulbasaur = pokemonService.getPokemonById(1);
      expect(bulbasaur).toBeDefined();
      component.pokeballMalfunction();
      spyOn(Math, 'random').and.returnValue(0); // always below any positive escape chance

      component.capturePokemon(bulbasaur!);

      expect(trainerService.getTeam().length).toBe(0);
      expect(catchRiskService.currentEscapeChance).toBe(0);
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('lets the next capture succeed and clears the pending chance when the roll is above the escape chance', () => {
      const bulbasaur = pokemonService.getPokemonById(1);
      expect(bulbasaur).toBeDefined();
      component.pokeballMalfunction();
      spyOn(Math, 'random').and.returnValue(0.999); // always above any escape chance < 1

      component.capturePokemon(bulbasaur!);

      expect(trainerService.getTeam().length).toBe(1);
      expect(catchRiskService.currentEscapeChance).toBe(0);
    });

    it('does not affect a capture when no malfunction is pending', () => {
      const bulbasaur = pokemonService.getPokemonById(1);
      expect(bulbasaur).toBeDefined();

      component.capturePokemon(bulbasaur!);

      expect(trainerService.getTeam().length).toBe(1);
    });
  });

  describe('tollBooth', () => {
    let dangerMeterService: DangerMeterService;

    beforeEach(() => {
      dangerMeterService = TestBed.inject(DangerMeterService);
      spyOn(dangerMeterService, 'applySpike').and.callThrough();
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('balance >= toll: pays the full toll, no spike', () => {
      // round 0 -> toll = 15 + 3*0 = 15
      trainerService.addCoins(100);

      component.tollBooth();

      expect(trainerService.getCoins()).toBe(85);
      expect(dangerMeterService.applySpike).not.toHaveBeenCalled();
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('balance 0: pays nothing, applies the max spike tier (fully unpaid)', () => {
      expect(trainerService.getCoins()).toBe(0);
      spyOn(component, 'doNothing').and.callThrough();

      component.tollBooth();

      expect(trainerService.getCoins()).toBe(0);
      expect(dangerMeterService.applySpike).toHaveBeenCalledWith(15);
      expect(component.doNothing).toHaveBeenCalled();
    });

    it('balance just under toll: pays what it can, applies the smallest spike tier', () => {
      // round 0 -> toll = 15; balance 14 -> unpaid 1/15 ≈ 0.067 <= 1/3
      trainerService.addCoins(14);

      component.tollBooth();

      expect(trainerService.getCoins()).toBe(0);
      expect(dangerMeterService.applySpike).toHaveBeenCalledWith(5);
    });
  });

  describe('scoutingReport', () => {
    const makePokemon = (id: number, power: number, type1: any, type2: any = null): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'green',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power, weight: 1, type1, type2,
    });
    let scoutingReportService: ScoutingReportService;

    beforeEach(() => {
      scoutingReportService = TestBed.inject(ScoutingReportService);
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('with an empty roster → does nothing, sets no type', () => {
      spyOn(component, 'doNothing').and.callThrough();

      component.scoutingReport();

      expect(component.doNothing).toHaveBeenCalled();
      expect(scoutingReportService.currentType).toBeNull();
    });

    it('sets a type super-effective against the highest-power member (team + PC combined)', () => {
      trainerService.addToTeam(makePokemon(1, 1, 'water'));
      trainerService.commitTeamAndStorage(trainerService.getTeam(), [makePokemon(2, 99, 'grass')]);
      spyOn(component, 'doNothing').and.callThrough();

      component.scoutingReport();

      // ace = the power-99 Grass Pokémon stashed in the PC — counters: fire, ice, poison, flying, bug
      expect(scoutingReportService.currentType).not.toBeNull();
      expect(['fire', 'ice', 'poison', 'flying', 'bug']).toContain(scoutingReportService.currentType as string);
      expect(modalQueueService.open).toHaveBeenCalled();
      expect(component.doNothing).toHaveBeenCalled();
    });
  });

  describe('pcLockout', () => {
    const makePokemon = (id: number): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'green',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power: 1, weight: 1,
    });
    let pcLockService: PcLockService;

    beforeEach(() => {
      pcLockService = TestBed.inject(PcLockService);
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({ result: Promise.resolve() } as any));
    });

    it('with total >= 2 → locks the PC and shows a modal', () => {
      trainerService.addToTeam(makePokemon(1));
      trainerService.addToTeam(makePokemon(2));
      spyOn(component, 'doNothing').and.callThrough();

      component.pcLockout();

      expect(pcLockService.isLocked).toBeTrue();
      expect(modalQueueService.open).toHaveBeenCalled();
      expect(component.doNothing).toHaveBeenCalled();
    });

    it('with exactly 1 total (team + PC) → does nothing, lock stays false', () => {
      trainerService.addToTeam(makePokemon(1));
      spyOn(component, 'doNothing').and.callThrough();

      component.pcLockout();

      expect(component.doNothing).toHaveBeenCalled();
      expect(pcLockService.isLocked).toBeFalse();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 4 verification gate (docs/plans/battle-roulette-dedup.md) — a win on
  // the final Elite Four round can synchronously open the mega-stone
  // altPrizeModal (via ModalQueueService) before the player has dismissed it.
  // Confirms champion's own presentation modal — opened once the player clicks
  // through check-evolution into champion-battle — correctly QUEUES behind a
  // still-open altPrizeModal (ModalQueueService serializes) rather than
  // stacking on top of it (raw NgbModal would stack immediately).
  // ══════════════════════════════════════════════════════════════════════════

  describe('mega-stone altPrizeModal → champion-battle modal ordering', () => {
    it('does not open champion\'s presentation modal until the still-open altPrizeModal is dismissed', async () => {
      const ngbModal = TestBed.inject(NgbModal);
      const openSpy = spyOn(ngbModal, 'open').and.callThrough();
      // Disable modal fade transitions — otherwise dismissAll()'s rejection of
      // the altPrizeModal's `.result` promise (which ModalQueueService's queue
      // chain awaits before advancing) is delayed by a real CSS transitionend,
      // not just a microtask, which a plain `await Promise.resolve()` can't wait out.
      TestBed.inject(NgbModalConfig).animation = false;

      // A lone Venusaur is mega-eligible for exactly one stone (venusaurite),
      // not yet held — so awardMegaStoneAfterImportantBattle() takes the
      // single-candidate/single-stone fast path and opens altPrizeModal
      // synchronously, with no intervening select-from-list state.
      trainerService.resetTeam();
      trainerService.addToTeam({
        pokemonId: 3, text: 'pokemon.venusaur', fillStyle: 'green',
        sprite: null, shiny: false, power: 3, weight: 1
      } as any);

      // Skip straight to "last Elite Four round about to be won" instead of
      // replaying all 4 rounds — restoreState bypasses the normal push/pop flow.
      gameStateService.restoreState('elite-four-battle', ['game-finish', 'champion-battle'], 0);

      component.eliteFourBattleResult(true);
      fixture.detectChanges();
      // ModalQueueService.open() chains onto its internal queue via .then(),
      // so the real NgbModal.open() call is a microtask away, not synchronous.
      await Promise.resolve();
      await Promise.resolve();

      expect(openSpy).toHaveBeenCalledTimes(1); // altPrizeModal only

      component.doNothing(); // check-evolution's "no" outcome → advances to champion-battle
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();

      // Champion-battle has mounted and run its onGameStateChange, but its
      // presentation modal must still be queued — altPrizeModal was never dismissed.
      expect(openSpy).toHaveBeenCalledTimes(1);

      component.closeModal(); // simulates the player clicking "Ok" on altPrizeModal
      // NgbModal's dismiss path isn't pure microtask chaining even with
      // animations off (it still needs a real event-loop turn), so wait a real
      // macrotask rather than counting .then() hops.
      await new Promise(resolve => setTimeout(resolve, 50));
      fixture.detectChanges();

      expect(openSpy).toHaveBeenCalledTimes(2); // champion's presentation modal now opened
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Coin economy (Phase 2 — earning)
  // ══════════════════════════════════════════════════════════════════════════

  describe('coin economy', () => {
    it('a gym win grants the round-scaled drop plus the per-round stipend in New Experience mode', () => {
      gameStateService.resetGameState(true);
      trainerService.resetCoins();

      component.gymBattleResult(true); // round 0

      expect(trainerService.getCoins()).toBe(battleWinReward(0) + PASSIVE_PER_ROUND);
    });

    it('a gym win grants no coins in Classic mode', () => {
      gameStateService.resetGameState(false);
      trainerService.resetCoins();

      component.gymBattleResult(true);

      expect(trainerService.getCoins()).toBe(0);
    });

    it('a rival win grants the win drop but no per-round stipend', () => {
      gameStateService.resetGameState(true);
      trainerService.resetTeam();
      trainerService.addToTeam({
        pokemonId: 1, text: 'pokemon.bulbasaur', fillStyle: 'green',
        sprite: null, shiny: false, power: 1, weight: 1
      } as any);
      trainerService.resetCoins();

      component.rivalBattleResult(true);

      expect(trainerService.getCoins()).toBe(battleWinReward(0));
    });

    it('an exploreCave card grants a coin bonus within the card range in New Experience mode', () => {
      gameStateService.resetGameState(true);
      trainerService.resetCoins();

      component.exploreCave();

      expect(trainerService.getCoins()).toBeGreaterThanOrEqual(CARD_COIN_MIN);
      expect(trainerService.getCoins()).toBeLessThanOrEqual(CARD_COIN_MAX);
    });

    it('an exploreCave card grants no coins in Classic mode', () => {
      gameStateService.resetGameState(false);
      trainerService.resetCoins();

      component.exploreCave();

      expect(trainerService.getCoins()).toBe(0);
    });

    it('multitask grants no coins (cannot be farmed for the stipend)', () => {
      gameStateService.resetGameState(true);
      trainerService.resetCoins();

      component.multitask();

      expect(trainerService.getCoins()).toBe(0);
    });
  });
});
