import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { EventPopupComponent } from './event-popup.component';

describe('EventPopupComponent', () => {
  let component: EventPopupComponent;
  let fixture: ComponentFixture<EventPopupComponent>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['dismiss', 'close']);

    await TestBed.configureTestingModule({
      imports: [EventPopupComponent],
      providers: [{ provide: NgbActiveModal, useValue: mockActiveModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(EventPopupComponent);
    component = fixture.componentInstance;
  });

  it('renders no title/underline when title is empty (default)', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.event-popup-title')).toBeNull();
    expect(fixture.nativeElement.querySelector('.event-popup-underline')).toBeNull();
  });

  it('renders title + underline when title is set', () => {
    component.title = 'Congratulations!';
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.event-popup-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toContain('Congratulations!');
    expect(fixture.nativeElement.querySelector('.event-popup-underline')).not.toBeNull();
  });

  it('renders zero, one, and two images as .event-popup-tile elements', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.event-popup-tile').length).toBe(0);

    component.images = [{ src: 'a.png' }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.event-popup-tile').length).toBe(1);

    component.images = [{ src: 'a.png' }, { src: 'b.png' }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.event-popup-tile').length).toBe(2);
  });

  it('renders images[1] after .event-popup-message in DOM order', () => {
    component.images = [{ src: 'a.png' }, { src: 'b.png' }];
    component.lines = ['some message'];
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.event-popup-row');
    const children = Array.from(row.children) as HTMLElement[];
    const tileIndices = children
      .map((el, i) => (el.classList.contains('event-popup-tile') ? i : -1))
      .filter(i => i >= 0);
    const messageIndex = children.findIndex(el => el.classList.contains('event-popup-message'));

    expect(tileIndices.length).toBe(2);
    expect(tileIndices[0]).toBeLessThan(messageIndex);
    expect(tileIndices[1]).toBeGreaterThan(messageIndex);
  });

  it('renders an emoji span (no img) when images[0].emoji is set', () => {
    component.images = [{ emoji: '🪙' }];
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('.event-popup-tile');
    expect(tile.querySelector('.event-popup-tile-emoji')).not.toBeNull();
    expect(tile.querySelector('img')).toBeNull();
  });

  it('renders an img (no emoji span) when images[0].src is set', () => {
    component.images = [{ src: 'a.png' }];
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('.event-popup-tile');
    expect(tile.querySelector('img')).not.toBeNull();
    expect(tile.querySelector('.event-popup-tile-emoji')).toBeNull();
  });

  it('renders one <p> per line, plus one more for hintLine', () => {
    component.lines = ['line one', 'line two'];
    fixture.detectChanges();
    let paragraphs = fixture.nativeElement.querySelectorAll('.event-popup-message p');
    expect(paragraphs.length).toBe(2);

    component.hintLine = 'a hint';
    fixture.detectChanges();
    paragraphs = fixture.nativeElement.querySelectorAll('.event-popup-message p');
    expect(paragraphs.length).toBe(3);
    expect(fixture.nativeElement.querySelector('.event-popup-hint').textContent).toContain('a hint');
  });

  it('renders one button per entry and closes the modal with the clicked index', () => {
    component.buttons = [{ label: 'Yes' }, { label: 'No' }];
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.event-popup-button');
    expect(buttons.length).toBe(2);

    buttons[1].click();
    expect(mockActiveModal.close).toHaveBeenCalledWith(1);
  });

  it('adds event-popup-button-secondary only when variant is secondary', () => {
    component.buttons = [{ label: 'Confirm', variant: 'primary' }, { label: 'Cancel', variant: 'secondary' }];
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.event-popup-button');
    expect(buttons[0].classList.contains('event-popup-button-secondary')).toBeFalse();
    expect(buttons[1].classList.contains('event-popup-button-secondary')).toBeTrue();
  });
});
