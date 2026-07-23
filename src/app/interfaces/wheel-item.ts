export interface WheelItem {
  text: string,
  fillStyle: string,
  weight: number;
  /** Slice gets a bright outline — e.g. a type bias currently boosting toward this item. */
  highlighted?: boolean;
  /**
   * Semantic outcome for the post-spin result chip: battle wheels tag their
   * yes/no tickets so the wheel can show a VICTORY/DEFEAT chip; wheels without
   * it get a neutral chip with the item's own text.
   */
  resultKind?: 'victory' | 'defeat';
}