import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TradePokemonRouletteComponent } from './trade-pokemon-roulette.component';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';

describe('TradePokemonRouletteComponent', () => {
  let component: TradePokemonRouletteComponent;
  let fixture: ComponentFixture<TradePokemonRouletteComponent>;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let trainerService: TrainerService;

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);

    await TestBed.configureTestingModule({
      imports: [TradePokemonRouletteComponent, TranslateModule.forRoot()],
      providers: [
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TradePokemonRouletteComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recomputes the candidate pool live when a bias item is used while this wheel is on screen', () => {
    const before = component.nationalDexPokemon.find(p => p.type1 === 'water' || p.type2 === 'water')!;
    expect(before.weight).toBe(1);

    trainerService.setTowardBias({ type: 'water', mode: 'soft' });

    const after = component.nationalDexPokemon.find(p => p.pokemonId === before.pokemonId)!;
    expect(after.weight).toBe(4);
  });
});
