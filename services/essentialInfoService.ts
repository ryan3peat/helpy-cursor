// services/essentialInfoService.ts
import { supabase } from './supabase';
import type { EssentialInfo, CreateEssentialInfo, EssentialInfoCategory } from '@src/types/essentialInfo';

const TABLE_NAME = 'essential_info';

/**
 * Convert snake_case from Supabase to camelCase for app
 */
function toCamelCase(data: any): EssentialInfo {
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
  };
}

/**
 * Convert camelCase to snake_case for Supabase
 */
function toSnakeCase(data: Partial<EssentialInfo>): any {
  const result: any = {};
  if (data.category !== undefined) result.category = data.category;
  if (data.name !== undefined) result.name = data.name;
  if (data.address !== undefined) result.address = data.address;
  if (data.countryCode !== undefined) result.country_code = data.countryCode;
  if (data.phone !== undefined) result.phone = data.phone;
  if (data.note !== undefined) result.note = data.note;
  return result;
}

/**
 * Fetch all essential info for a household
 */
export async function listEssentialInfo(householdId: string): Promise<EssentialInfo[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch essential info:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Fetch essential info filtered by category
 */
export async function listEssentialInfoByCategory(
  householdId: string,
  category: EssentialInfoCategory
): Promise<EssentialInfo[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('household_id', householdId)
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch essential info by category:', error);
    throw error;
  }

  return (data || []).map(toCamelCase);
}

/**
 * Create new essential info entry
 */
export async function createEssentialInfo(
  householdId: string,
  info: CreateEssentialInfo
): Promise<EssentialInfo> {
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
    console.error('❌ Failed to create essential info:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Update existing essential info entry
 */
export async function updateEssentialInfo(
  householdId: string,
  id: string,
  updates: Partial<CreateEssentialInfo>
): Promise<EssentialInfo> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(toSnakeCase(updates))
    .eq('id', id)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to update essential info:', error);
    throw error;
  }

  return toCamelCase(data);
}

/**
 * Delete essential info entry
 */
export async function deleteEssentialInfo(
  householdId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('❌ Failed to delete essential info:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes for essential info
 */
export function subscribeToEssentialInfo(
  householdId: string,
  callback: (data: EssentialInfo[]) => void
): () => void {
  // Initial fetch
  listEssentialInfo(householdId).then(callback).catch(console.error);

  // Subscribe to changes
  const channelName = `essential_info-${householdId}`;
  
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
        listEssentialInfo(householdId).then(callback).catch(console.error);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}

