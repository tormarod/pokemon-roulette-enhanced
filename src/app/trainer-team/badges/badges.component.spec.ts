import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgesComponent } from './badges.component';
import { Badge } from '../../interfaces/badge';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

describe('BadgesComponent', () => {
  let component: BadgesComponent;
  let fixture: ComponentFixture<BadgesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, TranslateModule.forRoot()],
      declarations: []
    }).compileComponents();

    fixture = TestBed.createComponent(BadgesComponent);
    component = fixture.componentInstance;
    component.trainerBadges = [] as Badge[];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
