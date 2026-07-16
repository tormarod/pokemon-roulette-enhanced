import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatsButtonComponent } from './stats-button.component';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapBarChartFill } from '@ng-icons/bootstrap-icons';
import { TranslateModule } from '@ngx-translate/core';

describe('StatsButtonComponent', () => {
  let component: StatsButtonComponent;
  let fixture: ComponentFixture<StatsButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        StatsButtonComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({ bootstrapBarChartFill }),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatsButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
