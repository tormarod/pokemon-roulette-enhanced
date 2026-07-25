import { TestBed } from '@angular/core/testing';

import { ItemsService } from './items.service';

describe('ItemsService', () => {
  let service: ItemsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItemsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('includes revive in regular items', () => {
    expect(service.getRegularItems().some(item => item.name === 'revive')).toBeTrue();
  });

  it('includes repel/max-repel in regular items', () => {
    expect(service.getRegularItems().some(item => item.name === 'repel')).toBeTrue();
    expect(service.getRegularItems().some(item => item.name === 'max-repel')).toBeTrue();
  });

  it('exposes one ability capsule per assignable ability (30), each carrying an abilityId', () => {
    const capsules = service.getAbilityCapsules();
    expect(capsules.length).toBe(30);
    expect(capsules.every(c => !!c.abilityId)).toBeTrue();
    expect(capsules.some(c => c.name === 'capsule-blaze' && c.abilityId === 'blaze')).toBeTrue();
  });

  it('keeps ability capsules OUT of the regular item drop pool', () => {
    expect(service.getRegularItems().some(item => !!item.abilityId)).toBeFalse();
  });

  it('resolves a capsule via getItem / getAbilityCapsule', () => {
    expect(service.getItem('capsule-sturdy').abilityId).toBe('sturdy');
    expect(service.getAbilityCapsule('capsule-sturdy').name).toBe('capsule-sturdy');
  });

  it('getFindableItems excludes Market-sold items (and Honey)', () => {
    const findable = service.getFindableItems().map(item => item.name);
    expect(findable).toEqual(jasmine.arrayWithExactContents([
      'exp-share', 'escape-rope', 'repel', 'poke-radar', 'max-repel', 'link-cable', 'bicycle'
    ]));
  });
});
