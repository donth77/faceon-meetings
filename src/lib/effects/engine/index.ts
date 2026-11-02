/**
 * The backgrounds and effects engine. Import it dynamically: it brings MediaPipe and
 * the compositor, which only a camera with an effect needs.
 */
export {
  startEffects,
  type EffectsEvents,
  type EffectsProcessor,
} from "./processor";
