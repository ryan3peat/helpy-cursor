// services/trainingService.ts
import { supabase } from './supabase';
import type { 
  TrainingModule, 
  CreateTrainingModule, 
  UpdateTrainingModule,
  HelperPoints,
  TrainingStats,
} from '@src/types/training';

const TABLE_NAME = 'training_modules';
const POINTS_TABLE = 'helper_points';

/**
 * Convert snake_case from Supabase to camelCase for app
 */
function toCamelCase(data: any): TrainingModule {
  return {
    id: data.id,
    householdId: data.household_id,
    category: data.category,
    customCategory: data.custom_category,
    name: data.name,
    content: data.content,
    assigneeId: data.assignee_id,
    isCompleted: data.is_completed,
    completedAt: data.completed_at,
    points: data.points || 10,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

/**
 * Convert camelCase to snake_case for Supabase
 */
function toSnakeCase(data: Partial<TrainingModule | CreateTrainingModule>): any {
  const result: any = {};
  if ('category' in data && data.category !== undefined) result.category = data.category;
  if ('customCategory' in data && data.customCategory !== undefined) result.custom_category = data.customCategory;
  if ('name' in data && data.name !== undefined) result.name = data.name;
  if ('content' in data && data.content !== undefined) result.content = data.content;
  if ('assigneeId' in data && data.assigneeId !== undefined) result.assignee_id = data.assigneeId;
  if ('isCompleted' in data && data.isCompleted !== undefined) result.is_completed = data.isCompleted;
  if ('completedAt' in data && data.completedAt !== undefined) result.completed_at = data.completedAt;
  if ('points' in data && data.points !== undefined) result.points = data.points;
  if ('createdBy' in data && data.createdBy !== undefined) result.created_by = data.createdBy;
  return result;
}

/**
 * Fetch all training modules for a household
 */
export async function listTrainingModules(householdId: string): Promise<TrainingModule[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch training modules:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Fetch training modules assigned to a specific user (helper)
 */
export async function listTrainingModulesForUser(
  householdId: string, 
  userId: string
): Promise<TrainingModule[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .eq('assignee_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch user training modules:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Get training stats for a household
 */
export async function getTrainingStats(householdId: string): Promise<TrainingStats> {
  const modules = await listTrainingModules(householdId);
  return {
    total: modules.length,
    pending: modules.filter(m => !m.isCompleted).length,
    completed: modules.filter(m => m.isCompleted).length,
  };
}

/**
 * Create a new training module
 */
export async function createTrainingModule(
  householdId: string,
  module: CreateTrainingModule,
  createdBy: string
): Promise<TrainingModule> {
  const payload = {
    ...toSnakeCase(module),
    household_id: householdId,
    created_by: createdBy,
    is_completed: false,
    points: module.points || 10,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Failed to create training module:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Update a training module
 */
export async function updateTrainingModule(
  householdId: string,
  id: string,
  updates: UpdateTrainingModule
): Promise<TrainingModule> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(toSnakeCase(updates))
    .eq('id', id)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update training module:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Mark a training module as completed (for helpers)
 */
export async function completeTrainingModule(
  householdId: string,
  moduleId: string,
  userId: string
): Promise<TrainingModule> {
  // First, get the module to check points
  const { data: moduleData, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', moduleId)
    .eq('household_id', householdId)
    .single();

  if (fetchError || !moduleData) {
    console.error('Failed to fetch training module:', fetchError);
    throw fetchError;
  }

  // Mark as completed
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', moduleId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    console.error('Failed to complete training module:', error);
    throw error;
  }

  // Award points to the helper
  await awardPoints(userId, moduleData.points || 10);

  return toCamelCase(data);
}

/**
 * Delete a training module
 */
export async function deleteTrainingModule(
  householdId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('Failed to delete training module:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes for training modules
 */
export function subscribeToTrainingModules(
  householdId: string,
  callback: (data: TrainingModule[]) => void
): () => void {
  // Initial fetch
  listTrainingModules(householdId).then(callback).catch(console.error);

  // Subscribe to changes
  const channelName = `training_modules-${householdId}`;
  
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE_NAME,
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        // Refetch on any change
        listTrainingModules(householdId).then(callback).catch(console.error);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}

// ─────────────────────────────────────────────────────────────────
// Helper Points / Gamification
// ─────────────────────────────────────────────────────────────────

/**
 * Get helper points for a user
 */
export async function getHelperPoints(userId: string): Promise<HelperPoints | null> {
  const { data, error } = await supabase
    .from(POINTS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No record found, return null
      return null;
    }
    console.error('Failed to fetch helper points:', error);
    throw error;
  }

  return {
    id: data.id,
    userId: data.user_id,
    totalPoints: data.total_points,
    trainingsCompleted: data.trainings_completed,
    updatedAt: data.updated_at,
  };
}

/**
 * Award points to a helper
 */
export async function awardPoints(userId: string, points: number): Promise<HelperPoints> {
  // Check if user has a points record
  const existing = await getHelperPoints(userId);

  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from(POINTS_TABLE)
      .update({
        total_points: existing.totalPoints + points,
        trainings_completed: existing.trainingsCompleted + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update helper points:', error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      totalPoints: data.total_points,
      trainingsCompleted: data.trainings_completed,
      updatedAt: data.updated_at,
    };
  } else {
    // Create new record
    const { data, error } = await supabase
      .from(POINTS_TABLE)
      .insert([{
        user_id: userId,
        total_points: points,
        trainings_completed: 1,
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create helper points:', error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      totalPoints: data.total_points,
      trainingsCompleted: data.trainings_completed,
      updatedAt: data.updated_at,
    };
  }
}

/**
 * Subscribe to helper points changes
 */
export function subscribeToHelperPoints(
  userId: string,
  callback: (data: HelperPoints | null) => void
): () => void {
  // Initial fetch
  getHelperPoints(userId).then(callback).catch(console.error);

  // Subscribe to changes
  const channelName = `helper_points-${userId}`;
  
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: POINTS_TABLE,
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getHelperPoints(userId).then(callback).catch(console.error);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

