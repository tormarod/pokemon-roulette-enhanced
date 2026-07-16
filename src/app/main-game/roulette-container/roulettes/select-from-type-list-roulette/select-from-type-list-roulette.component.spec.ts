import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { SelectFromTypeListRouletteComponent } from './select-from-type-list-roulette.component';

describe('SelectFromTypeListRouletteComponent', () => {
  let component: SelectFromTypeListRouletteComponent;
  let fixture: ComponentFixture<SelectFromTypeListRouletteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectFromTypeListRouletteComponent, TranslateModule.forRoot()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectFromTypeListRouletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should offer all 18 Pokémon types', () => {
    expect(component.types.length).toBe(18);
  });

  it('should render one clickable button per type, not a wheel', () => {
    expect(fixture.nativeElement.querySelector('app-wheel')).toBeNull();

    const buttons = fixture.nativeElement.querySelectorAll('button.type-choice-button');
    expect(buttons.length).toBe(18);
  });

  it('should emit the exact type immediately when its button is clicked — a direct pick, no RNG', () => {
    spyOn(component.selectedTypeEvent, 'emit');

    component.selectType('fire');

    expect(component.selectedTypeEvent.emit).toHaveBeenCalledWith('fire');
    expect(component.selectedTypeEvent.emit).toHaveBeenCalledTimes(1);
  });

  it('should emit the corresponding type when a specific button is clicked in the DOM', () => {
    spyOn(component.selectedTypeEvent, 'emit');
    const waterIndex = component.types.findIndex(t => t.key === 'water');

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button.type-choice-button');
    buttons[waterIndex].click();

    expect(component.selectedTypeEvent.emit).toHaveBeenCalledWith('water');
  });
});
