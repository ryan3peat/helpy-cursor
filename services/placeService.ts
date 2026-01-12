// services/placeService.ts
// Renamed from essentialInfoService.ts - "Places" is the user-facing name
import { supabase as defaultSupabase } from './supabase';
import { getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';
import type { Place, CreatePlace, PlaceCategory } from '@src/types/place';

// Table renamed from 'essential_info' to 'places' (see migration 060)
const TABLE_NAME = 'places';

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
function toCamelCase(data: any): Place {
  return {
    id: data.id,
    householdId: data.household_id,
    category: data.category,
    name: data.name,
    address: data.address,
    countryCode: data.country_code,
    phone: data.phone,
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
function toSnakeCase(data: Partial<Place>): any {
  const result: any = {};
  if (data.category !== undefined) result.category = data.category;
  if (data.name !== undefined) result.name = data.name;
  if (data.address !== undefined) result.address = data.address;
  if (data.countryCode !== undefined) result.country_code = data.countryCode;
  if (data.phone !== undefined) result.phone = data.phone;
  if (data.note !== undefined) result.note = data.note;
  if (data.nameLang !== undefined) result.name_lang = data.nameLang;
  if (data.nameTranslations !== undefined) result.name_translations = data.nameTranslations;
  if (data.noteLang !== undefined) result.note_lang = data.noteLang;
  if (data.noteTranslations !== undefined) result.note_translations = data.noteTranslations;
  return result;
}

/**
 * Fetch all places for a household
 */
export async function listPlaces(householdId: string): Promise<Place[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch places:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Fetch places filtered by category
 */
export async function listPlacesByCategory(
  householdId: string,
  category: PlaceCategory
): Promise<Place[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch places by category:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Create new place entry
 */
export async function createPlace(
  householdId: string,
  info: CreatePlace
): Promise<Place> {
  const payload = {
    ...toSnakeCase(info),
    household_id: householdId,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to create place:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Update existing place entry
 */
export async function updatePlace(
  householdId: string,
  id: string,
  updates: Partial<CreatePlace>
): Promise<Place> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(toSnakeCase(updates))
    .eq('id', id)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to update place:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Delete place entry
 */
export async function deletePlace(
  householdId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('❌ Failed to delete place:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes for places
 */
export function subscribeToPlaces(
  householdId: string,
  callback: (data: Place[]) => void
): () => void {
  // Initial fetch
  listPlaces(householdId).then(callback).catch(console.error);

  // Subscribe to changes
  const channelName = `places-${householdId}`;
  
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
        listPlaces(householdId).then(callback).catch(console.error);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}
