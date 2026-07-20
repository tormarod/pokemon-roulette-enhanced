import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ScrollHintComponent } from './scroll-hint.component';

describe('ScrollHintComponent', () => {
  let fixture: ComponentFixture<ScrollHintComponent>;
  let component: ScrollHintComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollHintComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollHintComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('hides when the page is not taller than the viewport', () => {
    spyOnProperty(document.documentElement, 'scrollHeight', 'get').and.returnValue(500);
    spyOnProperty(document.documentElement, 'clientHeight', 'get').and.returnValue(500);

    fixture.detectChanges();

    expect(component.visible).toBeFalse();
  });

  it('shows when the page is taller than the viewport and not scrolled to the bottom', () => {
    spyOnProperty(document.documentElement, 'scrollHeight', 'get').and.returnValue(2000);
    spyOnProperty(document.documentElement, 'clientHeight', 'get').and.returnValue(800);
    spyOnProperty(window, 'scrollY', 'get').and.returnValue(0);
    spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

    fixture.detectChanges();

    expect(component.visible).toBeTrue();
  });

  it('hides once scrolled near the bottom', () => {
    spyOnProperty(document.documentElement, 'scrollHeight', 'get').and.returnValue(2000);
    spyOnProperty(document.documentElement, 'clientHeight', 'get').and.returnValue(800);
    spyOnProperty(window, 'scrollY', 'get').and.returnValue(1190);
    spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

    fixture.detectChanges();
    window.dispatchEvent(new Event('scroll'));

    expect(component.visible).toBeFalse();
  });

  it('scrollDown scrolls to the bottom of the document', () => {
    spyOnProperty(document.documentElement, 'scrollHeight', 'get').and.returnValue(2000);
    const scrollToSpy = spyOn(window, 'scrollTo');

    component.scrollDown();

    const callArg = scrollToSpy.calls.mostRecent().args[0] as ScrollToOptions;
    expect(callArg).toEqual({ top: 2000, behavior: 'smooth' });
  });
});
