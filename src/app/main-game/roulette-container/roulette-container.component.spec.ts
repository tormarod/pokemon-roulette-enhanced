import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventEmitter } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
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
import { gymLeadersByGeneration } from './roulettes/gym-battle-roulette/gym-leaders-by-generation';
import { eliteFourByGeneration } from './roulettes/elite-four-battle-roulette/elite-four-by-generation';

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
        away: [],
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
    const REPEL: any = { name: 'repel', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };
    const POKE_RADAR: any = { name: 'poke-radar', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };
    const MAX_REPEL: any = { name: 'max-repel', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };

    it('re-queues the current state, removes the item, and opens the type picker', () => {
      spyOn(gameStateService, 'repeatCurrentState').and.callThrough();
      spyOn(trainerService, 'removeItem');

      (component as any).handleTypeBiasItemUse(HONEY);

      expect(gameStateService.repeatCurrentState).toHaveBeenCalled();
      expect(trainerService.removeItem).toHaveBeenCalledWith(HONEY);
      expect(component.getGameState()).toBe('select-from-type-list');
    });

    it('sets a soft toward bias for Honey', () => {
      (component as any).handleTypeBiasItemUse(HONEY);
      component.continueWithType('water');

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'water', mode: 'soft' }]);
      expect(trainerService.currentPendingTypeBiases.away).toEqual([]);
    });

    it('sets a soft away bias for Repel', () => {
      (component as any).handleTypeBiasItemUse(REPEL);
      component.continueWithType('fire');

      expect(trainerService.currentPendingTypeBiases.away).toEqual([{ type: 'fire', mode: 'soft' }]);
      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('sets a hard toward bias for Poké Radar', () => {
      (component as any).handleTypeBiasItemUse(POKE_RADAR);
      component.continueWithType('grass');

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'grass', mode: 'hard' }]);
      expect(trainerService.currentPendingTypeBiases.away).toEqual([]);
    });

    it('sets a hard away bias for Max Repel', () => {
      (component as any).handleTypeBiasItemUse(MAX_REPEL);
      component.continueWithType('electric');

      expect(trainerService.currentPendingTypeBiases.away).toEqual([{ type: 'electric', mode: 'hard' }]);
      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('keeps both a toward and an away bias active at the same time when both items are used', () => {
      (component as any).handleTypeBiasItemUse(HONEY);
      component.continueWithType('water');
      (component as any).handleTypeBiasItemUse(MAX_REPEL);
      component.continueWithType('electric');

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'water', mode: 'soft' }]);
      expect(trainerService.currentPendingTypeBiases.away).toEqual([{ type: 'electric', mode: 'hard' }]);
    });

    it('stacks a second Honey use as an additional toward entry instead of overwriting the first', () => {
      (component as any).handleTypeBiasItemUse(HONEY);
      component.continueWithType('water');
      (component as any).handleTypeBiasItemUse(HONEY);
      component.continueWithType('electric');

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([
        { type: 'water', mode: 'soft' },
        { type: 'electric', mode: 'soft' }
      ]);
    });

    it('does nothing if continueWithType is called with no pending item', () => {
      component.continueWithType('psychic');

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
      expect(trainerService.currentPendingTypeBiases.away).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST-03b: handleTypeBiasItemUse — in-place application on obtain wheels
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleTypeBiasItemUse on an obtain wheel (in-place)', () => {
    const HONEY: any = { name: 'honey', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };

    const openFakeModal = () => {
      const selectedTypeEvent = new EventEmitter<any>();
      let closeCalled = false;
      const modalRef: any = {
        componentInstance: { selectedTypeEvent },
        result: Promise.resolve(),
        close: () => { closeCalled = true; }
      };
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve(modalRef));
      return { selectedTypeEvent, isClosed: () => closeCalled };
    };

    it('opens a modal picker instead of leaving the screen when on catch-pokemon', async () => {
      (component as any).currentGameState = 'catch-pokemon';
      spyOn(gameStateService, 'repeatCurrentState').and.callThrough();
      const { selectedTypeEvent } = openFakeModal();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();

      expect(modalQueueService.open).toHaveBeenCalled();
      expect(gameStateService.repeatCurrentState).not.toHaveBeenCalled();
      selectedTypeEvent.unsubscribe();
    });

    it('applies the bias, removes the item, and closes the modal on type selection', async () => {
      (component as any).currentGameState = 'trade-pokemon';
      spyOn(trainerService, 'removeItem');
      const { selectedTypeEvent, isClosed } = openFakeModal();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();
      selectedTypeEvent.emit('water');

      expect(trainerService.removeItem).toHaveBeenCalledWith(HONEY);
      expect(trainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'water', mode: 'soft' }]);
      expect(isClosed()).toBeTrue();
    });

    it('does not change GameState when applying a bias in place', async () => {
      (component as any).currentGameState = 'find-fossil';
      const { selectedTypeEvent } = openFakeModal();
      const stateBefore = component.getGameState();

      (component as any).handleTypeBiasItemUse(HONEY);
      await Promise.resolve();
      selectedTypeEvent.emit('fire');

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
      expect(trainerService.currentPendingTypeBiases.away).toEqual([]);
    });

    it('legendaryCaptureChance() clears any pending bias', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      trainerService.setTowardBias({ type: 'grass', mode: 'soft' });

      component.legendaryCaptureChance(bulbasaur);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('paradoxCaptureChance() clears any pending bias', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      trainerService.setAwayBias({ type: 'fire', mode: 'soft' });

      component.paradoxCaptureChance(bulbasaur);

      expect(trainerService.currentPendingTypeBiases.away).toEqual([]);
    });

    it('performTrade() clears any pending bias', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      const squirtle = pokemonService.getPokemonById(7)!;
      (component as any).currentContextPokemon = bulbasaur;
      trainerService.setTowardBias({ type: 'water', mode: 'soft' });

      component.performTrade(squirtle);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
    });

    it('clears a hard-mode bias (Poké Radar / Max Repel) exactly the same as a soft one', () => {
      const bulbasaur = pokemonService.getPokemonById(1)!;
      trainerService.setTowardBias({ type: 'grass', mode: 'hard' });
      trainerService.setAwayBias({ type: 'fire', mode: 'hard' });

      component.capturePokemon(bulbasaur);

      expect(trainerService.currentPendingTypeBiases.toward).toEqual([]);
      expect(trainerService.currentPendingTypeBiases.away).toEqual([]);
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
  // V2 New Experience threats: itemTheft, toll, badOmen
  // ══════════════════════════════════════════════════════════════════════════

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
      expect(() => component.itemTheft()).not.toThrow();
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('resolves the state (does not get stuck) either way', () => {
      spyOn(component, 'doNothing').and.callThrough();

      component.itemTheft();

      expect(component.doNothing).toHaveBeenCalled();
    });
  });

  describe('toll', () => {
    const makeItem = (name: string): any => ({ name, text: `items.${name}.name`, fillStyle: '', weight: 1, description: '', sprite: '' });
    const makePokemon = (id: number, power = 1): any => ({
      pokemonId: id, text: `pokemon.${id}`, fillStyle: 'green',
      sprite: { front_default: 'p.png', front_shiny: 'ps.png' },
      shiny: false, power, weight: 1,
    });

    beforeEach(() => {
      trainerService.resetItems();
      trainerService.getItems().slice().forEach(item => trainerService.removeItem(item));
    });

    it('with items in inventory → transitions to select-from-item-list', () => {
      trainerService.addToItems(makeItem('potion'));

      component.toll();

      expect(component.getGameState()).toBe('select-from-item-list');
    });

    it('picking the item removes exactly it and resolves the state', () => {
      trainerService.addToItems(makeItem('potion'));
      trainerService.addToItems(makeItem('super-potion'));

      component.toll();
      // Pick by the actual stored item reference — addToItems may enrich/clone
      // the item, so a locally-constructed object wouldn't match by reference.
      const potionInInventory = trainerService.getItems().find(i => i.name === 'potion')!;
      component.continueWithItem(potionInInventory);

      expect(trainerService.getItems().length).toBe(1);
      expect(trainerService.getItems()[0].name).toBe('super-potion');
    });

    it('with no items and team >= 2 → transitions to select-from-pokemon-list, weighted toward weaker members', () => {
      trainerService.addToTeam(makePokemon(1, 1));
      trainerService.addToTeam(makePokemon(4, 4));

      component.toll();

      expect(component.getGameState()).toBe('select-from-pokemon-list');
      const list = (component as any).auxPokemonList;
      expect(list.find((p: any) => p.pokemonId === 1).weight).toBe(1);
      expect(list.find((p: any) => p.pokemonId === 4).weight).toBe(0.25);
    });

    it('picking a Pokemon for the toll removes the original team member and never sets stolenPokemon (unlike Team Rocket)', () => {
      trainerService.addToTeam(makePokemon(1, 1));
      trainerService.addToTeam(makePokemon(4, 4));

      component.toll();
      const weightedClone = (component as any).auxPokemonList.find((p: any) => p.pokemonId === 4);
      component.continueWithPokemon(weightedClone);

      expect(trainerService.getTeam().length).toBe(1);
      expect(trainerService.getTeam()[0].pokemonId).toBe(1);
      expect((component as any).stolenPokemon).toBeNull();
    });

    it('with no items and team < 2 → does nothing (never takes the last Pokemon)', () => {
      trainerService.addToTeam(makePokemon(1, 1));
      spyOn(component, 'doNothing').and.callThrough();

      component.toll();

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
      component.badOmen();

      expect(battleDebuffService.currentDebuff).toBeGreaterThan(0);
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('resolves the state', () => {
      spyOn(component, 'doNothing').and.callThrough();

      component.badOmen();

      expect(component.doNothing).toHaveBeenCalled();
    });
  });
});
