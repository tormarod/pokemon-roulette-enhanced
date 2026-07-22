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

  // ── Single-select (maxSelections === 1, default): Poké Radar / Max Repel UX ──

  it('should emit the exact type immediately when its button is clicked — a direct pick, no RNG', () => {
    spyOn(component.selectedTypesEvent, 'emit');

    component.toggleType('fire');

    expect(component.selectedTypesEvent.emit).toHaveBeenCalledWith(['fire']);
    expect(component.selectedTypesEvent.emit).toHaveBeenCalledTimes(1);
  });

  it('should emit the corresponding type when a specific button is clicked in the DOM', () => {
    spyOn(component.selectedTypesEvent, 'emit');
    const waterIndex = component.types.findIndex(t => t.key === 'water');

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button.type-choice-button');
    buttons[waterIndex].click();

    expect(component.selectedTypesEvent.emit).toHaveBeenCalledWith(['water']);
  });

  it('does not render a Confirm button in single-select mode', () => {
    expect(fixture.nativeElement.querySelector('button.confirm-button')).toBeNull();
  });

  // ── Multi-select (maxSelections > 1): Honey UX ──────────────────────────────

  describe('multi-select (maxSelections > 1)', () => {
    beforeEach(() => {
      component.maxSelections = 3;
      fixture.detectChanges();
    });

    it('does not emit on click — toggles selection instead', () => {
      spyOn(component.selectedTypesEvent, 'emit');

      component.toggleType('fire');

      expect(component.selectedTypesEvent.emit).not.toHaveBeenCalled();
      expect(component.selected).toEqual(['fire']);
      expect(component.isSelected('fire')).toBeTrue();
    });

    it('toggles a type back off when clicked again', () => {
      component.toggleType('fire');
      component.toggleType('fire');

      expect(component.selected).toEqual([]);
      expect(component.isSelected('fire')).toBeFalse();
    });

    it('accumulates up to maxSelections types', () => {
      component.toggleType('fire');
      component.toggleType('water');
      component.toggleType('grass');

      expect(component.selected).toEqual(['fire', 'water', 'grass']);
    });

    it('blocks adding a 4th type once maxSelections is reached', () => {
      component.toggleType('fire');
      component.toggleType('water');
      component.toggleType('grass');
      component.toggleType('electric');

      expect(component.selected).toEqual(['fire', 'water', 'grass']);
    });

    it('renders a Confirm button, disabled until at least one type is selected', () => {
      fixture.detectChanges();
      const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('button.confirm-button');
      expect(confirmButton).not.toBeNull();
      expect(confirmButton.disabled).toBeTrue();

      component.toggleType('fire');
      fixture.detectChanges();
      expect(confirmButton.disabled).toBeFalse();
    });

    it('emits the selected types only when Confirm is called, not before', () => {
      spyOn(component.selectedTypesEvent, 'emit');

      component.toggleType('fire');
      component.toggleType('water');
      expect(component.selectedTypesEvent.emit).not.toHaveBeenCalled();

      component.confirm();
      expect(component.selectedTypesEvent.emit).toHaveBeenCalledWith(['fire', 'water']);
    });

    it('does nothing on confirm() when nothing is selected', () => {
      spyOn(component.selectedTypesEvent, 'emit');

      component.confirm();

      expect(component.selectedTypesEvent.emit).not.toHaveBeenCalled();
    });
  });
});
