// src/types/practice.ts
// Renamed from houseRoutine.ts - "Practice" is the user-facing name
// Note: "Practice" means household customs/methods, NOT training/exercise

export type PracticeCategory =
  | 'House Rules'
  | 'Routine'
  | 'Meal Preparations'
  | 'Child Care'
  | 'Cleaning'
  | 'Grocery & Market'
  | 'Laundry & Wardrobe'
  | 'Safety & Emergency'
  | 'Energy & Bills'
  | 'Helper Self-Care'
  | 'Others';

export const PRACTICE_CATEGORIES: PracticeCategory[] = [
  'House Rules',
  'Routine',
  'Meal Preparations',
  'Child Care',
  'Cleaning',
  'Grocery & Market',
  'Laundry & Wardrobe',
  'Safety & Emergency',
  'Energy & Bills',
  'Helper Self-Care',
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
  'House Rules': { color: '#7E57C2', bgColor: '#EDE7F6' },
  'Routine': { color: '#AB47BC', bgColor: '#F3E5F5' },
  'Meal Preparations': { color: '#FF9800', bgColor: '#FFF3E0' },
  'Child Care': { color: '#F06292', bgColor: '#FCE4EC' },
  'Cleaning': { color: '#4CAF50', bgColor: '#E8F5E9' },
  'Grocery & Market': { color: '#4CAF50', bgColor: '#E8F5E9' },
  'Laundry & Wardrobe': { color: '#3EAFD2', bgColor: '#E6F7FB' },
  'Safety & Emergency': { color: '#F06292', bgColor: '#FCE4EC' },
  'Energy & Bills': { color: '#FF9800', bgColor: '#FFF3E0' },
  'Helper Self-Care': { color: '#F06292', bgColor: '#FCE4EC' },
  'Others': { color: '#757575', bgColor: '#F5F5F5' },
};

// Legacy alias
export const HOUSE_ROUTINE_CATEGORY_CONFIG = PRACTICE_CATEGORY_CONFIG;
