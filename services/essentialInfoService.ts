// services/essentialInfoService.ts
// DEPRECATED: This file re-exports from placeService.ts for backwards compatibility
// Use 'services/placeService' for new code

export {
  // New functions
  listPlaces,
  listPlacesByCategory,
  createPlace,
  updatePlace,
  deletePlace,
  subscribeToPlaces,
  // Legacy aliases
  listEssentialInfo,
  listEssentialInfoByCategory,
  createEssentialInfo,
  updateEssentialInfo,
  deleteEssentialInfo,
  subscribeToEssentialInfo,
} from './placeService';
