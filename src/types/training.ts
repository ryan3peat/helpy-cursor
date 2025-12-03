// src/types/training.ts

export type TrainingCategory =
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

export const TRAINING_CATEGORIES: TrainingCategory[] = [
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

export interface TrainingModule {
  id: string;
  householdId: string;
  category: TrainingCategory;
  customCategory?: string; // For "Others" with custom entry
  name: string;
  content?: string;
  assigneeId?: string;
  isCompleted: boolean;
  completedAt?: string;
  createdBy?: string;
  createdAt?: string;
  // Translation fields
  nameLang?: string | null; // Language code of the name field (null if undetectable)
  nameTranslations?: Record<string, string>; // Translations: { "en": "original", "zh-CN": "translated", ... }
  contentLang?: string | null; // Language code of the content field (null if undetectable)
  contentTranslations?: Record<string, string>; // Translations: { "en": "original", "zh-CN": "translated", ... }
}

// For creating new training modules
export type CreateTrainingModule = Omit<TrainingModule, 'id' | 'householdId' | 'createdAt' | 'isCompleted' | 'completedAt'>;

// For updating training modules
export type UpdateTrainingModule = Partial<CreateTrainingModule>;

// Training stats for UI
export interface TrainingStats {
  total: number;
  pending: number;
  completed: number;
}

// Category config for UI
// Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #AB47BC, #F06292, #757575
export const TRAINING_CATEGORY_CONFIG: Record<TrainingCategory, { color: string; bgColor: string }> = {
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

