import { TestBed } from '@angular/core/testing';

import { ItemsService } from './items.service';
import { GameStateService } from '../game-state-service/game-state.service';

describe('ItemsService', () => {
  let service: ItemsService;
  let gameStateService: GameStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItemsService);
    gameStateService = TestBed.inject(GameStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('excludes revive from regular items in Classic mode', () => {
    gameStateService.restoreNewExperienceMode(false);
    expect(service.getRegularItems().some(item => item.name === 'revive')).toBeFalse();
  });

  it('includes revive in regular items in New Experience mode', () => {
    gameStateService.restoreNewExperienceMode(true);
    expect(service.getRegularItems().some(item => item.name === 'revive')).toBeTrue();
  });
});
