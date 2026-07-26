import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreditsComponent } from './credits.component';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapBarChartFill, bootstrapController, bootstrapCupHotFill, bootstrapGear, bootstrapPeopleFill } from '@ng-icons/bootstrap-icons';
import { TranslateModule } from '@ngx-translate/core';

describe('CreditsComponent', () => {
  let component: CreditsComponent;
  let fixture: ComponentFixture<CreditsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CreditsComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({ bootstrapBarChartFill, bootstrapController, bootstrapCupHotFill, bootstrapGear, bootstrapPeopleFill }),
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreditsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
