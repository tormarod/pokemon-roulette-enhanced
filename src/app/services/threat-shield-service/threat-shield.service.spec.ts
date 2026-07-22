import { TestBed } from '@angular/core/testing';

import { ThreatShieldService } from './threat-shield.service';

describe('ThreatShieldService', () => {
  let service: ThreatShieldService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThreatShieldService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit the triggered item on threatShieldTrigger$', () => {
    const item = { name: 'repel', text: '', fillStyle: '', weight: 1, description: '', sprite: '' } as any;
    let received: any = null;
    service.threatShieldTrigger$.subscribe(value => received = value);

    service.triggerThreatShield(item);

    expect(received).toBe(item);
  });
});
