// src/types/houseRoutine.ts
// DEPRECATED: This file re-exports from practice.ts for backwards compatibility
// Use '@src/types/practice' for new code

export type {
  // New types
  Practice,
  PracticeCategory,
  CreatePractice,
  // Legacy aliases
  HouseRoutine,
  HouseRoutineCategory,
  CreateHouseRoutine,
} from './practice';

export {
  // Constants
  PRACTICE_CATEGORIES,
  PRACTICE_CATEGORY_CONFIG,
  HOUSE_ROUTINE_CATEGORIES,
  HOUSE_ROUTINE_CATEGORY_CONFIG,
} from './practice';
