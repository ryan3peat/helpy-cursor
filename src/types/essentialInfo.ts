// src/types/essentialInfo.ts
// DEPRECATED: This file re-exports from place.ts for backwards compatibility
// Use '@src/types/place' for new code

export type {
  // New types
  Place,
  PlaceCategory,
  CreatePlace,
  // Legacy aliases
  EssentialInfo,
  EssentialInfoCategory,
  CreateEssentialInfo,
} from './place';

export {
  // Constants
  PLACE_CATEGORY_CONFIG,
  COUNTRY_CODES,
  CATEGORY_CONFIG,
} from './place';
