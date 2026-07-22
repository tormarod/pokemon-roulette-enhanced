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

  it('excludes repel/max-repel from regular items in Classic mode', () => {
    gameStateService.restoreNewExperienceMode(false);
    expect(service.getRegularItems().some(item => item.name === 'repel')).toBeFalse();
    expect(service.getRegularItems().some(item => item.name === 'max-repel')).toBeFalse();
  });

  it('includes repel/max-repel in regular items in New Experience mode', () => {
    gameStateService.restoreNewExperienceMode(true);
    expect(service.getRegularItems().some(item => item.name === 'repel')).toBeTrue();
    expect(service.getRegularItems().some(item => item.name === 'max-repel')).toBeTrue();
  });

  it('exposes one ability capsule per assignable ability (30), each carrying an abilityId', () => {
    const capsules = service.getAbilityCapsules();
    expect(capsules.length).toBe(30);
    expect(capsules.every(c => !!c.abilityId)).toBeTrue();
    expect(capsules.some(c => c.name === 'capsule-blaze' && c.abilityId === 'blaze')).toBeTrue();
  });

  it('keeps ability capsules OUT of the regular item drop pool (both modes)', () => {
    gameStateService.restoreNewExperienceMode(true);
    expect(service.getRegularItems().some(item => !!item.abilityId)).toBeFalse();
    gameStateService.restoreNewExperienceMode(false);
    expect(service.getRegularItems().some(item => !!item.abilityId)).toBeFalse();
  });

  it('resolves a capsule via getItem / getAbilityCapsule', () => {
    expect(service.getItem('capsule-sturdy').abilityId).toBe('sturdy');
    expect(service.getAbilityCapsule('capsule-sturdy').name).toBe('capsule-sturdy');
  });

  it('getFindableItems excludes Market-sold items (and Honey) in New Experience mode', () => {
    gameStateService.restoreNewExperienceMode(true);
    const findable = service.getFindableItems().map(item => item.name);
    expect(findable).toEqual(jasmine.arrayWithExactContents([
      'exp-share', 'escape-rope', 'repel', 'poke-radar', 'max-repel', 'link-cable', 'bicycle'
    ]));
  });

  it('getFindableItems is unchanged (same as getRegularItems) in Classic mode', () => {
    gameStateService.restoreNewExperienceMode(false);
    expect(service.getFindableItems().map(item => item.name))
      .toEqual(service.getRegularItems().map(item => item.name));
  });
});
