import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { PageNavComponent } from './page-nav.component';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import {
  bootstrapBarChartFill,
  bootstrapController,
  bootstrapCupHotFill,
  bootstrapGear,
  bootstrapPeopleFill
} from '@ng-icons/bootstrap-icons';
import { TranslateModule } from '@ngx-translate/core';

describe('PageNavComponent', () => {
  let component: PageNavComponent;
  let fixture: ComponentFixture<PageNavComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PageNavComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({
          bootstrapBarChartFill,
          bootstrapController,
          bootstrapCupHotFill,
          bootstrapGear,
          bootstrapPeopleFill
        }),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageNavComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have five entries', () => {
    expect(component.entries.length).toBe(5);
  });

  it('should navigate to stats', () => {
    spyOn(router, 'navigate');
    component.go('stats');
    expect(router.navigate).toHaveBeenCalledWith(['stats']);
  });
});
