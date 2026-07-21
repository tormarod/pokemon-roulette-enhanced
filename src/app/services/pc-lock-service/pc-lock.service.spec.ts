import { TestBed } from '@angular/core/testing';

import { PcLockService } from './pc-lock.service';

describe('PcLockService', () => {
  let service: PcLockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PcLockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default isLocked to false', () => {
    expect(service.isLocked).toBeFalse();
  });

  it('should set the lock', () => {
    service.setLock(true);
    expect(service.isLocked).toBeTrue();
  });

  it('should clear the lock back to false', () => {
    service.setLock(true);
    service.clearLock();
    expect(service.isLocked).toBeFalse();
  });

  it('should emit through getLockedObservable', () => {
    const values: boolean[] = [];
    service.getLockedObservable().subscribe(v => values.push(v));

    service.setLock(true);
    service.clearLock();

    expect(values).toEqual([false, true, false]);
  });
});
