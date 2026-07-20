import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MatchupStripComponent } from './matchup-strip.component';
import { BattleOddsBreakdown } from '../../services/battle-odds-service/battle-odds.service';

describe('MatchupStripComponent', () => {
  let fixture: ComponentFixture<MatchupStripComponent>;
  let component: MatchupStripComponent;

  const makeOdds = (overrides: Partial<BattleOddsBreakdown> = {}): BattleOddsBreakdown => ({
    yesTickets: 13,
    noTickets: 21,
    winChance: 13 / 34,
    extraRetry: false,
    yes: { base: 1, teamPower: 12, typeAdvantage: 0, xAttack: 0, ability: 0 },
    no: { base: 3, roundThreat: 18, typeDisadvantage: 0, badOmen: 0, ability: 0, floored: false },
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchupStripComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchupStripComponent);
    component = fixture.componentInstance;
  });

  it('renders no win-chance headline when odds is null', () => {
    component.odds = null;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.odds-winchance')).toBeNull();
  });

  it('renders the win-chance headline when odds is non-null', () => {
    component.odds = makeOdds({ winChance: 0.6 });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const headline = el.querySelector('.odds-winchance');
    expect(headline).toBeTruthy();
    expect(headline?.textContent).toContain('60%');
  });

  it('shows a roundThreat row combining base + round threat, revealing hidden No tickets not present in the type section', () => {
    component.odds = makeOdds({ no: { base: 3, roundThreat: 18, typeDisadvantage: 0, badOmen: 0, ability: 0, floored: false } });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('-21'); // base(3) + roundThreat(18)
  });

  it('always shows the roundThreat row (base No is never hidden), even with no round threat yet', () => {
    component.odds = makeOdds({ no: { base: 1, roundThreat: 0, typeDisadvantage: 0, badOmen: 0, ability: 0, floored: false } });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('-1');
  });

  it('renders a non-zero ability No row distinct from the typeDisadvantage row', () => {
    component.disadvantageDelta = 2;
    component.odds = makeOdds({ no: { base: 1, roundThreat: 0, typeDisadvantage: 2, badOmen: 0, ability: -2, floored: false } });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('-2');
  });

  it('omits zero-value breakdown rows other than the always-shown roundThreat row', () => {
    component.odds = makeOdds();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.odds-breakdown .matchup-delta').length).toBe(1); // only the roundThreat row (base+threat), the rest are zero
  });
});
