import { supabase } from './supabase';
import { getAuthenticatedSupabaseClient, refreshSupabaseToken } from '../contexts/SupabaseContext';
import { User, ShoppingItem, Task, Meal, Expense, Section, ToDoItem } from '../types';

/**
 * Get the best available Supabase client.
 * Prefers authenticated client (with JWT for RLS), falls back to default.
 */
function getSupabaseClient() {
  const authClient = getAuthenticatedSupabaseClient();
  if (authClient) {
    return authClient;
  }
  console.warn('[supabaseService] No authenticated client available, using default (may fail RLS)');
  return supabase;
}

// Type for generic data items
type DataItem = User | ShoppingItem | Task | Meal | Expense | Section | ToDoItem;

// CRITICAL: Map your app's collection names to Supabase table names
// NOTE: 'shopping' and 'tasks' tables are OBSOLETE - replaced by unified 'todo_items' table
const COLLECTION_MAP: Record<string, string> = {
  'users': 'users',
  'todo_items': 'todo_items',
  'meals': 'meals',
  'expenses': 'expenses',
  'sections': 'sections',
  'places': 'places',
  'practices': 'practices',
};

// Cache to store clerk_id -> supabase uuid mapping
// This cache is populated when users are loaded via subscribeToCollection
const userIdCache: Record<string, string> = {};

// UUID validation helper
const isValidUuidFormat = (id: string): boolean => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Clerk ID detection helper  
const isClerkIdFormat = (id: string): boolean => id.startsWith('user_');

/**
 * Get the Supabase UUID for a user ID (which may be a Clerk ID or already a UUID)
 * Uses the cached mapping from when users were loaded.
 * 
 * IMPORTANT: This cache is populated by convertSupabaseData when users are loaded.
 * If called before users are loaded, it may return the input unchanged.
 * 
 * @param userId - Either a Clerk ID (user_xxx) or Supabase UUID
 * @returns The Supabase UUID if found in cache, otherwise the input unchanged
 */
export function getCachedSupabaseUuid(userId: string): string {
  // Check if we have a cached mapping (clerk_id -> uuid)
  if (userIdCache[userId]) {
    return userIdCache[userId];
  }
  
  // If it's already a valid UUID format, return it
  if (isValidUuidFormat(userId)) {
    return userId;
  }
  
  // If it's a Clerk ID but not in cache, we can't resolve it yet
  // This might happen if called before users are loaded
  if (isClerkIdFormat(userId)) {
    console.warn(`[Cache] Clerk ID not in cache (users may not be loaded yet): ${userId}`);
  }
  
  // Return as-is (caller should handle the case where it's not a valid UUID)
  return userId;
}

/**
 * Check if the user ID cache has been populated (users have been loaded)
 */
export function isUserCachePopulated(): boolean {
  return Object.keys(userIdCache).length > 0;
}

/**
 * Get cache statistics for debugging
 */
export function getUserCacheStats(): { size: number; hasClerkIds: boolean } {
  const keys = Object.keys(userIdCache);
  return {
    size: keys.length,
    hasClerkIds: keys.some(k => isClerkIdFormat(k))
  };
}

// ─────────────────────────────────────────────────────────────────
// Real-time Subscription Status Tracking
// ─────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'SUBSCRIBING';

// Track status of each subscription channel
const subscriptionStatuses: Record<string, SubscriptionStatus> = {};

// Listeners for status changes
const statusListeners: Set<(statuses: Record<string, SubscriptionStatus>) => void> = new Set();

/**
 * Get the overall connection status based on all subscriptions
 * Returns 'connected' if ANY subscription is connected (we have at least one working channel)
 * Returns 'disconnected' if ALL subscriptions are disconnected
 * Returns 'connecting' if we're still setting up
 */
export function getOverallConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
  const statuses = Object.values(subscriptionStatuses);
  
  if (statuses.length === 0) {
    return 'connecting';
  }
  
  // If any subscription is connected, we're connected
  if (statuses.some(s => s === 'SUBSCRIBED')) {
    return 'connected';
  }
  
  // If any is still subscribing, we're connecting
  if (statuses.some(s => s === 'SUBSCRIBING')) {
    return 'connecting';
  }
  
  // All are disconnected
  return 'disconnected';
}

/**
 * Subscribe to connection status changes
 * Returns unsubscribe function
 */
export function onConnectionStatusChange(
  callback: (status: 'connected' | 'disconnected' | 'connecting') => void
): () => void {
  const listener = () => {
    callback(getOverallConnectionStatus());
  };
  
  statusListeners.add(listener);
  
  // Immediately call with current status
  callback(getOverallConnectionStatus());
  
  return () => {
    statusListeners.delete(listener);
  };
}

// Internal: Update subscription status and notify listeners
function updateSubscriptionStatus(channelName: string, status: SubscriptionStatus) {
  const previousOverall = getOverallConnectionStatus();
  subscriptionStatuses[channelName] = status;
  const newOverall = getOverallConnectionStatus();
  
  // Only notify if overall status changed
  if (previousOverall !== newOverall) {
    console.log(`📡 [Connection] Overall status changed: ${previousOverall} → ${newOverall}`);
    statusListeners.forEach(listener => listener(subscriptionStatuses));
  }
}

// Internal: Remove subscription from tracking
function removeSubscriptionStatus(channelName: string) {
  delete subscriptionStatuses[channelName];
  statusListeners.forEach(listener => listener(subscriptionStatuses));
}

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
  
  // Build the select query - include JOINs for specific collections
  // - expenses: LEFT JOIN receipts to get image_url
  // - users: LEFT JOIN push_subscriptions to get hasPushSubscription status
  const selectQuery = collection === 'expenses' 
    ? '*, receipts!receipts_expense_id_fkey(image_url, image_path)'  // LEFT JOIN receipts with image path for URL recovery
    : collection === 'users'
    ? '*, push_subscriptions(id)'  // LEFT JOIN push_subscriptions to check if user has any
    : '*';
  
  // Helper function to fetch data - always get fresh client to pick up auth
  const fetchData = () => {
    const client = getSupabaseClient();
    return client
      .from(tableName)
      .select(selectQuery)
      .eq('household_id', householdId);
  };
  
  // Initial fetch with JWT expiration handling
  const performInitialFetch = async () => {
    const { data, error } = await fetchData();
    
    if (error) {
      // Check if error is JWT expired
      if (error.code === 'PGRST303' || error.message?.includes('JWT expired')) {
        console.warn(`⚠️ Initial fetch JWT expired for ${tableName}, refreshing token...`);
        try {
          await refreshSupabaseToken();
          
          // Retry with fresh client
          const refreshedClient = getSupabaseClient();
          const retryQuery = collection === 'expenses' 
            ? '*, receipts!receipts_expense_id_fkey(image_url, image_path)'
            : collection === 'users'
            ? '*, push_subscriptions(id)'
            : '*';
          
          const { data: retryData, error: retryError } = await refreshedClient
            .from(tableName)
            .select(retryQuery)
            .eq('household_id', householdId);
          
          if (retryError) {
            console.error(`❌ Retry failed for ${tableName}:`, retryError);
            // Fallback to simple select if JOIN fails
            if (collection === 'expenses') {
              console.log('📥 Falling back to simple expenses fetch without receipts JOIN');
              const { data: fallbackData } = await refreshedClient
                .from(tableName)
                .select('*')
                .eq('household_id', householdId);
              callback(convertSupabaseData(fallbackData || [], collection));
            }
            return;
          }
          
          console.log(`📥 Initial ${tableName} data (after refresh):`, retryData?.length, 'items');
          callback(convertSupabaseData(retryData || [], collection));
          return;
        } catch (refreshError) {
          console.error(`❌ Token refresh failed for ${tableName}:`, refreshError);
        }
      }
      
      console.error(`❌ Initial fetch error for ${tableName}:`, error);
      // Fallback to simple select if JOIN fails (e.g., no receipts/push_subscriptions table or FK not set)
      if (collection === 'expenses' || collection === 'users') {
        console.log(`📥 Falling back to simple ${tableName} fetch without JOIN`);
        getSupabaseClient()
          .from(tableName)
          .select('*')
          .eq('household_id', householdId)
          .then(({ data: fallbackData }) => {
            callback(convertSupabaseData(fallbackData || [], collection));
          });
      }
      return;
    }
    
    console.log(`📥 Initial ${tableName} data:`, data?.length, 'items');
    callback(convertSupabaseData(data || [], collection));
  };
  
  performInitialFetch();

    // Set up real-time subscription
  const subscription = getSupabaseClient()
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
      fetchData()
        .then(({ data, error }) => {
          if (error && (collection === 'expenses' || collection === 'users')) {
            // Fallback for expenses/users if JOIN fails
            getSupabaseClient()
              .from(tableName)
              .select('*')
              .eq('household_id', householdId)
              .then(({ data: fallbackData }) => {
                console.log(`📥 Refetched ${fallbackData?.length || 0} items after ${payload.eventType} (fallback)`);
                callback(convertSupabaseData(fallbackData || [], collection));
              });
            return;
          }
          console.log(`📥 Refetched ${data?.length || 0} items after ${payload.eventType}`);
          callback(convertSupabaseData(data || [], collection));
        });
    }
  )
  .subscribe((status) => {
    console.log(`📡 Subscription status for ${tableName}:`, status);
    // Track this subscription's status
    updateSubscriptionStatus(`${tableName}-${householdId}`, status as SubscriptionStatus);
  });
  
  // Mark as subscribing initially
  updateSubscriptionStatus(`${tableName}-${householdId}`, 'SUBSCRIBING');

  // For expenses, also subscribe to receipts table changes
  // This ensures receiptUrl updates when a receipt is linked/unlinked
  let receiptsSubscription: ReturnType<typeof supabase.channel> | null = null;
  if (collection === 'expenses') {
    receiptsSubscription = supabase
      .channel(`receipts-for-expenses-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'receipts',
          filter: `household_id=eq.${householdId}`
        },
        (payload: any) => {
          console.log(`🔄 Real-time ${payload.eventType} on receipts (for expenses)`);
          // Refetch expenses when receipts change
          fetchData()
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Failed to refetch expenses after receipt change:', error);
                return;
              }
              console.log(`📥 Refetched ${data?.length || 0} expenses after receipt ${payload.eventType}`);
              callback(convertSupabaseData(data || [], collection));
            });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Receipts subscription status (for expenses):`, status);
        updateSubscriptionStatus(`receipts-for-expenses-${householdId}`, status as SubscriptionStatus);
      });
    
    updateSubscriptionStatus(`receipts-for-expenses-${householdId}`, 'SUBSCRIBING');
  }

  // For users, also subscribe to push_subscriptions table changes
  // This ensures hasPushSubscription updates when notifications are toggled
  let pushSubscriptionsSubscription: ReturnType<typeof supabase.channel> | null = null;
  if (collection === 'users') {
    pushSubscriptionsSubscription = supabase
      .channel(`push-subs-for-users-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'push_subscriptions',
          filter: `household_id=eq.${householdId}`
        },
        (payload: any) => {
          console.log(`🔄 Real-time ${payload.eventType} on push_subscriptions (for users)`);
          // Refetch users when push_subscriptions change
          fetchData()
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Failed to refetch users after push_subscriptions change:', error);
                // Fallback to simple fetch
                getSupabaseClient()
                  .from(tableName)
                  .select('*')
                  .eq('household_id', householdId)
                  .then(({ data: fallbackData }) => {
                    callback(convertSupabaseData(fallbackData || [], collection));
                  });
                return;
              }
              console.log(`📥 Refetched ${data?.length || 0} users after push_subscriptions ${payload.eventType}`);
              callback(convertSupabaseData(data || [], collection));
            });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Push subscriptions subscription status (for users):`, status);
        updateSubscriptionStatus(`push-subs-for-users-${householdId}`, status as SubscriptionStatus);
      });
    
    updateSubscriptionStatus(`push-subs-for-users-${householdId}`, 'SUBSCRIBING');
  }

  // Return unsubscribe function
  return () => {
    console.log(`🔕 Unsubscribing from ${tableName}`);
    subscription.unsubscribe();
    removeSubscriptionStatus(`${tableName}-${householdId}`);
    if (receiptsSubscription) {
      console.log('🔕 Unsubscribing from receipts (for expenses)');
      receiptsSubscription.unsubscribe();
      removeSubscriptionStatus(`receipts-for-expenses-${householdId}`);
    }
    if (pushSubscriptionsSubscription) {
      console.log('🔕 Unsubscribing from push_subscriptions (for users)');
      pushSubscriptionsSubscription.unsubscribe();
      removeSubscriptionStatus(`push-subs-for-users-${householdId}`);
    }
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

  // For users, treat missing/blank email as null to avoid unique conflicts
  if (collection === 'users') {
    if (finalData.email === '' || finalData.email === undefined) {
      finalData.email = null;
    }
  }
  
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
  
  // For todo_items: convert assignee_id and created_by IN PARALLEL for better performance
  // Both conversions are independent, so we can await them together
  if (collection === 'todo_items') {
    console.log('🔍 [DEBUG] todo_items created_by before conversion:', {
      created_by: finalData.created_by,
      has_created_by: 'created_by' in finalData,
      all_keys: Object.keys(finalData)
    });
    
    const [assigneeUuid, createdByUuid] = await Promise.all([
      finalData.assignee_id ? getSupabaseUserId(finalData.assignee_id, householdId) : Promise.resolve(null),
      finalData.created_by ? getSupabaseUserId(finalData.created_by, householdId) : Promise.resolve(null),
    ]);
    
    // Apply assignee_id conversion
    if (assigneeUuid) {
      console.log(`🔄 Converting assignee_id ${finalData.assignee_id} to UUID ${assigneeUuid}`);
      finalData.assignee_id = assigneeUuid;
    }
    
    // Apply created_by conversion with validation
    if (createdByUuid) {
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdByUuid);
      if (isValidUuid) {
        console.log(`🔄 Converting created_by ${finalData.created_by} to UUID ${createdByUuid}`);
        finalData.created_by = createdByUuid;
      } else {
        console.warn(`⚠️ getSupabaseUserId returned invalid UUID for created_by: ${createdByUuid} - setting to null`);
        finalData.created_by = null;
      }
    } else if (finalData.created_by) {
      console.warn(`⚠️ Could not resolve created_by ID: ${finalData.created_by} - setting to null`);
      finalData.created_by = null;
    }
  }
  
  // For meals and expenses: convert created_by from Clerk ID to Supabase UUID
  // IMPORTANT: The edge function for notifications needs created_by to be a valid UUID
  if (finalData.created_by && ['meals', 'expenses'].includes(collection)) {
    const originalCreatedBy = finalData.created_by;
    const uuid = await getSupabaseUserId(finalData.created_by, householdId);
    
    if (uuid) {
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
      if (isValidUuid) {
        console.log(`🔄 Converting created_by ${originalCreatedBy} to UUID ${uuid}`);
        finalData.created_by = uuid;
      } else {
        console.warn(`⚠️ getSupabaseUserId returned invalid UUID for created_by: ${uuid} - setting to null`);
        finalData.created_by = null;
      }
    } else {
      console.warn(`⚠️ Could not resolve created_by ID: ${originalCreatedBy} - setting to null`);
      finalData.created_by = null;
    }
  }

  // For expenses: handle currency, merchant_lang, merchant_translations, and receipt_url
  if (collection === 'expenses') {
    // Ensure currency has a default value (HKD for Hong Kong market)
    if (!finalData.currency || finalData.currency === '') {
      finalData.currency = 'HKD';
    }
    
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
    
    // Ensure line_items is a valid array (not undefined)
    if (finalData.line_items === undefined) {
      finalData.line_items = [];
    }
    
    // Debug: Log expense data being sent
    console.log('[DB Save] Expense data being sent:', {
      currency: finalData.currency,
      hasReceiptUrl: !!finalData.receipt_url,
      receiptUrl: finalData.receipt_url,
      receiptUrlType: typeof finalData.receipt_url,
      lineItemsCount: Array.isArray(finalData.line_items) ? finalData.line_items.length : 0,
      lineItems: finalData.line_items,
    });
  }

  console.log('🟡 Sending to Supabase:', finalData);
  
  // Use authenticated client for RLS
  const client = getSupabaseClient();
  
  const { data, error } = await client
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
  
  // For users: filter out fields that don't exist in the database
  // The users table doesn't have country_code column, so remove it
  if (collection === 'users') {
    // Remove country_code if it exists (column doesn't exist in database)
    if ('country_code' in snakeCaseUpdates) {
      console.log('⚠️ Removing country_code from update (column does not exist in database)');
      delete snakeCaseUpdates.country_code;
    }
    
    // Convert first_name + last_name to 'name' field (database only has 'name' column)
    if ('first_name' in snakeCaseUpdates || 'last_name' in snakeCaseUpdates) {
      const firstName = snakeCaseUpdates.first_name || '';
      const lastName = snakeCaseUpdates.last_name || '';
      const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
      if (combinedName) {
        snakeCaseUpdates.name = combinedName;
        console.log(`🔄 Combined first_name + last_name into name: "${combinedName}"`);
      }
      delete snakeCaseUpdates.first_name;
      delete snakeCaseUpdates.last_name;
    }
    
    // Only keep valid user fields that exist in the database
    // Note: phone_number column does NOT exist in the database - remove if present
    const validUserFields = [
      'name', 'email', 'role', 'avatar', 'allergies', 'preferences', 
      'status', 'expires_at', 'notifications_enabled',
      'helper_start_date', 'helper_base_salary', 'helper_food_allowance', 'helper_other_allowances'
    ];
    const filteredUpdates: Record<string, any> = {};
    for (const key of Object.keys(snakeCaseUpdates)) {
      if (validUserFields.includes(key)) {
        filteredUpdates[key] = snakeCaseUpdates[key];
      } else {
        console.log(`⚠️ Removing invalid field '${key}' from user update (column does not exist)`);
      }
    }
    Object.assign(snakeCaseUpdates, filteredUpdates);
    // Clear out any fields not in filteredUpdates
    for (const key of Object.keys(snakeCaseUpdates)) {
      if (!validUserFields.includes(key)) {
        delete snakeCaseUpdates[key];
      }
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
  
  // Use authenticated client for RLS
  const client = getSupabaseClient();
  
  const { error, data } = await client
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
  
  // Use authenticated client for RLS
  const client = getSupabaseClient();
  
  const { error, count } = await client
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
 * Now supports translation: detects language and saves translation fields
 * 
 * @param householdId - The household ID
 * @param notes - The notes content
 * @param currentLang - Optional current language for detection
 * @param updatedByUserId - Optional user ID who made the update (for notifications)
 */
export async function saveFamilyNotes(
  householdId: string,
  notes: string,
  currentLang?: string,
  updatedByUserId?: string
): Promise<void> {
  // Import language detection
  const { detectInputLanguage } = await import('./languageDetectionService');
  
  // Detect language if notes exist
  const notesLang = notes && notes.trim() ? detectInputLanguage(currentLang || 'en') : null;
  
  // Prepare update data
  const updateData: any = { family_notes: notes };
  
  // Only update language fields if notes changed (detect language)
  if (notes && notes.trim()) {
    updateData.family_notes_lang = notesLang;
    // Reset translations when notes change (will be regenerated on display)
    updateData.family_notes_translations = {};
  } else {
    // If notes are empty, clear language fields
    updateData.family_notes_lang = null;
    updateData.family_notes_translations = {};
  }
  
  // Track who updated the notes for notifications
  if (updatedByUserId) {
    // Convert user ID to Supabase UUID if needed (could be Clerk ID)
    const supabaseUuid = await getSupabaseUserId(updatedByUserId, householdId);
    if (supabaseUuid) {
      updateData.family_notes_updated_by = supabaseUuid;
    }
  }
  
  // Use authenticated client for RLS
  const client = getSupabaseClient();
  
  const { error } = await client
    .from('households')
    .update(updateData)
    .eq('id', householdId);

  if (error) throw error;
}

/**
 * Subscribe to family notes changes
 * Why: Real-time updates when anyone edits the family board
 * Now returns full notes data including translation fields
 */
export function subscribeToNotes(
  householdId: string,
  callback: (notesData: { 
    notes: string; 
    notesLang?: string | null; 
    notesTranslations?: Record<string, string> 
  }) => void
): () => void {
  // Initial fetch
  getSupabaseClient()
    .from('households')
    .select('family_notes, family_notes_lang, family_notes_translations')
    .eq('id', householdId)
    .single()
    .then(({ data }) => {
      if (data) {
        callback({
          notes: data.family_notes || '',
          notesLang: data.family_notes_lang || null,
          notesTranslations: data.family_notes_translations || {}
        });
      }
    });

  // Subscribe to changes
  const subscription = getSupabaseClient()
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
        callback({
          notes: payload.new.family_notes || '',
          notesLang: payload.new.family_notes_lang || null,
          notesTranslations: payload.new.family_notes_translations || {}
        });
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
function getReceiptPublicUrl(imagePath?: string): string | undefined {
  if (!imagePath) return undefined;
  const { data } = supabase.storage.from('receipts').getPublicUrl(imagePath);
  return data?.publicUrl || undefined;
}

function resolveReceiptUrl(receipt: any): string | undefined {
  if (!receipt) return undefined;
  // Prefer stored image_url (may already be public/signed), fall back to public URL from path
  return receipt.image_url || getReceiptPublicUrl(receipt.image_path);
}

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
      
      // Check if user has any push subscriptions (from LEFT JOIN)
      // push_subscriptions will be an array if JOIN succeeded, null/undefined otherwise
      if (item.push_subscriptions) {
        const subscriptions = Array.isArray(item.push_subscriptions) 
          ? item.push_subscriptions 
          : [item.push_subscriptions];
        // Filter out null entries (LEFT JOIN returns nulls for no matches)
        const validSubscriptions = subscriptions.filter((s: any) => s && s.id);
        converted.hasPushSubscription = validSubscriptions.length > 0;
      } else {
        converted.hasPushSubscription = false;
      }
      // Remove the joined push_subscriptions data from output
      delete converted.pushSubscriptions;
    }
    
    // For meals: convert for_user_ids from Supabase UUIDs back to app user IDs
    if (collection === 'meals' && Array.isArray(item.for_user_ids)) {
      converted.forUserIds = convertUuidsToAppUserIds(item.for_user_ids);
    }
    
    // For todo_items: convert assignee_id and created_by from Supabase UUID to app user ID
    if (collection === 'todo_items') {
      if (item.assignee_id) {
        converted.assigneeId = getAppUserIdFromUuid(item.assignee_id);
      }
      if (item.created_by) {
        converted.createdBy = getAppUserIdFromUuid(item.created_by);
      }
    }
    
    // For expenses: ensure receiptUrl is properly set and normalize date
    // Priority: 1. Joined receipts data (receipts.image_url), 2. expenses.receipt_url
    if (collection === 'expenses') {
      // Check for joined receipts data first (from LEFT JOIN)
      // The joined data comes as an array: item.receipts = [{image_url: '...'}] or null
      let receiptImageUrl: string | undefined = undefined;
      
      if (item.receipts) {
        // receipts can be an array (multiple receipts) or an object (single receipt)
        if (Array.isArray(item.receipts) && item.receipts.length > 0) {
          receiptImageUrl = resolveReceiptUrl(item.receipts[0]);
        } else if (!Array.isArray(item.receipts)) {
          receiptImageUrl = resolveReceiptUrl(item.receipts);
        }
      }
      
      // Set receiptUrl from joined data or fallback to receipt_url column
      if (receiptImageUrl) {
        converted.receiptUrl = receiptImageUrl;
      } else if (item.receipt_url) {
        converted.receiptUrl = item.receipt_url;
      } else {
        // Explicitly set to undefined if not present (not null, to match TypeScript type)
        converted.receiptUrl = undefined;
      }
      
      // Remove the joined receipts data from converted object (not needed in final output)
      delete converted.receipts;
      
      // Normalize date to YYYY-MM-DD format if it exists
      if (converted.date && typeof converted.date === 'string') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(converted.date)) {
          try {
            const parsed = new Date(converted.date);
            if (!isNaN(parsed.getTime())) {
              converted.date = parsed.toISOString().split('T')[0];
            }
          } catch {
            // If parsing fails, keep original date (will be caught by filter validation)
          }
        }
      }
      
      // Convert created_by from Supabase UUID to app user ID (Clerk ID for active users)
      // This ensures Helpers can filter expenses by their own createdBy field
      if (item.created_by) {
        converted.createdBy = getAppUserIdFromUuid(item.created_by);
      }
    }
    
    // For meals: convert created_by from Supabase UUID to app user ID
    if (collection === 'meals' && item.created_by) {
      converted.createdBy = getAppUserIdFromUuid(item.created_by);
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

/**
 * Upload avatar image to Supabase Storage
 * Why: User profile photos need persistent storage
 */
export async function uploadAvatarImage(
  householdId: string,
  userId: string,
  file: File
): Promise<string> {
  // Generate unique filename
  const timestamp = Date.now();
  const extension = file.name.split('.').pop() || 'jpg';
  const filename = `${userId}_${timestamp}.${extension}`;
  const filePath = `${householdId}/${filename}`;

  console.log(`📷 Uploading avatar for user ${userId} to path: ${filePath}`);

  // Upload to Supabase Storage (using 'avatars' bucket)
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: true, // Allow overwriting existing avatar
    });

  if (error) {
    console.error('❌ Avatar upload failed:', error);
    throw new Error(`Failed to upload avatar: ${error.message}`);
  }

  // Get public URL
  const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = publicData?.publicUrl;

  if (!publicUrl) {
    throw new Error('Failed to get avatar public URL');
  }

  console.log(`✅ Avatar uploaded successfully: ${publicUrl}`);
  return publicUrl;
}

/**
 * One-time fetch of a collection (for periodic sync backup)
 * Why: Backup mechanism in case real-time subscription misses updates
 */
export async function fetchCollection(
  householdId: string,
  collection: string
): Promise<DataItem[]> {
  const tableName = COLLECTION_MAP[collection];
  
  if (!tableName) {
    console.error(`❌ Unknown collection: ${collection}`);
    return [];
  }
  
  console.log(`🔄 [Sync] Fetching ${tableName} for household ${householdId}`);
  
  // Use authenticated client for RLS
  const client = getSupabaseClient();
  
  // Build the select query - include JOINs for specific collections
  const selectQuery = collection === 'expenses' 
    ? '*, receipts!receipts_expense_id_fkey(image_url, image_path)'
    : collection === 'users'
    ? '*, push_subscriptions(id)'
    : '*';
  
  const { data, error } = await client
    .from(tableName)
    .select(selectQuery)
    .eq('household_id', householdId);

  if (error) {
    console.error(`❌ [Sync] Fetch error for ${tableName}:`, error);
    
    // Check if error is JWT expired
    if (error.code === 'PGRST303' || error.message?.includes('JWT expired')) {
      console.warn(`⚠️ [Sync] JWT expired for ${tableName}, refreshing token and retrying...`);
      try {
        // Refresh token
        await refreshSupabaseToken();
        
        // Get fresh client and retry
        const refreshedClient = getSupabaseClient();
        const { data: retryData, error: retryError } = await refreshedClient
          .from(tableName)
          .select(selectQuery)
          .eq('household_id', householdId);
        
        if (retryError) {
          console.error(`❌ [Sync] Retry failed for ${tableName}:`, retryError);
          // Fallback for expenses/users if JOIN fails
          if (collection === 'expenses' || collection === 'users') {
            const { data: fallbackData } = await refreshedClient
              .from(tableName)
              .select('*')
              .eq('household_id', householdId);
            return convertSupabaseData(fallbackData || [], collection);
          }
          return [];
        }
        
        console.log(`✅ [Sync] Retry successful for ${tableName}, fetched ${retryData?.length || 0} items`);
        return convertSupabaseData(retryData || [], collection);
      } catch (refreshError) {
        console.error(`❌ [Sync] Token refresh failed for ${tableName}:`, refreshError);
        // Fallback for expenses/users if JOIN fails
        if (collection === 'expenses' || collection === 'users') {
          const { data: fallbackData } = await client
            .from(tableName)
            .select('*')
            .eq('household_id', householdId);
          return convertSupabaseData(fallbackData || [], collection);
        }
        return [];
      }
    }
    
    // Fallback for expenses/users if JOIN fails
    if (collection === 'expenses' || collection === 'users') {
      const { data: fallbackData } = await client
        .from(tableName)
        .select('*')
        .eq('household_id', householdId);
      return convertSupabaseData(fallbackData || [], collection);
    }
    return [];
  }
  
  console.log(`✅ [Sync] Fetched ${data?.length || 0} items from ${tableName}`);
  return convertSupabaseData(data || [], collection);
}