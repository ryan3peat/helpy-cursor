import { supabase } from './supabase';
import { User, ShoppingItem, Task, Meal, Expense, Section, ToDoItem } from '../types';

// Type for generic data items
type DataItem = User | ShoppingItem | Task | Meal | Expense | Section | ToDoItem;

// CRITICAL: Map your app's collection names to Supabase table names
const COLLECTION_MAP: Record<string, string> = {
  'users': 'users',
  'shopping': 'shopping',
  'tasks': 'tasks',
  'todo_items': 'todo_items',
  'meals': 'meals',
  'expenses': 'expenses',
  'sections': 'sections',
  'essential_info': 'essential_info'
};

// Cache to store clerk_id -> supabase uuid mapping
const userIdCache: Record<string, string> = {};

/**
 * Get the actual Supabase UUID for a user
 * 
 * UPDATED: Now handles both:
 * 1. Active users: looks up by clerk_id
 * 2. Pending users: the ID IS already the Supabase UUID (no clerk_id yet)
 */
async function getSupabaseUserId(id: string, householdId: string): Promise<string | null> {
  // Check cache first
  if (userIdCache[id]) {
    console.log(`🔄 Found cached UUID for ${id}: ${userIdCache[id]}`);
    return userIdCache[id];
  }
  
  console.log(`🔍 Looking up Supabase UUID for id: ${id}`);
  
  // Query all users in household
  const { data, error } = await supabase
    .from('users')
    .select('id, clerk_id, status')
    .eq('household_id', householdId);
  
  if (error) {
    console.error('❌ Error querying users:', error);
    return null;
  }
  
  // First, check if this ID matches a clerk_id (active users)
  const userByClerkId = data?.find(u => String(u.clerk_id) === String(id));
  if (userByClerkId) {
    console.log(`✅ Found UUID ${userByClerkId.id} for clerk_id ${id}`);
    userIdCache[id] = userByClerkId.id;
    return userByClerkId.id;
  }
  
  // Second, check if this ID is already a Supabase UUID (pending users)
  const userByUuid = data?.find(u => String(u.id) === String(id));
  if (userByUuid) {
    console.log(`✅ ID ${id} is already a Supabase UUID (status: ${userByUuid.status})`);
    // Cache it mapped to itself for consistency
    userIdCache[id] = id;
    return id;
  }
  
  console.error('❌ Could not find user with id:', id);
  console.log('📋 Available users:', data);
  return null;
}

/**
 * Subscribe to real-time changes in a collection
 * Why: Keeps UI synced when data changes (e.g., another family member adds item)
 */
export function subscribeToCollection(
  householdId: string,
  collection: string,
  callback: (data: DataItem[]) => void
): () => void {
  const tableName = COLLECTION_MAP[collection];
  
  console.log(`🔔 Subscribing to ${tableName} for household ${householdId}`);
  
  // Initial fetch
  supabase
    .from(tableName)
    .select('*')
    .eq('household_id', householdId)
    .then(({ data, error }) => {
      if (error) {
        console.error(`❌ Initial fetch error for ${tableName}:`, error);
        return;
      }
      console.log(`📥 Initial ${tableName} data:`, data?.length, 'items');
      callback(convertSupabaseData(data || [], collection));
    });

    // Set up real-time subscription
  const subscription = supabase
  .channel(`${tableName}-${householdId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: tableName,
      filter: `household_id=eq.${householdId}`
    },
    (payload: any) => {
      console.log(`🔄 Real-time ${payload.eventType} on ${tableName}`);
    
      // CRITICAL FIX: Refetch all data on ANY change
      supabase
        .from(tableName)
        .select('*')
        .eq('household_id', householdId)
        .then(({ data }) => {
          console.log(`📥 Refetched ${data?.length || 0} items after ${payload.eventType}`);
          callback(convertSupabaseData(data || [], collection));
        });
    }
  )
  .subscribe((status) => {
    console.log(`📡 Subscription status for ${tableName}:`, status);
  });

  // Return unsubscribe function
  return () => {
    console.log(`🔕 Unsubscribing from ${tableName}`);
    subscription.unsubscribe();
  };
}

/**
 * Convert an array of user IDs (which may be Clerk IDs) to Supabase UUIDs
 */
async function convertUserIdsToUuids(ids: string[], householdId: string): Promise<string[]> {
  const convertedIds: string[] = [];
  for (const id of ids) {
    const uuid = await getSupabaseUserId(id, householdId);
    if (uuid) {
      convertedIds.push(uuid);
    } else {
      console.warn(`⚠️ Could not resolve user ID: ${id}`);
    }
  }
  return convertedIds;
}

/**
 * Add a new item to a collection
 * Why: Create new records (e.g., add shopping item, create task)
 */
export async function addItem(
  householdId: string,
  collection: string,
  item: Partial<DataItem>
): Promise<DataItem> {
  const tableName = COLLECTION_MAP[collection];
  
  console.log(`➕ Adding to ${collection}:`, item);
  
  // Convert camelCase to snake_case for Supabase
  const snakeCaseItem = convertToSnakeCase(item);
  
  // Ensure household_id is set
  const finalData = {
    ...snakeCaseItem,
    household_id: householdId
  };
  
  // Remove id if undefined or not a valid UUID (let Supabase generate it)
  // Temp IDs look like "temp-1234567890", "todo-1234567890", or plain timestamps like "1733139999999"
  // Valid UUIDs look like "550e8400-e29b-41d4-a716-446655440000"
  const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  
  if (finalData.id === undefined || 
      (typeof finalData.id === 'string' && !isValidUuid(finalData.id))) {
    delete finalData.id;
  }
  
  // Convert empty strings to null ONLY for specific field types
  // PostgreSQL doesn't accept empty strings for DATE, TIME, UUID columns
  // But text fields like 'description' should keep empty strings (NOT NULL constraint)
  const fieldsToConvertToNull = ['due_date', 'due_time', 'assignee_id', 'created_by', 'completed_at'];
  for (const key of fieldsToConvertToNull) {
    if (finalData[key] === '') {
      finalData[key] = null;
    }
  }

  // For expenses: handle merchant_lang and merchant_translations
  if (collection === 'expenses') {
    // Convert empty merchant_translations object to null or ensure it's valid JSONB
    if (finalData.merchant_translations !== undefined) {
      if (finalData.merchant_translations === null || 
          (typeof finalData.merchant_translations === 'object' && Object.keys(finalData.merchant_translations).length === 0)) {
        // Empty object or null - set to empty JSONB object '{}'
        finalData.merchant_translations = {};
      }
    }
    // merchant_lang can be null, empty string should be null
    if (finalData.merchant_lang === '') {
      finalData.merchant_lang = null;
    }
  }
  
  // For meals: convert for_user_ids from Clerk IDs to Supabase UUIDs
  if (collection === 'meals' && Array.isArray(finalData.for_user_ids)) {
    console.log('🔄 Converting for_user_ids to UUIDs:', finalData.for_user_ids);
    finalData.for_user_ids = await convertUserIdsToUuids(finalData.for_user_ids, householdId);
    console.log('✅ Converted for_user_ids:', finalData.for_user_ids);
  }
  
  // For todo_items: convert assignee_id from Clerk ID to Supabase UUID
  if (collection === 'todo_items' && finalData.assignee_id) {
    const uuid = await getSupabaseUserId(finalData.assignee_id, householdId);
    if (uuid) {
      console.log(`🔄 Converting assignee_id ${finalData.assignee_id} to UUID ${uuid}`);
      finalData.assignee_id = uuid;
    }
  }

  // For expenses: handle merchant_lang, merchant_translations, and receipt_url
  if (collection === 'expenses') {
    // Ensure merchant_translations is a valid object (not undefined)
    if (finalData.merchant_translations === undefined) {
      finalData.merchant_translations = {};
    } else if (finalData.merchant_translations === null) {
      // Convert null to empty object for JSONB
      finalData.merchant_translations = {};
    }
    // merchant_lang can be null, but empty string should be null
    if (finalData.merchant_lang === '') {
      finalData.merchant_lang = null;
    }
    // receipt_url can be null/undefined - remove if undefined to let DB handle default
    if (finalData.receipt_url === undefined || finalData.receipt_url === null || finalData.receipt_url === '') {
      // Only include if it has a value, otherwise let DB use default/null
      if (finalData.receipt_url === '') {
        finalData.receipt_url = null;
      } else {
        // undefined - remove the field so DB can use default
        delete finalData.receipt_url;
      }
    }
    
    // Debug: Log receipt_url for expenses
    console.log('[DB Save] Expense receipt_url being sent:', {
      hasReceiptUrl: !!finalData.receipt_url,
      receiptUrl: finalData.receipt_url,
      receiptUrlType: typeof finalData.receipt_url,
    });
  }

  console.log('🟡 Sending to Supabase:', finalData);
  
  const { data, error } = await supabase
    .from(tableName)
    .insert([finalData])
    .select()
    .single();

  console.log('🟡 Response:', { 
    hasData: !!data, 
    hasError: !!error,
    errorMessage: error?.message,
    errorDetails: error?.details,
    errorHint: error?.hint,
    errorCode: error?.code,
  });

  if (error) {
    console.error('❌ Insert failed:', error);
    console.error('❌ Full error object:', JSON.stringify(error, null, 2));
    console.error('❌ Data that failed to insert:', JSON.stringify(finalData, null, 2));
    throw error;
  }
  
  if (!data) {
    console.error('❌ Insert succeeded but no data returned');
    console.error('❌ Final data sent:', JSON.stringify(finalData, null, 2));
    throw new Error('Insert succeeded but no data returned from database');
  }
  
  console.log('✅ Insert successful, returned data keys:', Object.keys(data));
  
  // Debug: Log receipt_url in response for expenses
  if (collection === 'expenses' && data) {
    console.log('[DB Response] Expense receipt_url returned from DB:', {
      hasReceiptUrl: !!data.receipt_url,
      receiptUrl: data.receipt_url,
      receiptUrlType: typeof data.receipt_url,
      allKeys: Object.keys(data),
    });
  }
  
  return convertSupabaseData([data], collection)[0];
}

/**
 * Update an existing item
 * Why: Modify records (e.g., mark task complete, update user profile)
 */
export async function updateItem(
  householdId: string,
  collection: string,
  id: string,
  updates: Partial<DataItem>
): Promise<void> {
  const tableName = COLLECTION_MAP[collection];
  
  console.log(`🔄 Updating ${collection} item:`, id, updates);
  
  const snakeCaseUpdates = convertToSnakeCase(updates);
  
  // Convert empty strings to null ONLY for specific field types
  // PostgreSQL doesn't accept empty strings for DATE, TIME, UUID columns
  // But text fields like 'description' should keep empty strings (NOT NULL constraint)
  const fieldsToConvertToNull = ['due_date', 'due_time', 'assignee_id', 'created_by', 'completed_at'];
  for (const key of fieldsToConvertToNull) {
    if (snakeCaseUpdates[key] === '') {
      snakeCaseUpdates[key] = null;
    }
  }
  
  // For meals: convert for_user_ids from Clerk IDs to Supabase UUIDs
  if (collection === 'meals' && Array.isArray(snakeCaseUpdates.for_user_ids)) {
    console.log('🔄 Converting for_user_ids to UUIDs:', snakeCaseUpdates.for_user_ids);
    snakeCaseUpdates.for_user_ids = await convertUserIdsToUuids(snakeCaseUpdates.for_user_ids, householdId);
    console.log('✅ Converted for_user_ids:', snakeCaseUpdates.for_user_ids);
  }
  
  // For todo_items: convert assignee_id from Clerk ID to Supabase UUID
  if (collection === 'todo_items' && snakeCaseUpdates.assignee_id) {
    const uuid = await getSupabaseUserId(snakeCaseUpdates.assignee_id, householdId);
    if (uuid) {
      console.log(`🔄 Converting assignee_id ${snakeCaseUpdates.assignee_id} to UUID ${uuid}`);
      snakeCaseUpdates.assignee_id = uuid;
    }
  }
  
  console.log('🔄 Snake case updates:', snakeCaseUpdates);
  
  let actualId = id;
  
  // For users, we need to find the actual Supabase UUID
  // This handles both active users (clerk_id) and pending users (uuid)
  if (collection === 'users') {
    const supabaseId = await getSupabaseUserId(id, householdId);
    if (!supabaseId) {
      console.error('❌ Could not find Supabase UUID for user:', id);
      throw new Error(`User not found: ${id}`);
    }
    actualId = supabaseId;
    console.log(`🔄 Resolved id ${id} to Supabase UUID ${actualId}`);
  }
  
  const { error, data } = await supabase
    .from(tableName)
    .update(snakeCaseUpdates)
    .eq('id', actualId)
    .eq('household_id', householdId)
    .select();

  console.log('🔄 Update response:', { data, error });

  if (error) {
    console.error('❌ Update failed:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    console.warn('⚠️ No rows updated - item may not exist or wrong ID');
  } else {
    console.log('✅ Update successful');
  }
}

/**
 * Delete an item
 * Why: Remove records (e.g., delete completed task)
 */
export async function deleteItem(
  householdId: string,
  collection: string,
  id: string
): Promise<void> {
  const tableName = COLLECTION_MAP[collection];
  
  console.log(`🗑️ Deleting ${collection} item:`, id);
  
  let actualId = id;
  
  // For users, resolve to Supabase UUID
  if (collection === 'users') {
    const supabaseId = await getSupabaseUserId(id, householdId);
    if (!supabaseId) {
      console.error('❌ Could not find Supabase UUID for user:', id);
      throw new Error(`User not found: ${id}`);
    }
    actualId = supabaseId;
    console.log(`🗑️ Resolved id ${id} to Supabase UUID ${actualId}`);
  }
  
  const { error, count } = await supabase
    .from(tableName)
    .delete({ count: 'exact' })
    .eq('id', actualId)
    .eq('household_id', householdId);

  if (error) {
    console.error('❌ Delete error:', error);
    throw error;
  }
  
  if (count === 0) {
    console.warn('⚠️ No rows deleted - item may not exist');
  } else {
    console.log('✅ Delete successful');
    // Clear from cache
    delete userIdCache[id];
  }
}

/**
 * Save family notes (special case - stored in households table)
 * Why: Notes are household-level, not a separate collection
 */
export async function saveFamilyNotes(
  householdId: string,
  notes: string
): Promise<void> {
  const { error } = await supabase
    .from('households')
    .update({ family_notes: notes })
    .eq('id', householdId);

  if (error) throw error;
}

/**
 * Subscribe to family notes changes
 * Why: Real-time updates when anyone edits the family board
 */
export function subscribeToNotes(
  householdId: string,
  callback: (notes: string) => void
): () => void {
  // Initial fetch
  supabase
    .from('households')
    .select('family_notes')
    .eq('id', householdId)
    .single()
    .then(({ data }) => {
      if (data) callback(data.family_notes || '');
    });

  // Subscribe to changes
  const subscription = supabase
    .channel(`households-${householdId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'households',
        filter: `id=eq.${householdId}`
      },
      (payload: any) => {
        callback(payload.new.family_notes || '');
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Authentication functions
 */
export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<User> {
  console.log('🔵 registerUser called', { name, email });
  
  // 1. Create household FIRST (doesn't need auth)
  console.log('🔵 Creating household');
  const { data: householdData, error: householdError } = await supabase
    .from('households')
    .insert([{ name: `${name}'s Home` }])
    .select()
    .single();

  console.log('🔵 Household response:', { householdData, householdError });
  
  if (householdError) {
    console.error('🔴 Household creation failed:', householdError);
    throw new Error(`Failed to create household: ${householdError.message}`);
  }

  // 2. Create auth user in Supabase Auth
  console.log('🔵 Creating auth user');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
        household_id: householdData.id
      }
    }
  });

  console.log('🔵 Auth response:', { authData, authError });
  
  if (authError) {
    console.error('🔴 Auth creation failed:', authError);
    throw new Error(`Failed to create auth user: ${authError.message}`);
  }
  
  if (!authData.user) {
    throw new Error('User creation failed - no user returned');
  }

  // 3. Create user profile in users table
  console.log('🔵 Creating user profile');
  const newUser = {
    id: authData.user.id,
    household_id: householdData.id,
    email,
    name,
    role: 'Admin',
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    allergies: [],
    preferences: []
  };

  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert([newUser])
    .select()
    .single();

  console.log('🔵 User profile response:', { userData, userError });
  
  if (userError) {
    console.error('🔴 User profile creation failed:', userError);
    throw new Error(`Failed to create user profile: ${userError.message}`);
  }
  
  console.log('🟢 Registration complete:', userData);
  
  // Convert from snake_case to camelCase
  return {
    id: userData.id,
    householdId: userData.household_id,
    email: userData.email,
    name: userData.name,
    role: userData.role as any,
    avatar: userData.avatar,
    allergies: userData.allergies || [],
    preferences: userData.preferences || []
  } as User;
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !authData.user) return null;

  // Fetch user profile
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  return userData ? convertSupabaseData([userData], 'users')[0] as User : null;
}

export async function authenticateWithPin(
  email: string,
  pin: string
): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('pin', pin)
    .single();

  return data ? convertSupabaseData([data], 'users')[0] as User : null;
}

export async function getUser(
  householdId: string,
  userId: string
): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('household_id', householdId)
    .single();

  return data ? convertSupabaseData([data], 'users')[0] as User : null;
}

export async function completeInviteRegistration(
  userId: string,
  email: string,
  password: string,
  pin: string
): Promise<User> {
  // Create auth account
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) throw authError;

  // Update user record with auth ID and PIN
  const { data: userData, error: updateError } = await supabase
    .from('users')
    .update({ id: authData.user!.id, pin })
    .eq('id', userId)
    .select()
    .single();

  if (updateError) throw updateError;
  return convertSupabaseData([userData], 'users')[0] as User;
}

// HELPER FUNCTIONS

// Reverse cache to store uuid -> app user id mapping
const uuidToAppIdCache: Record<string, string> = {};

/**
 * Get the app's user ID (Clerk ID for active users) from a Supabase UUID
 */
function getAppUserIdFromUuid(uuid: string): string {
  // Check reverse cache
  if (uuidToAppIdCache[uuid]) {
    return uuidToAppIdCache[uuid];
  }
  // UUID not found in cache - return as-is (might be a pending user UUID)
  return uuid;
}

/**
 * Convert an array of Supabase UUIDs to app user IDs
 */
function convertUuidsToAppUserIds(uuids: string[]): string[] {
  return uuids.map(uuid => getAppUserIdFromUuid(uuid));
}

/**
 * Convert Supabase snake_case to camelCase
 * 
 * For users:
 * - Active users (with clerk_id): uses clerk_id as the app's user id
 * - Pending users (no clerk_id): keeps Supabase UUID as the id
 */
function convertSupabaseData(data: any[], collection?: string): DataItem[] {
  return data.map(item => {
    const converted: any = {};
    for (const key in item) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      converted[camelKey] = item[key];
    }
    
    // For users with clerk_id, use it as the app's user id
    // For pending users (no clerk_id), keep the Supabase UUID
    if (collection === 'users') {
      if (item.clerk_id) {
        // Active user - use clerk_id as app id
        userIdCache[item.clerk_id] = item.id;
        uuidToAppIdCache[item.id] = item.clerk_id; // Reverse mapping
        console.log(`📝 Cached mapping: clerk_id ${item.clerk_id} <-> UUID ${item.id}`);
        converted.id = item.clerk_id;
      } else {
        // Pending user - keep Supabase UUID as id
        // Also cache it to itself so lookups work
        userIdCache[item.id] = item.id;
        uuidToAppIdCache[item.id] = item.id; // Maps to itself
        console.log(`📝 Pending user: keeping UUID ${item.id} as id`);
      }
    }
    
    // For meals: convert for_user_ids from Supabase UUIDs back to app user IDs
    if (collection === 'meals' && Array.isArray(item.for_user_ids)) {
      converted.forUserIds = convertUuidsToAppUserIds(item.for_user_ids);
    }
    
    // For todo_items: convert assignee_id from Supabase UUID to app user ID
    if (collection === 'todo_items' && item.assignee_id) {
      converted.assigneeId = getAppUserIdFromUuid(item.assignee_id);
    }
    
    // For expenses: ensure receiptUrl is properly set from receipt_url
    // The snake_case to camelCase conversion already handles receipt_url -> receiptUrl,
    // but we explicitly ensure it's set correctly
    if (collection === 'expenses') {
      if (item.receipt_url) {
        converted.receiptUrl = item.receipt_url;
      } else {
        // Explicitly set to undefined if not present (not null, to match TypeScript type)
        converted.receiptUrl = undefined;
      }
    }
    
    return converted;
  });
}

/**
 * Convert camelCase to snake_case
 * Why: Reverse of above for writing to database
 */
function convertToSnakeCase(obj: any): any {
  const converted: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    converted[snakeKey] = obj[key];
  }
  return converted;
}