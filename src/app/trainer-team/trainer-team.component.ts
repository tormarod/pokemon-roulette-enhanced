import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { PokemonItem } from '../interfaces/pokemon-item';
import { Observable, Subscription } from 'rxjs';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BadgesComponent } from "./badges/badges.component";
import { Badge } from '../interfaces/badge';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { StoragePcComponent } from "./storage-pc/storage-pc.component";
import { PokedexComponent } from "./pokedex/pokedex.component";
import {TranslatePipe} from '@ngx-translate/core';
import { ItemItem } from '../interfaces/item-item';
import { PokemonType, getTypeIconUrl } from '../interfaces/pokemon-type';
import { MarkedTargetService } from '../services/marked-target-service/marked-target.service';
import { AbilityService } from '../services/ability-service/ability.service';
import { GameStateService } from '../services/game-state-service/game-state.service';

@Component({
  selector: 'app-trainer-team',
  imports: [CommonModule,
    NgbTooltipModule,
    BadgesComponent,
    StoragePcComponent, TranslatePipe, PokedexComponent],
  templateUrl: './trainer-team.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./trainer-team.component.css']
})
export class TrainerTeamComponent implements OnInit, OnDestroy {

  constructor(private trainerService: TrainerService,
              private darkModeService: DarkModeService,
              private themeService: ThemeService,
              private markedTargetService: MarkedTargetService,
              private abilityService: AbilityService,
              private gameStateService: GameStateService) { }

  trainer!: { sprite: string; };
  trainerTeam!: PokemonItem[];
  trainerBadges!: Badge[];
  markedIndex: number | null = null;

  darkMode!: Observable<boolean>;
  @Output() megaStoneInterrupt = new EventEmitter<ItemItem>();

  private trainerSubscription!: Subscription;
  private teamSubscription!: Subscription;
  private badgesSubscription!: Subscription;
  private markedTargetSubscription!: Subscription;

  ngOnInit(): void {
    this.trainerSubscription = this.trainerService.getTrainer().subscribe(trainer => {
      this.trainer = trainer;
    });
    this.teamSubscription = this.trainerService.getTeamObservable().subscribe(team => {
      this.trainerTeam = team;
    });
    this.badgesSubscription = this.trainerService.getBadgesObservable().subscribe(badges => {
      this.trainerBadges = badges;
    });
    this.markedTargetSubscription = this.markedTargetService.getPendingMarkObservable().subscribe(index => {
      this.markedIndex = index;
    });
    this.darkMode = this.themeService.isDark$;
  }

  ngOnDestroy(): void {
    this.trainerSubscription?.unsubscribe();
    this.teamSubscription?.unsubscribe();
    this.badgesSubscription?.unsubscribe();
    this.markedTargetSubscription?.unsubscribe();
  }

  /** Gates every New-Experience-only status badge (marked target, ability) on the strip. */
  get isNewExperienceMode(): boolean {
    return this.gameStateService.isNewExperienceMode;
  }

  /** i18n name key of a Pokémon's assigned ability, or null. Translated in the template. */
  getMemberAbilityName(pokemon: PokemonItem | undefined): string | null {
    if (!pokemon) {
      return null;
    }
    return this.abilityService.getMemberAbility(pokemon)?.name ?? null;
  }

  getPokemonTypes(pokemon: PokemonItem): PokemonType[] {
    return [pokemon.type1, pokemon.type2].filter((type): type is PokemonType => !!type);
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }

  getSprite(pokemon: PokemonItem): string {
    if (pokemon.shiny) {
      return pokemon.sprite?.front_shiny || 'place-holder-pixel.png';
    }
    return pokemon.sprite?.front_default || 'place-holder-pixel.png';
  }

  getMegaStoneSprite(pokemon: PokemonItem | undefined): string | null {
    return this.getHeldMegaStoneItem(pokemon)?.sprite || null;
  }

  getMegaStoneTextKey(pokemon: PokemonItem | undefined): string | null {
    return this.getHeldMegaStoneItem(pokemon)?.text || null;
  }

  getMegaStoneFillStyle(pokemon: PokemonItem | undefined): string {
    return this.getHeldMegaStoneItem(pokemon)?.fillStyle ?? 'rgba(255, 255, 255, 0.9)';
  }

  triggerMegaStoneInterrupt(pokemon: PokemonItem | undefined): void {
    const megaStone = this.getHeldMegaStoneItem(pokemon);
    if (!megaStone) {
      return;
    }

    this.megaStoneInterrupt.emit(megaStone);
  }

  private getHeldMegaStoneItem(pokemon: PokemonItem | undefined) {
    if (!pokemon) {
      return null;
    }

    const heldStoneName = this.trainerService.getHeldMegaStoneNamesForPokemon(pokemon)[0];
    if (!heldStoneName) {
      return null;
    }

    return this.trainerService.getItem(heldStoneName) ?? null;
  }
}
