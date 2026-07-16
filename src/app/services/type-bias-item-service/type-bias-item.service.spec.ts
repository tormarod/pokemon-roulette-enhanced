import { TestBed } from '@angular/core/testing';

import { TypeBiasItemService } from './type-bias-item.service';

describe('TypeBiasItemService', () => {
  let service: TypeBiasItemService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TypeBiasItemService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit the triggered item on typeBiasItemTrigger$', () => {
    const item = { name: 'honey', text: '', fillStyle: '', weight: 1, description: '', sprite: '' } as any;
    let received: any = null;
    service.typeBiasItemTrigger$.subscribe(value => received = value);

    service.triggerTypeBiasItem(item);

    expect(received).toBe(item);
  });
});
