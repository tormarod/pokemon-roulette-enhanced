export interface EventPopupImage {
  /** Provide exactly one of src/emoji. */
  src?: string;
  /** Glyph shown instead of an <img> (e.g. coinsFoundModal's 🪙) — sized to roughly match `height`. */
  emoji?: string;
  alt?: string;
  /** px, default 128 (64 for the smaller item/capsule-found popups). Also used to size an emoji's font-size. */
  height?: number;
}
