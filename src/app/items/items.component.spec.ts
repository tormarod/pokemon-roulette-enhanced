import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemsComponent } from './items.component';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';

describe('ItemsComponent', () => {
  let component: ItemsComponent;
  let fixture: ComponentFixture<ItemsComponent>;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  
  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);

    await TestBed.configureTestingModule({
      imports: [ItemsComponent, TranslateModule.forRoot()],
      providers: [
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemsComponent);
    component = fixture.componentInstance;
    component.trainerItems = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const makeItem = (name: string) => ({ name, text: '', fillStyle: '', weight: 1, description: '', sprite: '' } as any);

  it('should emit typeBiasItemInterrupt for honey, poke-radar, repel, and max-repel', () => {
    spyOn(component.typeBiasItemInterrupt, 'emit');

    for (const name of ['honey', 'poke-radar', 'repel', 'max-repel']) {
      component.useItem(makeItem(name));
    }

    expect(component.typeBiasItemInterrupt.emit).toHaveBeenCalledTimes(4);
  });

  it('should emit linkCableInterrupt for link-cable', () => {
    spyOn(component.linkCableInterrupt, 'emit');

    component.useItem(makeItem('link-cable'));

    expect(component.linkCableInterrupt.emit).toHaveBeenCalledWith(makeItem('link-cable'));
  });

  it('should not emit anything for a passive item like potion', () => {
    spyOn(component.typeBiasItemInterrupt, 'emit');
    spyOn(component.linkCableInterrupt, 'emit');
    spyOn(component.rareCandyInterrupt, 'emit');
    spyOn(component.megaStoneInterrupt, 'emit');

    component.useItem(makeItem('potion'));

    expect(component.typeBiasItemInterrupt.emit).not.toHaveBeenCalled();
    expect(component.linkCableInterrupt.emit).not.toHaveBeenCalled();
    expect(component.rareCandyInterrupt.emit).not.toHaveBeenCalled();
    expect(component.megaStoneInterrupt.emit).not.toHaveBeenCalled();
  });

  it('should build the hover tooltip from both the item name and its description', () => {
    component.trainerItems = [
      { name: 'honey', text: 'Honey', fillStyle: '', weight: 1, description: 'Biases your next catch or trade.', sprite: '' } as any
    ];

    expect(component.getItemText(0)).toBe('Honey — Biases your next catch or trade.');
  });
});
