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
  points: number;
  createdBy?: string;
  createdAt?: string;
}

// For creating new training modules
export type CreateTrainingModule = Omit<TrainingModule, 'id' | 'householdId' | 'createdAt' | 'isCompleted' | 'completedAt'>;

// For updating training modules
export type UpdateTrainingModule = Partial<CreateTrainingModule>;

// Helper points/gamification
export interface HelperPoints {
  id: string;
  userId: string;
  totalPoints: number;
  trainingsCompleted: number;
  updatedAt?: string;
}

// Training stats for UI
export interface TrainingStats {
  total: number;
  pending: number;
  completed: number;
}

// Category config for UI
// Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #AB47BC, #D2366E, #757575
export const TRAINING_CATEGORY_CONFIG: Record<TrainingCategory, { color: string; bgColor: string }> = {
  'House Rules': { color: '#7E57C2', bgColor: '#EDE7F6' },
  'Routine': { color: '#AB47BC', bgColor: '#F3E5F5' },
  'Meal Preparations': { color: '#FF9800', bgColor: '#FFF3E0' },
  'Child Care': { color: '#F06292', bgColor: '#FCE4EC' },
  'Cleaning': { color: '#4CAF50', bgColor: '#E8F5E9' },
  'Grocery & Market': { color: '#4CAF50', bgColor: '#E8F5E9' },
  'Laundry & Wardrobe': { color: '#3EAFD2', bgColor: '#E6F7FB' },
  'Safety & Emergency': { color: '#D2366E', bgColor: '#FCE4EC' },
  'Energy & Bills': { color: '#FF9800', bgColor: '#FFF3E0' },
  'Helper Self-Care': { color: '#F06292', bgColor: '#FCE4EC' },
  'Others': { color: '#757575', bgColor: '#F5F5F5' },
};

// Points per level for gamification
export const LEVEL_THRESHOLDS = [
  { level: 1, minPoints: 0, maxPoints: 50 },
  { level: 2, minPoints: 50, maxPoints: 150 },
  { level: 3, minPoints: 150, maxPoints: 300 },
  { level: 4, minPoints: 300, maxPoints: 500 },
  { level: 5, minPoints: 500, maxPoints: Infinity },
];

export function getHelperLevel(points: number): { level: number; progress: number } {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (points < threshold.maxPoints) {
      const progress = threshold.maxPoints === Infinity 
        ? 100 
        : ((points - threshold.minPoints) / (threshold.maxPoints - threshold.minPoints)) * 100;
      return { level: threshold.level, progress };
    }
  }
  return { level: 5, progress: 100 };
}

