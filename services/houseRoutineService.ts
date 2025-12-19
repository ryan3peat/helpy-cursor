// services/houseRoutineService.ts
// DEPRECATED: This file re-exports from practiceService.ts for backwards compatibility
// Use 'services/practiceService' for new code

export {
  // New functions
  listPractices,
  listPracticesByCategory,
  createPractice,
  updatePractice,
  deletePractice,
  subscribeToPractices,
  // Legacy aliases
  listHouseRoutine,
  listHouseRoutineByCategory,
  createHouseRoutine,
  updateHouseRoutine,
  deleteHouseRoutine,
  subscribeToHouseRoutine,
} from './practiceService';
