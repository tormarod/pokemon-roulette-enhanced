import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoragePcComponent } from './storage-pc.component';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapPcDisplayHorizontal } from '@ng-icons/bootstrap-icons';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { MarkedTargetService } from '../../services/marked-target-service/marked-target.service';
import { PcLockService } from '../../services/pc-lock-service/pc-lock.service';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { AbilityId } from '../../services/ability-service/abilities-data';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EvolutionLineModalComponent } from '../../pokedex/evolution-line-modal/evolution-line-modal.component';

describe('StoragePcComponent', () => {
  let component: StoragePcComponent;
  let fixture: ComponentFixture<StoragePcComponent>;
  let trainerService: TrainerService;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let modalServiceSpy: jasmine.SpyObj<NgbModal>;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 25,
    text: 'pokemon.pikachu',
    fillStyle: 'yellow',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    modalServiceSpy = jasmine.createSpyObj('NgbModal', ['open', 'dismissAll']);

    await TestBed.configureTestingModule({
      imports: [
        StoragePcComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({ bootstrapPcDisplayHorizontal }),
        {provide: HttpClient, useValue: httpSpyObj },
        { provide: NgbModal, useValue: modalServiceSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoragePcComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    trainerService.resetTeam();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Revive UI (game-balance-v4 Part B) ──────────────────────────────────

  describe('hasRevive / revivePokemon', () => {
    it('hasRevive is false with no revive item in inventory', () => {
      expect(component.hasRevive()).toBeFalse();
    });

    it('hasRevive is true once a revive item is in inventory', () => {
      trainerService.addToItems({ name: 'revive', text: 'items.revive.name', fillStyle: 'gold', weight: 1, description: '', sprite: '' } as any);
      expect(component.hasRevive()).toBeTrue();
    });

    it('revivePokemon does nothing without a revive item in inventory', () => {
      const fainted = makeTestPokemon({ fainted: true });
      component.trainerTeam = [];
      component.storedPokemon = [fainted];

      component.revivePokemon(fainted);

      expect(fainted.fainted).toBeTrue();
    });

    it('revivePokemon consumes the item and clears the fainted flag', () => {
      const revive = { name: 'revive', text: 'items.revive.name', fillStyle: 'gold', weight: 1, description: '', sprite: '' } as any;
      trainerService.addToItems(revive);
      const fainted = makeTestPokemon({ fainted: true });
      component.trainerTeam = [];
      component.storedPokemon = [fainted];

      component.revivePokemon(fainted);

      expect(fainted.fainted).toBeFalse();
      expect(trainerService.hasItem('revive')).toBeFalse();
    });
  });

  // ── Held Mega Stone dot (PC Modal Redesign) ─────────────────────────────

  describe('hasMegaStone', () => {
    it('is false when the bag holds no mega stone for the species', () => {
      const venusaur = makeTestPokemon({ pokemonId: 3 });
      expect(component.hasMegaStone(venusaur)).toBeFalse();
    });

    it('is true once a matching mega stone is in the bag', () => {
      trainerService.addToItems({ name: 'venusaurite', text: 'items.venusaurite.name', fillStyle: 'darkgreen', weight: 1, description: '', sprite: '' } as any);
      const venusaur = makeTestPokemon({ pokemonId: 3 });
      expect(component.hasMegaStone(venusaur)).toBeTrue();
    });
  });

  // ── Forced Retreat lock (adventure threats rework) ──────────────────────

  describe('retreatLocked storage card', () => {
    it('shows the locked badge and disables dragging for a retreat-locked stored Pokémon', () => {
      const locked = makeTestPokemon({ retreatLocked: true });
      component.trainerTeam = [];
      component.storedPokemon = [locked];

      // Render the modal's <ng-template> directly (bypassing NgbModal, which
      // this codebase's specs never render into the DOM — see other roulette
      // specs spying on modalService.open instead) so the fainted/retreatLocked
      // bindings can be asserted against real DOM output.
      const viewRef = component.pcStorageModal.createEmbeddedView({});
      viewRef.detectChanges();
      const rootNode = viewRef.rootNodes.find((node: Node) => node.nodeType === Node.ELEMENT_NODE) as HTMLElement;

      const card = rootNode.querySelector('#storedPokemon .pokemon-storage-card')!;
      expect(card).toBeTruthy();
      expect(card.classList.contains('fainted-card')).toBeTrue();
      expect(card.querySelector('.pc-dot-retreat')).toBeTruthy();
      expect(card.querySelector('.pc-dot-fainted')).toBeFalsy();

      viewRef.destroy();
    });
  });

  // ── PC Lockout threat (threat-mechanics-expansion Phase 4) ──────────────

  describe('pcLockout lock', () => {
    let pcLockService: PcLockService;

    beforeEach(() => {
      pcLockService = TestBed.inject(PcLockService);
    });

    it('disables dragging on both a team card and a stored card, and shows the banner, while locked', () => {
      component.trainerTeam = [makeTestPokemon({ pokemonId: 1 })];
      component.storedPokemon = [makeTestPokemon({ pokemonId: 4 })];
      pcLockService.setLock(true);
      fixture.detectChanges();

      const viewRef = component.pcStorageModal.createEmbeddedView({});
      viewRef.detectChanges();
      const rootNode = viewRef.rootNodes.find((node: Node) => node.nodeType === Node.ELEMENT_NODE) as HTMLElement;

      const teamCard = rootNode.querySelector('#trainerTeam .pokemon-storage-card')!;
      const storedCard = rootNode.querySelector('#storedPokemon .pokemon-storage-card')!;
      expect(teamCard.classList.contains('cdk-drag-disabled')).toBeTrue();
      expect(storedCard.classList.contains('cdk-drag-disabled')).toBeTrue();
      expect(rootNode.querySelector('.pc-lock-banner')?.textContent).toContain('trainer.storage.pcLocked');

      viewRef.destroy();
    });

    it('leaves dragging enabled and hides the banner when not locked', () => {
      component.trainerTeam = [makeTestPokemon({ pokemonId: 1 })];
      component.storedPokemon = [makeTestPokemon({ pokemonId: 4 })];
      fixture.detectChanges();

      const viewRef = component.pcStorageModal.createEmbeddedView({});
      viewRef.detectChanges();
      const rootNode = viewRef.rootNodes.find((node: Node) => node.nodeType === Node.ELEMENT_NODE) as HTMLElement;

      const teamCard = rootNode.querySelector('#trainerTeam .pokemon-storage-card')!;
      const storedCard = rootNode.querySelector('#storedPokemon .pokemon-storage-card')!;
      expect(teamCard.classList.contains('cdk-drag-disabled')).toBeFalse();
      expect(storedCard.classList.contains('cdk-drag-disabled')).toBeFalse();
      expect(rootNode.querySelector('.pc-lock-banner')).toBeFalsy();

      viewRef.destroy();
    });
  });

  // ── Ability assignment (New Experience) ─────────────────────────────────

  describe('ability assignment', () => {
    let gameStateService: GameStateService;

    const addCapsule = (abilityId: AbilityId) =>
      trainerService.addToItems({
        name: `capsule-${abilityId}`, text: `abilities.${abilityId}.name`,
        description: `abilities.${abilityId}.description`, fillStyle: 'red',
        weight: 1, sprite: '', abilityId
      } as any);

    beforeEach(() => {
      gameStateService = TestBed.inject(GameStateService);
      gameStateService.restoreNewExperienceMode(true);
    });

    it('ownedCapsules returns only ability-capsule items', () => {
      trainerService.addToItems({ name: 'potion', text: '', description: '', fillStyle: '', weight: 1, sprite: '' } as any);
      addCapsule('blaze');
      const owned = component.ownedCapsules();
      expect(owned.length).toBe(1);
      expect(owned[0].abilityId).toBe('blaze');
    });

    it('assignAbility sets the ability, consumes the capsule, and persists', () => {
      trainerService.addToTeam(makeTestPokemon());
      component.trainerTeam = trainerService.getTeam();
      component.storedPokemon = trainerService.getStored();
      addCapsule('blaze');
      component.assignTarget = component.trainerTeam[0];

      component.assignAbility(component.ownedCapsules()[0]);

      expect(component.trainerTeam[0].ability).toBe('blaze');
      expect(component.ownedCapsules().length).toBe(0);
      expect(trainerService.getTeam()[0].ability).toBe('blaze');
    });

    it('assigning a second capsule overwrites the first', () => {
      const mon = makeTestPokemon();
      component.trainerTeam = [mon];
      component.storedPokemon = [];
      addCapsule('blaze');
      addCapsule('torrent');

      component.assignTarget = mon;
      component.assignAbility(component.ownedCapsules().find(c => c.abilityId === 'blaze')!);
      expect(mon.ability).toBe('blaze');

      component.assignTarget = mon;
      component.assignAbility(component.ownedCapsules().find(c => c.abilityId === 'torrent')!);
      expect(mon.ability).toBe('torrent');
    });

    it('does not assign or consume in Classic mode', () => {
      gameStateService.restoreNewExperienceMode(false);
      const mon = makeTestPokemon();
      component.trainerTeam = [mon];
      component.storedPokemon = [];
      addCapsule('blaze');
      component.assignTarget = mon;

      component.assignAbility(component.ownedCapsules()[0]);

      expect(mon.ability).toBeUndefined();
      expect(component.ownedCapsules().length).toBe(1);
    });
  });

  // ── Marked Target badge on the PC modal's team loop ──────────────────────

  describe('markedTarget badge (team loop)', () => {
    let gameStateService: GameStateService;
    let markedTargetService: MarkedTargetService;

    beforeEach(() => {
      gameStateService = TestBed.inject(GameStateService);
      gameStateService.restoreNewExperienceMode(true);
      markedTargetService = TestBed.inject(MarkedTargetService);
    });

    it('shows the marked badge only on the team member at the marked index', () => {
      const marked = makeTestPokemon({ pokemonId: 1 });
      const other = makeTestPokemon({ pokemonId: 4 });
      component.trainerTeam = [marked, other];
      component.storedPokemon = [];
      markedTargetService.setMark(0);
      fixture.detectChanges();

      const viewRef = component.pcStorageModal.createEmbeddedView({});
      viewRef.detectChanges();
      const rootNode = viewRef.rootNodes.find((node: Node) => node.nodeType === Node.ELEMENT_NODE) as HTMLElement;
      const cards = rootNode.querySelectorAll('#trainerTeam .pokemon-storage-card');

      expect(cards[0].querySelector('.pc-dot-marked')).toBeTruthy();
      expect(cards[1].querySelector('.pc-dot-marked')).toBeFalsy();

      viewRef.destroy();
    });

    it('shows no marked badge when nothing is marked', () => {
      component.trainerTeam = [makeTestPokemon()];
      component.storedPokemon = [];
      fixture.detectChanges();

      const viewRef = component.pcStorageModal.createEmbeddedView({});
      viewRef.detectChanges();
      const rootNode = viewRef.rootNodes.find((node: Node) => node.nodeType === Node.ELEMENT_NODE) as HTMLElement;

      expect(rootNode.querySelector('.pc-dot-marked')).toBeFalsy();

      viewRef.destroy();
    });

    it('hides the marked badge in Classic mode even if a mark is set', () => {
      gameStateService.restoreNewExperienceMode(false);
      component.trainerTeam = [makeTestPokemon()];
      component.storedPokemon = [];
      markedTargetService.setMark(0);
      fixture.detectChanges();

      const viewRef = component.pcStorageModal.createEmbeddedView({});
      viewRef.detectChanges();
      const rootNode = viewRef.rootNodes.find((node: Node) => node.nodeType === Node.ELEMENT_NODE) as HTMLElement;

      expect(rootNode.querySelector('.pc-dot-marked')).toBeFalsy();

      viewRef.destroy();
    });

    it('disables dragging (bench/swap) only for the marked team member', () => {
      const marked = makeTestPokemon({ pokemonId: 1 });
      const other = makeTestPokemon({ pokemonId: 4 });
      component.trainerTeam = [marked, other];
      component.storedPokemon = [];
      markedTargetService.setMark(0);
      fixture.detectChanges();

      const viewRef = component.pcStorageModal.createEmbeddedView({});
      viewRef.detectChanges();
      const rootNode = viewRef.rootNodes.find((node: Node) => node.nodeType === Node.ELEMENT_NODE) as HTMLElement;
      const cards = rootNode.querySelectorAll('#trainerTeam .pokemon-storage-card');

      expect(cards[0].classList.contains('marked-card')).toBeTrue();
      expect(cards[0].classList.contains('cdk-drag-disabled')).toBeTrue();
      expect(cards[1].classList.contains('marked-card')).toBeFalse();
      expect(cards[1].classList.contains('cdk-drag-disabled')).toBeFalse();

      viewRef.destroy();
    });
  });

  // ── Evolution-line modal entry point ─────────────────────────────────────

  describe('openEvolutionDetail', () => {
    it('opens EvolutionLineModalComponent with the clicked Pokémon id', () => {
      const mockModalRef = { componentInstance: {} as any };
      modalServiceSpy.open.and.returnValue(mockModalRef as any);
      const pokemon = makeTestPokemon({ pokemonId: 25 });

      component.openEvolutionDetail(pokemon);

      expect(modalServiceSpy.open).toHaveBeenCalledWith(
        EvolutionLineModalComponent,
        jasmine.objectContaining({ modalDialogClass: 'evolution-line-modal-dialog' })
      );
      expect(mockModalRef.componentInstance.pokemonId).toBe(25);
    });
  });
});
