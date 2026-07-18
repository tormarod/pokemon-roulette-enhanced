import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { BattlePrepService } from './battle-prep.service';
import { TrainerService } from '../trainer-service/trainer.service';
import { ItemItem } from '../../interfaces/item-item';

describe('BattlePrepService', () => {
  let service: BattlePrepService;
  let trainerService: TrainerService;

  const makeItem = (overrides: Partial<ItemItem> = {}): ItemItem => ({
    name: 'x-attack',
    text: '',
    fillStyle: '',
    weight: 1,
    description: '',
    sprite: 'x',
    ...overrides,
  } as ItemItem);

  beforeEach(() => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } }));

    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    });

    service = TestBed.inject(BattlePrepService);
    trainerService = TestBed.inject(TrainerService);
    trainerService.resetItems();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default getPendingPrep to null', () => {
    expect(service.getPendingPrep()).toBeNull();
  });

  it('should commit a prep and make it readable via getPendingPrep', () => {
    service.commitPrep({ battleKey: 'gym-battle', leadIndex: 2, xAttackUsed: false, potionUsed: null });

    expect(service.getPendingPrep()).toEqual({ battleKey: 'gym-battle', leadIndex: 2, xAttackUsed: false, potionUsed: null });
  });

  it('should consume one x-attack from inventory when xAttackUsed is true', () => {
    trainerService.addToItems(makeItem({ name: 'x-attack' }));
    expect(trainerService.getItems().filter(i => i.name === 'x-attack').length).toBe(1);

    service.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: true, potionUsed: null });

    expect(trainerService.getItems().filter(i => i.name === 'x-attack').length).toBe(0);
  });

  it('should not touch inventory when xAttackUsed is false', () => {
    trainerService.addToItems(makeItem({ name: 'x-attack' }));

    service.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false, potionUsed: null });

    expect(trainerService.getItems().filter(i => i.name === 'x-attack').length).toBe(1);
  });

  it('should clear the committed prep', () => {
    service.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false, potionUsed: null });

    service.clearPrep();

    expect(service.getPendingPrep()).toBeNull();
  });

  it('should restore a prep without touching inventory', () => {
    service.restorePrep({ battleKey: 'battle-rival', leadIndex: 1, xAttackUsed: true, potionUsed: 'potion' });

    expect(service.getPendingPrep()).toEqual({ battleKey: 'battle-rival', leadIndex: 1, xAttackUsed: true, potionUsed: 'potion' });
  });
});
