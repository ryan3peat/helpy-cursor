// services/trainingService.ts
import { supabase } from './supabase';
import type { 
  TrainingModule, 
  CreateTrainingModule, 
  UpdateTrainingModule,
  TrainingStats,
} from '@src/types/training';

const TABLE_NAME = 'training_modules';

// Cache to store clerk_id -> supabase uuid mapping
const userIdCache: Record<string, string> = {};

/**
 * Get the actual Supabase UUID for a user ID
 * Handles both Clerk IDs (active users) and Supabase UUIDs (pending users)
 */
async function getSupabaseUserId(id: string, householdId: string): Promise<string | null> {
  if (!id || id === '') return null;
  
  // Check cache first
  if (userIdCache[id]) {
    return userIdCache[id];
  }
  
  // Query all users in household
  const { data, error } = await supabase
    .from('users')
    .select('id, clerk_id, status')
    .eq('household_id', householdId);
  
  if (error) {
    console.error('Error querying users for ID conversion:', error);
    return null;
  }
  
  // First, check if this ID matches a clerk_id (active users)
  const userByClerkId = data?.find(u => String(u.clerk_id) === String(id));
  if (userByClerkId) {
    userIdCache[id] = userByClerkId.id;
    return userByClerkId.id;
  }
  
  // Second, check if this ID is already a Supabase UUID (pending users)
  const userByUuid = data?.find(u => String(u.id) === String(id));
  if (userByUuid) {
    userIdCache[id] = id;
    return id;
  }
  
  console.error('Could not find user with id:', id);
  return null;
}

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
    createdBy: data.created_by,
    createdAt: data.created_at,
    nameLang: data.name_lang,
    nameTranslations: data.name_translations || {},
    contentLang: data.content_lang,
    contentTranslations: data.content_translations || {},
  };
}

/**
 * Convert camelCase to snake_case for Supabase
 * Note: Empty strings for UUID fields are converted to null
 */
function toSnakeCase(data: Partial<TrainingModule | CreateTrainingModule>): any {
  const result: any = {};
  if ('category' in data && data.category !== undefined) result.category = data.category;
  if ('customCategory' in data && data.customCategory !== undefined) result.custom_category = data.customCategory;
  if ('name' in data && data.name !== undefined) result.name = data.name;
  if ('content' in data && data.content !== undefined) result.content = data.content;
  // Convert empty string to null for UUID field
  if ('assigneeId' in data && data.assigneeId !== undefined) {
    result.assignee_id = data.assigneeId === '' ? null : data.assigneeId;
  }
  if ('isCompleted' in data && data.isCompleted !== undefined) result.is_completed = data.isCompleted;
  if ('completedAt' in data && data.completedAt !== undefined) result.completed_at = data.completedAt;
  // Convert empty string to null for UUID field
  if ('createdBy' in data && data.createdBy !== undefined) {
    result.created_by = data.createdBy === '' ? null : data.createdBy;
  }
  if ('nameLang' in data && data.nameLang !== undefined) result.name_lang = data.nameLang;
  if ('nameTranslations' in data && data.nameTranslations !== undefined) result.name_translations = data.nameTranslations;
  if ('contentLang' in data && data.contentLang !== undefined) result.content_lang = data.contentLang;
  if ('contentTranslations' in data && data.contentTranslations !== undefined) result.content_translations = data.contentTranslations;
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
  // Convert Clerk ID to Supabase UUID
  const userUuid = await getSupabaseUserId(userId, householdId);
  if (!userUuid) {
    console.error('Could not resolve user ID:', userId);
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .eq('assignee_id', userUuid)
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
  // Convert Clerk IDs to Supabase UUIDs
  let createdByUuid: string | null = null;
  if (createdBy && createdBy !== '') {
    createdByUuid = await getSupabaseUserId(createdBy, householdId);
  }
  
  let assigneeUuid: string | null = null;
  if (module.assigneeId && module.assigneeId !== '') {
    assigneeUuid = await getSupabaseUserId(module.assigneeId, householdId);
  }

  const payload = {
    ...toSnakeCase(module),
    household_id: householdId,
    created_by: createdByUuid,
    assignee_id: assigneeUuid,
    is_completed: false,
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
  const snakeCaseUpdates = toSnakeCase(updates);
  
  // Convert assignee_id from Clerk ID to Supabase UUID if present
  if ('assignee_id' in snakeCaseUpdates && snakeCaseUpdates.assignee_id) {
    const assigneeUuid = await getSupabaseUserId(snakeCaseUpdates.assignee_id, householdId);
    snakeCaseUpdates.assignee_id = assigneeUuid;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(snakeCaseUpdates)
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
  moduleId: string
): Promise<TrainingModule> {
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

