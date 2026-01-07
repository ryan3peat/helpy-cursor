// src/types/practice.ts
// Renamed from houseRoutine.ts - "Practice" is the user-facing name
// Note: "Practice" means household customs/methods, NOT training/exercise

export type PracticeCategory =
  | 'Home Rules'
  | 'Routine'
  | 'Cooking'
  | 'Child Care'
  | 'Cleaning'
  | 'Grocery'
  | 'Laundry'
  | 'Pet Care'
  | 'Safety'
  | 'Utilities'
  | 'Helper Care'
  | 'Others';

export const PRACTICE_CATEGORIES: PracticeCategory[] = [
  'Home Rules',
  'Routine',
  'Cooking',
  'Child Care',
  'Cleaning',
  'Grocery',
  'Laundry',
  'Pet Care',
  'Safety',
  'Utilities',
  'Helper Care',
  'Others',
];

export interface Practice {
  id: string;
  householdId: string;
  category: PracticeCategory;
  customCategory?: string; // For "Others" category with custom entry
  name: string;
  note?: string;
  createdAt?: string;
  // Translation fields
  nameLang?: string | null;
  nameTranslations?: Record<string, string>;
  noteLang?: string | null;
  noteTranslations?: Record<string, string>;
}

// For creating new entries (id is auto-generated)
export type CreatePractice = Omit<Practice, 'id' | 'householdId' | 'createdAt'>;

// Legacy aliases for backwards compatibility during migration
// TODO: Remove these after all references are updated
export type HouseRoutineCategory = PracticeCategory;
export type HouseRoutine = Practice;
export type CreateHouseRoutine = CreatePractice;
export const HOUSE_ROUTINE_CATEGORIES = PRACTICE_CATEGORIES;

// Category colors
export const PRACTICE_CATEGORY_CONFIG: Record<PracticeCategory, { color: string; bgColor: string }> = {
  'Home Rules': { color: '#7E57C2', bgColor: '#EDE7F6' },
  'Routine': { color: '#7E57C2', bgColor: '#EDE7F6' },
  'Cooking': { color: '#FF9800', bgColor: '#FFF3E0' },
  'Child Care': { color: '#F06292', bgColor: '#FCE4EC' },
  'Cleaning': { color: '#4CAF50', bgColor: '#E8F5E9' },
  'Grocery': { color: '#4CAF50', bgColor: '#E8F5E9' },
  'Laundry': { color: '#3EAFD2', bgColor: '#E6F7FB' },
  'Pet Care': { color: '#8D6E63', bgColor: '#EFEBE9' },
  'Safety': { color: '#F06292', bgColor: '#FCE4EC' },
  'Utilities': { color: '#FF9800', bgColor: '#FFF3E0' },
  'Helper Care': { color: '#F06292', bgColor: '#FCE4EC' },
  'Others': { color: '#757575', bgColor: '#F5F5F5' },
};

// Legacy alias
export const HOUSE_ROUTINE_CATEGORY_CONFIG = PRACTICE_CATEGORY_CONFIG;
