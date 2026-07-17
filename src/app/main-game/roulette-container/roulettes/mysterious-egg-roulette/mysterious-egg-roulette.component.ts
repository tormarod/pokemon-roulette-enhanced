import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { applyTypeBias } from '../../../../services/trainer-service/apply-type-bias';

@Component({
  selector: 'app-mysterious-egg-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './mysterious-egg-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mysterious-egg-roulette.component.css'
})
export class MysteriousEggRouletteComponent implements OnInit, OnDestroy {

  constructor(private pokemonService: PokemonService, private trainerService: TrainerService) {
  }

  nationalDexPokemon: PokemonItem[] = [];

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  private sourcePokemon: PokemonItem[] = [];
  private biasSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.sourcePokemon = this.pokemonService.getAllPokemon();
    this.biasSubscription = this.trainerService.getPendingTypeBiasesObservable().subscribe(() => {
      this.refreshPokemon();
    });
  }

  ngOnDestroy(): void {
    this.biasSubscription?.unsubscribe();
  }

  private refreshPokemon(): void {
    this.nationalDexPokemon = applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases);
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.nationalDexPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
