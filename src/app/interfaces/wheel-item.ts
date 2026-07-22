export interface WheelItem {
  text: string,
  fillStyle: string,
  weight: number;
  /** Slice gets a bright outline — e.g. a type bias currently boosting toward this item. */
  highlighted?: boolean;
}