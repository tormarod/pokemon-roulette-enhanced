import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';

import { BaseBattleRouletteComponent } from './base-battle-roulette.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { PokemonType } from '../../../../interfaces/pokemon-type';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { BattleDebuffService } from '../../../../services/battle-debuff-service/battle-debuff.service';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';
import { MarkedTargetService } from '../../../../services/marked-target-service/marked-target.service';
import { ScoutingReportService } from '../../../../services/scouting-report-service/scouting-report.service';

/**
 * Minimal concrete subclass purely for exercising the shared buildVictoryOdds()
 * logic in isolation. Real battle types (gym/elite-four/champion/rival) each
 * just call buildVictoryOdds() with their own text prefix / base no-count /
 * opponent types — that thin wiring is tested in each component's own spec.
 * The actual odds math lives here, tested once, so tuning a magnitude constant
 * doesn't require touching four separate spec files.
 */
@Component({ selector: 'app-test-battle-roulette', changeDetection: ChangeDetectionStrategy.Eager,
 template: '' })
class TestBattleRouletteComponent extends BaseBattleRouletteComponent {
  protected override readonly textPrefix = 'test.battle';

  testOpponentTypes: PokemonType[] | undefined = undefined;
  testBaseNoCount = 1;
  testCurrentRound = 0;
  testLeadIndex: number | undefined = undefined;

  protected override get opponentTypes(): PokemonType[] | undefined { return this.testOpponentTypes; }

  protected override onGameStateChange(): void {}

  protected override calcVictoryOdds(): void {
    this.victoryOdds = this.buildVictoryOdds(this.effectiveOpponentTypes, 'test.battle', this.testBaseNoCount, this.testCurrentRound, this.testLeadIndex);
  }

  recalc(): void {
    this.calcVictoryOdds();
  }

  setItems(items: any[]): void {
    (this as any).trainerItems = items;
  }

  testHasPotions(): any {
    return (this as any).hasPotions();
  }
}

describe('BaseBattleRouletteComponent (buildVictoryOdds)', () => {
  let component: TestBattleRouletteComponent;
  let fixture: ComponentFixture<TestBattleRouletteComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let battleDebuffService: BattleDebuffService;
  let modalQueueService: ModalQueueService;
  let battlePrepService: BattlePrepService;
  let markedTargetService: MarkedTargetService;
  let scoutingReportService: ScoutingReportService;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.test',
    fillStyle: 'green',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(
      of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } })
    );

    await TestBed.configureTestingModule({
      imports: [TestBattleRouletteComponent, TranslateModule.forRoot()],
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestBattleRouletteComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);
    battleDebuffService = TestBed.inject(BattleDebuffService);
    modalQueueService = TestBed.inject(ModalQueueService);
    battlePrepService = TestBed.inject(BattlePrepService);
    markedTargetService = TestBed.inject(MarkedTargetService);
    scoutingReportService = TestBed.inject(ScoutingReportService);

    gameStateService.resetGameState();
    trainerService.resetTeam();
    battleDebuffService.clearDebuff();
    scoutingReportService.clearType();
    fixture.detectChanges();
  });

  const yesCount = () => (component as any).victoryOdds.filter((o: WheelItem) => o.text === 'test.battle.yes').length;
  const noCount = () => (component as any).victoryOdds.filter((o: WheelItem) => o.text === 'test.battle.no').length;

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('delegates odds math to BattleOddsService and maps tickets into wheel items', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' }));
    component.testOpponentTypes = ['fire'];
    component.testBaseNoCount = 1;
    component.testCurrentRound = 0;
    const spy = spyOn((component as any).battleOddsService, 'computeOdds').and.callThrough();

    component.recalc();

    expect(spy).toHaveBeenCalled();
    const odds = spy.calls.mostRecent().returnValue;
    expect(yesCount()).toBe(odds.yesTickets);
    expect(noCount()).toBe(odds.noTickets);
  });

  it('adds raw power to yes when the opponent has no configured types', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'water' }));
    component.testOpponentTypes = undefined;
    component.recalc();
    expect(yesCount()).toBe(4); // base(1) + power(3)
    expect(component.matchupAdvantageDelta).toBe(0);
    expect(component.matchupDisadvantageDelta).toBe(0);
  });

  it('keeps scaling with power — no plateau for high power', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 8, type1: 'water' }));
    component.testOpponentTypes = ['fire'];
    component.recalc();
    expect(component.matchupAdvantageDelta).toBe(8); // netScore(2) * unit(ceil(8/2)=4)
  });

  it('still gives a low-power Pokémon a real, non-zero delta (never 0)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 1, type1: 'grass' })); // weak vs fire
    component.testOpponentTypes = ['fire'];
    component.recalc();
    expect(component.matchupDisadvantageDelta).toBe(2); // netScore(2) * unit(ceil(1/4)=1), never 0
  });

  it('cancels to neutral when a Pokémon is simultaneously strong and weak', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 4, type1: 'bug' })); // strong vs grass, weak vs fire
    component.testOpponentTypes = ['grass', 'fire'];
    component.recalc();
    expect(yesCount()).toBe(5); // base(1) + power(4), no bonus either way
    expect(noCount()).toBe(1);
    expect(component.matchupAdvantageDelta).toBe(0);
    expect(component.matchupDisadvantageDelta).toBe(0);
  });

  it('a Pokémon\'s own contribution never changes when an unrelated teammate is added or removed', () => {
    const weakOne = makeTestPokemon({ pokemonId: 1, power: 4, type1: 'grass' }); // weak vs fire, netScore=-2
    const strongOne = makeTestPokemon({ pokemonId: 2, power: 1, type1: 'water' }); // SE + resists fire, netScore=2
    component.testOpponentTypes = ['fire'];

    trainerService.addToTeam(weakOne);
    component.recalc();
    expect(component.matchupDisadvantageDelta).toBe(4); // netScore(2) * unit(ceil(4/2)=2)

    trainerService.addToTeam(strongOne);
    component.recalc();
    // weakOne's own penalty is unchanged by strongOne joining the team
    expect(component.matchupDisadvantageDelta).toBe(4);
    expect(component.matchupAdvantageDelta).toBe(2); // netScore(2) * unit(ceil(1/2)=1)

    trainerService.resetTeam();
    trainerService.addToTeam(strongOne);
    component.recalc();
    // strongOne's own bonus is unchanged by weakOne having left
    expect(component.matchupAdvantageDelta).toBe(2);
  });

  it('sums contributions from multiple distinct disadvantage types across different Pokémon', () => {
    trainerService.addToTeam(makeTestPokemon({ pokemonId: 1, power: 3, type1: 'poison' })); // SE + resists grass, netScore=2
    trainerService.addToTeam(makeTestPokemon({ pokemonId: 2, power: 3, type1: 'water' }));  // weak + grass resists water, netScore=-2
    trainerService.addToTeam(makeTestPokemon({ pokemonId: 3, power: 3, type1: 'ground' })); // weak + grass resists ground, netScore=-2
    component.testOpponentTypes = ['grass'];
    component.recalc();

    expect(component.matchupSuperEffectiveTypes).toEqual(['poison']);
    expect(component.matchupResistTypes).toEqual(['poison']);
    expect(component.matchupDisadvantageTypes).toEqual(['water', 'ground']);
    expect(component.matchupAdvantageDelta).toBe(4); // netScore(2) * unit(ceil(3/2)=2)
    expect(component.matchupDisadvantageDelta).toBe(8); // 2 members * (netScore(2) * unit(ceil(3/2)=2))
  });

  // ── hasPotions: worst-to-best consumption order ────────────────────────────

  it('uses the weakest potion first regardless of inventory order', () => {
    component.setItems([
      { name: 'hyper-potion', text: '', fillStyle: '', weight: 1, description: '', sprite: '' },
      { name: 'potion', text: '', fillStyle: '', weight: 1, description: '', sprite: '' },
      { name: 'super-potion', text: '', fillStyle: '', weight: 1, description: '', sprite: '' },
    ]);
    expect(component.testHasPotions().name).toBe('potion');
  });

  it('falls back to super-potion, then hyper-potion, once weaker tiers are gone', () => {
    component.setItems([
      { name: 'hyper-potion', text: '', fillStyle: '', weight: 1, description: '', sprite: '' },
      { name: 'super-potion', text: '', fillStyle: '', weight: 1, description: '', sprite: '' },
    ]);
    expect(component.testHasPotions().name).toBe('super-potion');

    component.setItems([
      { name: 'hyper-potion', text: '', fillStyle: '', weight: 1, description: '', sprite: '' },
    ]);
    expect(component.testHasPotions().name).toBe('hyper-potion');
  });

  it('returns undefined when no potions are in the inventory', () => {
    component.setItems([{ name: 'x-attack', text: '', fillStyle: '', weight: 1, description: '', sprite: '' }]);
    expect(component.testHasPotions()).toBeUndefined();
  });

  // ── leadIndex: doubles the chosen lead's signed delta ──────────────────

  it('is a no-op for a lead with a neutral matchup (delta 0)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 4, type1: 'bug' })); // strong vs grass, weak vs fire: netScore=0
    component.testOpponentTypes = ['grass', 'fire'];
    component.testLeadIndex = 0;
    component.recalc();
    expect(yesCount()).toBe(5); // unchanged from the no-lead neutral case
    expect(noCount()).toBe(1);
    expect(component.matchupAdvantageDelta).toBe(0);
    expect(component.matchupDisadvantageDelta).toBe(0);
  });

  it('does not affect odds when leadIndex is undefined (Classic mode / no lead chosen)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' }));
    component.testOpponentTypes = ['fire'];
    component.testLeadIndex = undefined;
    component.recalc();
    expect(yesCount()).toBe(5);
    expect(component.matchupAdvantageDelta).toBe(2);
  });

  it('ignores an out-of-range leadIndex rather than throwing', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' }));
    component.testOpponentTypes = ['fire'];
    component.testLeadIndex = 5;
    expect(() => component.recalc()).not.toThrow();
    expect(yesCount()).toBe(5);
    expect(component.matchupAdvantageDelta).toBe(2);
  });

  // ── badOmen: extra No tickets from a pending battle debuff ─────────────

  it('adds no extra No tickets when there is no pending debuff', () => {
    component.testBaseNoCount = 1;
    component.testCurrentRound = 0;

    component.recalc();

    expect(noCount()).toBe(1);
  });

  // ── scoutingReport: pending type appended to opponentTypes ─────────────

  describe('effectiveOpponentTypes / scoutingReport', () => {
    it('falls back to opponentTypes when no scouting type is pending', () => {
      component.testOpponentTypes = ['fire'];
      expect((component as any).effectiveOpponentTypes).toEqual(['fire']);
    });

    it('appends the pending scouting type to opponentTypes', () => {
      component.testOpponentTypes = ['fire'];
      scoutingReportService.setType('water');
      expect((component as any).effectiveOpponentTypes).toEqual(['fire', 'water']);
    });

    it('produces more No tickets when a scouting type is pending, for a team weak to it', () => {
      trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'grass' })); // weak vs fire
      component.testOpponentTypes = ['fire'];
      component.recalc();
      const baselineNo = noCount();

      scoutingReportService.setType('ice'); // grass is also weak to ice
      component.recalc();

      expect(noCount()).toBeGreaterThan(baselineNo);
    });

    it('clears the pending scouting type on battle cleanup (a winning spin)', () => {
      scoutingReportService.setType('fire');
      (component as any).victoryOdds = [
        { text: 'test.battle.yes', fillStyle: 'green', weight: 1 },
      ];
      (component as any).retries = 3;

      component.onItemSelected(0);

      expect(scoutingReportService.currentType).toBeNull();
    });
  });

  // ── onItemSelected: shared win/loss/potion routing (docs/plans/battle-roulette-dedup.md
  // Phase 5) — gym/elite-four/rival/champion each already cover this same shared
  // base logic via their own specs (they no longer have their own onItemSelected
  // body to test independently), so this is a lighter, centralized pass on the
  // routing itself, in the same spirit as buildVictoryOdds above. ──

  describe('onItemSelected', () => {
    it('emits true and runs the shared cleanup on a winning spin', () => {
      (component as any).victoryOdds = [
        { text: 'test.battle.yes', fillStyle: 'green', weight: 1 },
      ];
      (component as any).retries = 3;
      spyOn(component.battleResultEvent, 'emit');
      spyOn(battlePrepService, 'clearPrep');
      spyOn(trainerService, 'clearForcedRetreatLock');
      spyOn(markedTargetService, 'clearMark');
      spyOn(battleDebuffService, 'clearDebuff');
      spyOn(scoutingReportService, 'clearType');

      component.onItemSelected(0);

      expect(component.battleResultEvent.emit).toHaveBeenCalledWith(true);
      expect(battlePrepService.clearPrep).toHaveBeenCalled();
      expect(trainerService.clearForcedRetreatLock).toHaveBeenCalled();
      expect(markedTargetService.clearMark).toHaveBeenCalled();
      expect(battleDebuffService.clearDebuff).toHaveBeenCalled();
      expect(scoutingReportService.clearType).toHaveBeenCalled();
    });

    it('consumes a potion and does not emit yet when a loss still has one available', () => {
      spyOn(modalQueueService, 'open').and.returnValue(Promise.resolve({} as NgbModalRef));
      component.setItems([
        { name: 'potion', text: '', fillStyle: '', weight: 1, description: '', sprite: '' },
      ]);
      (component as any).victoryOdds = [
        { text: 'test.battle.no', fillStyle: 'crimson', weight: 1 },
      ];
      (component as any).retries = 1; // decrements to 0, triggering the potion check
      spyOn(component.battleResultEvent, 'emit');

      component.onItemSelected(0);

      expect(component.battleResultEvent.emit).not.toHaveBeenCalled();
      expect((component as any).retries).toBe(1); // usePotion('potion') resets retries to 1
      expect((component as any).trainerItems.length).toBe(0); // potion consumed
      expect(modalQueueService.open).toHaveBeenCalled();
    });

    it('emits false, runs cleanup, and calls onFinalLoss on a final loss with no potion', () => {
      component.setItems([]);
      (component as any).victoryOdds = [
        { text: 'test.battle.no', fillStyle: 'crimson', weight: 1 },
      ];
      (component as any).retries = 1;
      spyOn(component.battleResultEvent, 'emit');
      spyOn(battlePrepService, 'clearPrep');
      const onFinalLossSpy = spyOn(component as any, 'onFinalLoss').and.callThrough();

      component.onItemSelected(0);

      expect(onFinalLossSpy).toHaveBeenCalled();
      expect(component.battleResultEvent.emit).toHaveBeenCalledWith(false);
      expect(battlePrepService.clearPrep).toHaveBeenCalled();
    });
  });
});
