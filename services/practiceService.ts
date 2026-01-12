// services/practiceService.ts
// Renamed from houseRoutineService.ts - "Practice" is the user-facing name
import { supabase as defaultSupabase } from './supabase';
import { getAuthenticatedSupabaseClient, refreshSupabaseToken } from '../contexts/SupabaseContext';
import type { Practice, CreatePractice, PracticeCategory } from '@src/types/practice';

// Table renamed from 'house_routine' to 'practices' (see migration 060)
const TABLE_NAME = 'practices';

/**
 * Get the best available Supabase client.
 * Prefers authenticated client with JWT (for RLS), falls back to default.
 * WARNING: If auth client is null, RLS will fail and queries return empty!
 */
function getSupabase() {
  const authClient = getAuthenticatedSupabaseClient();
  if (!authClient) {
    console.warn('[practiceService] ⚠️ No authenticated client - RLS may fail');
  }
  return authClient || defaultSupabase;
}

/**
 * Check if an error is JWT/auth related and should trigger a retry
 */
function isJwtError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'PGRST303') return true;
  const message = error.message?.toLowerCase() || '';
  if (message.includes('jwt expired')) return true;
  if (message.includes('jwt') && message.includes('expired')) return true;
  if (message.includes('invalid jwt')) return true;
  if (error.code === '42501' && message.includes('policy')) return true;
  return false;
}

// Wrapper that uses authenticated client for all operations
const supabase = {
  from: (table: string) => getSupabase().from(table),
  channel: (name: string) => getSupabase().channel(name),
};

/**
 * Convert snake_case from Supabase to camelCase for app
 */
function toCamelCase(data: any): Practice {
  return {
    id: data.id,
    householdId: data.household_id,
    category: data.category,
    customCategory: data.custom_category,
    name: data.name,
    note: data.note,
    createdAt: data.created_at,
    nameLang: data.name_lang,
    nameTranslations: data.name_translations,
    noteLang: data.note_lang,
    noteTranslations: data.note_translations,
    preset_id: data.preset_id,
  };
}

/**
 * Convert camelCase to snake_case for Supabase
 */
function toSnakeCase(data: Partial<Practice | CreatePractice>): any {
  const result: any = {};
  if ('category' in data && data.category !== undefined) result.category = data.category;
  if ('customCategory' in data && data.customCategory !== undefined) result.custom_category = data.customCategory;
  if ('name' in data && data.name !== undefined) result.name = data.name;
  if ('note' in data && data.note !== undefined) result.note = data.note;
  if ('nameLang' in data && data.nameLang !== undefined) result.name_lang = data.nameLang;
  if ('nameTranslations' in data && data.nameTranslations !== undefined) result.name_translations = data.nameTranslations;
  if ('noteLang' in data && data.noteLang !== undefined) result.note_lang = data.noteLang;
  if ('noteTranslations' in data && data.noteTranslations !== undefined) result.note_translations = data.noteTranslations;
  if ('preset_id' in data && data.preset_id !== undefined) result.preset_id = data.preset_id;
  return result;
}

/**
 * Fetch all practice entries for a household
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function listPractices(householdId: string): Promise<Practice[]> {
  let { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    console.warn('[practiceService] ⚠️ JWT error on listPractices, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      // Retry with fresh client
      const retryResult = await getSupabase()
        .from(TABLE_NAME)
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });
      
      if (!retryResult.error) {
        console.log('[practiceService] ✅ Retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        console.error('[practiceService] ❌ Retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      console.error('[practiceService] ❌ Token refresh failed:', refreshError);
    }
  }

  if (error) {
    console.error('Failed to fetch practices:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Fetch practice entries by category
 */
export async function listPracticesByCategory(
  householdId: string,
  category: PracticeCategory
): Promise<Practice[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch practices by category:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Create new practice entry
 */
export async function createPractice(
  householdId: string,
  item: CreatePractice
): Promise<Practice> {
  const payload = {
    ...toSnakeCase(item),
    household_id: householdId,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Failed to create practice:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Update existing practice entry
 */
export async function updatePractice(
  householdId: string,
  id: string,
  updates: Partial<CreatePractice>
): Promise<Practice> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(toSnakeCase(updates))
    .eq('id', id)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update practice:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Delete practice entry
 */
export async function deletePractice(
  householdId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('Failed to delete practice:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes for practices
 */
export function subscribeToPractices(
  householdId: string,
  callback: (data: Practice[]) => void
): () => void {
  // Initial fetch
  listPractices(householdId).then(callback).catch(console.error);

  // Subscribe to changes
  const channelName = `practices-${householdId}`;
  
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
        listPractices(householdId).then(callback).catch(console.error);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}
