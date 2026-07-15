import { TestBed } from '@angular/core/testing';

import { LinkCableService } from './link-cable.service';

describe('LinkCableService', () => {
  let service: LinkCableService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LinkCableService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit the triggered item on linkCableTrigger$', () => {
    const item = { name: 'link-cable', text: '', fillStyle: '', weight: 1, description: '', sprite: '' } as any;
    let received: any = null;
    service.linkCableTrigger$.subscribe(value => received = value);

    service.triggerLinkCable(item);

    expect(received).toBe(item);
  });
});
