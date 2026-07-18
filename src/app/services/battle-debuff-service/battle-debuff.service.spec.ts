import { TestBed } from '@angular/core/testing';

import { BattleDebuffService } from './battle-debuff.service';

describe('BattleDebuffService', () => {
  let service: BattleDebuffService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BattleDebuffService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default currentDebuff to 0', () => {
    expect(service.currentDebuff).toBe(0);
  });

  it('should set the debuff', () => {
    service.setDebuff(2);
    expect(service.currentDebuff).toBe(2);
  });

  it('should clear the debuff back to 0', () => {
    service.setDebuff(2);
    service.clearDebuff();
    expect(service.currentDebuff).toBe(0);
  });

  it('should restore a debuff value', () => {
    service.restoreDebuff(3);
    expect(service.currentDebuff).toBe(3);
  });

  it('should emit through getPendingDebuffObservable', () => {
    const values: number[] = [];
    service.getPendingDebuffObservable().subscribe(v => values.push(v));

    service.setDebuff(2);
    service.clearDebuff();

    expect(values).toEqual([0, 2, 0]);
  });
});
