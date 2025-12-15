// services/houseRoutineService.ts
import { supabase as defaultSupabase } from './supabase';
import { getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';
import type { HouseRoutine, CreateHouseRoutine, HouseRoutineCategory } from '@src/types/houseRoutine';

const TABLE_NAME = 'house_routine';

/**
 * Get the best available Supabase client.
 * Prefers authenticated client with JWT (for RLS), falls back to default.
 */
function getSupabase() {
  const authClient = getAuthenticatedSupabaseClient();
  return authClient || defaultSupabase;
}

// Wrapper that uses authenticated client for all operations
const supabase = {
  from: (table: string) => getSupabase().from(table),
  channel: (name: string) => getSupabase().channel(name),
};

/**
 * Convert snake_case from Supabase to camelCase for app
 */
function toCamelCase(data: any): HouseRoutine {
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
  };
}

/**
 * Convert camelCase to snake_case for Supabase
 */
function toSnakeCase(data: Partial<HouseRoutine | CreateHouseRoutine>): any {
  const result: any = {};
  if ('category' in data && data.category !== undefined) result.category = data.category;
  if ('customCategory' in data && data.customCategory !== undefined) result.custom_category = data.customCategory;
  if ('name' in data && data.name !== undefined) result.name = data.name;
  if ('note' in data && data.note !== undefined) result.note = data.note;
  if ('nameLang' in data && data.nameLang !== undefined) result.name_lang = data.nameLang;
  if ('nameTranslations' in data && data.nameTranslations !== undefined) result.name_translations = data.nameTranslations;
  if ('noteLang' in data && data.noteLang !== undefined) result.note_lang = data.noteLang;
  if ('noteTranslations' in data && data.noteTranslations !== undefined) result.note_translations = data.noteTranslations;
  return result;
}

/**
 * Fetch all house routine entries for a household
 */
export async function listHouseRoutine(householdId: string): Promise<HouseRoutine[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch house routine:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Fetch house routine entries by category
 */
export async function listHouseRoutineByCategory(
  householdId: string,
  category: HouseRoutineCategory
): Promise<HouseRoutine[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch house routine by category:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Create new house routine entry
 */
export async function createHouseRoutine(
  householdId: string,
  item: CreateHouseRoutine
): Promise<HouseRoutine> {
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
    console.error('Failed to create house routine:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Update existing house routine entry
 */
export async function updateHouseRoutine(
  householdId: string,
  id: string,
  updates: Partial<CreateHouseRoutine>
): Promise<HouseRoutine> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(toSnakeCase(updates))
    .eq('id', id)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update house routine:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Delete house routine entry
 */
export async function deleteHouseRoutine(
  householdId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('Failed to delete house routine:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes for house routine
 */
export function subscribeToHouseRoutine(
  householdId: string,
  callback: (data: HouseRoutine[]) => void
): () => void {
  // Initial fetch
  listHouseRoutine(householdId).then(callback).catch(console.error);

  // Subscribe to changes
  const channelName = `house_routine-${householdId}`;
  
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
        listHouseRoutine(householdId).then(callback).catch(console.error);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}

