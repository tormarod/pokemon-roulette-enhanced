import { GameState } from '../../services/game-state-service/game-state';

/**
 * Per-state screen title, rendered as the prompt line of the status-header
 * card (RunStatusHeaderComponent) instead of an on-screen <h1> — one entry per
 * @switch case in roulette-container.component.html that used to carry its own
 * `.roulette-header` title. Keyed by game state, exactly mirroring the @switch:
 * a reused state name renders the same screen wherever it recurs, and therefore
 * the same title, so a state-keyed map is as reliable as the switch itself.
 *
 * Absent on purpose: the four battle states (their headers live inside the
 * wheel card via the wheel-card-header slot), game-finish/game-over (terminal
 * screens with their own layouts), and the select-from-*-list states, whose
 * titles are container-owned runtime strings resolved in
 * RouletteContainerComponent.statusPrompt.
 */
export interface RouletteScreenTitle {
  /** i18n keys, translated and space-joined into the prompt line. */
  keys: string[];
  /** Append the raw generation label, e.g. "(Red / Blue / Yellow)". */
  withGenerationSuffix?: boolean;
  /** Append the raw region name + "!", e.g. "Kanto!" (character select). */
  withRegionSuffix?: boolean;
}

export const ROULETTE_SCREEN_TITLES: Partial<Record<GameState, RouletteScreenTitle>> = {
  'game-start': { keys: ['game.main.roulette.generation.title'] },
  'character-select': { keys: ['game.main.roulette.character.welcome'], withRegionSuffix: true },
  'starter-pokemon': { keys: ['game.main.roulette.starter.title'] },
  'check-shininess': { keys: ['game.main.roulette.shiny.title'] },
  'start-adventure': { keys: ['game.main.roulette.start.title'] },
  'catch-pokemon': { keys: ['game.main.roulette.catch.which', 'game.main.roulette.catch.pkmn'], withGenerationSuffix: true },
  'select-form': { keys: ['game.main.roulette.form.which'] },
  'check-evolution': { keys: ['game.main.roulette.checkEvolution.title'] },
  'adventure-continues': { keys: ['game.main.roulette.adventure.title'] },
  'team-rocket-encounter': { keys: ['game.main.roulette.teamrocket.title'] },
  'mysterious-egg': { keys: ['game.main.roulette.egg.title'] },
  'legendary-encounter': { keys: ['game.main.roulette.legendary.which'], withGenerationSuffix: true },
  'catch-legendary': { keys: ['game.main.roulette.legendary.catch'] },
  'trade-pokemon': { keys: ['game.main.roulette.trade.title'] },
  'find-item': { keys: ['game.main.roulette.item.title'] },
  'find-ability-capsule': { keys: ['game.main.roulette.abilityCapsule.title'] },
  'area-zero': { keys: ['game.main.roulette.areaZero.title'] },
  'catch-paradox': { keys: ['game.main.roulette.areaZero.catch'] },
  'explore-cave': { keys: ['game.main.roulette.cave.explore.title'] },
  'catch-cave-pokemon': { keys: ['game.main.roulette.cave.which'], withGenerationSuffix: true },
  'find-fossil': { keys: ['game.main.roulette.fossil.which'], withGenerationSuffix: true },
  'snorlax-encounter': { keys: ['game.main.roulette.snorlax.outcome'] },
  'go-fishing': { keys: ['game.main.roulette.fishing.title'], withGenerationSuffix: true },
  'elite-four-preparation': { keys: ['game.main.roulette.elite.prep.title'] },
};
