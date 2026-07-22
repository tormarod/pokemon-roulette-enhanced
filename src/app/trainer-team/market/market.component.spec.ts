import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { MarketComponent } from './market.component';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { BattlePrepService } from '../../services/battle-prep-service/battle-prep.service';
import { MARKET_PRICES } from '../../main-game/roulette-container/economy-config';

describe('MarketComponent', () => {
  let component: MarketComponent;
  let fixture: ComponentFixture<MarketComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let battlePrepService: BattlePrepService;

  beforeEach(async () => {
    const httpSpy = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpy.get.and.returnValue(of({
      sprites: { other: { 'official-artwork': { front_default: 'd', front_shiny: 's' } } }
    }));

    await TestBed.configureTestingModule({
      imports: [MarketComponent, TranslateModule.forRoot()],
      providers: [{ provide: HttpClient, useValue: httpSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(MarketComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);
    battlePrepService = TestBed.inject(BattlePrepService);
    gameStateService.resetGameState(true);
    trainerService.resetTeam();
    trainerService.resetItems();
    trainerService.resetCoins();
    battlePrepService.clearPrep();
    fixture.detectChanges();
  });

  const entry = (id: string) => component.stock.find(e => e.id === id)!;

  it('builds the full stock with prices from config', () => {
    expect(component.stock.length).toBe(Object.keys(MARKET_PRICES).length);
    expect(entry('potion').price).toBe(MARKET_PRICES['potion']);
    expect(entry('ability-capsule').price).toBe(MARKET_PRICES['ability-capsule']);
    expect(entry('honey').price).toBe(MARKET_PRICES['honey']);
    expect(entry('honey').itemName).toBe('honey');
  });

  it('buying Honey spends coins and bags it, same as any other regular item', () => {
    trainerService.addCoins(100);
    const before = trainerService.getItems().length;

    component.buy(entry('honey'));

    expect(trainerService.getCoins()).toBe(100 - MARKET_PRICES['honey']);
    expect(trainerService.getItems().length).toBe(before + 1);
    expect(trainerService.hasItem('honey')).toBeTrue();
  });

  it('canAfford reflects the current balance', () => {
    trainerService.addCoins(MARKET_PRICES['potion']);
    expect(component.canAfford(entry('potion'))).toBeTrue();
    expect(component.canAfford(entry('revive'))).toBeFalse();
  });

  it('buying an affordable item spends coins and bags it', () => {
    trainerService.addCoins(100);
    const before = trainerService.getItems().length;

    component.buy(entry('x-attack'));

    expect(trainerService.getCoins()).toBe(100 - MARKET_PRICES['x-attack']);
    expect(trainerService.getItems().length).toBe(before + 1);
    expect(trainerService.hasItem('x-attack')).toBeTrue();
  });

  it('buying a capsule bags an assignable ability capsule', () => {
    trainerService.addCoins(100);

    component.buy(entry('ability-capsule'));

    const bagged = trainerService.getItems().find(item => !!item.abilityId);
    expect(bagged).toBeTruthy();
    expect(trainerService.getCoins()).toBe(100 - MARKET_PRICES['ability-capsule']);
  });

  it('an unaffordable purchase is a no-op', () => {
    trainerService.addCoins(5); // less than any price
    const before = trainerService.getItems().length;

    component.buy(entry('revive'));

    expect(trainerService.getCoins()).toBe(5);
    expect(trainerService.getItems().length).toBe(before);
  });

  it('is available during the pre-battle prep phase (no committed prep yet)', () => {
    gameStateService.setNextState('gym-battle');
    gameStateService.finishCurrentState();
    battlePrepService.clearPrep();
    expect(component.isAvailable).toBeTrue();
  });

  it('is unavailable once prep is confirmed (spin imminent)', () => {
    gameStateService.setNextState('gym-battle');
    gameStateService.finishCurrentState();
    battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
    expect(component.isAvailable).toBeFalse();
  });

  it('is available on a non-battle screen in New Experience mode', () => {
    gameStateService.setNextState('adventure-continues');
    gameStateService.finishCurrentState();
    expect(component.isAvailable).toBeTrue();
  });
});
