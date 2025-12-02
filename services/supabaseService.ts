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
  
  console.log(`🔔 Subscribing to ${collection} (table: ${tableName})`);
  
  // Initial fetch
  supabase
    .from(tableName)
    .select('*')
    .eq('household_id', householdId)
    .then(({ data, error }) => {
      if (error) {
        console.error(`❌ Error fetching ${collection}:`, error);
        return;
      }
      console.log(`✅ Initial ${collection} data:`, data);
      callback(convertSupabaseData(data || []));
    });

  // Subscribe to changes
  const channelName = `${tableName}-${householdId}`;
  console.log(`🔔 Creating channel: ${channelName}`);
  
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: tableName,
        filter: `household_id=eq.${householdId}`
      },
      (payload) => {
        console.log(`🔔 ${collection} changed:`, payload);
        
        // Refetch on any change
        supabase
          .from(tableName)
          .select('*')
          .eq('household_id', householdId)
          .then(({ data }) => {
            console.log(`🔔 Refetched ${collection}:`, data);
            if (data) callback(convertSupabaseData(data));
          });
      }
    )
    .subscribe((status) => {
      console.log(`🔔 ${collection} subscription status:`, status);
    });

  // Return unsubscribe function
  return () => {
    console.log(`🔔 Unsubscribing from ${collection}`);
    subscription.unsubscribe();
  };
}

/**
 * Add a new item to a collection
 * Why: Creates new records (e.g., add shopping item)
 */
export async function addItem(
  householdId: string,
  collection: string,
  item: Omit<DataItem, 'id'>  // ← Already excludes 'id' in type
): Promise<DataItem> {
  const tableName = COLLECTION_MAP[collection];
  
  console.log('🟡 Supabase addItem called');
  console.log('🟡 item:', item);
  
  // Remove id and addedBy if they exist
  const { id, addedBy, ...cleanItem } = item as any;
  
  const snakeCaseItem = convertToSnakeCase(cleanItem);
  console.log('🟡 Cleaned item:', snakeCaseItem);
  
  const finalData = { ...snakeCaseItem, household_id: householdId };
  console.log('🟡 Final data:', finalData);
  
  const { data, error } = await supabase
    .from(tableName)
    .insert([finalData])
    .select()
    .single();

  console.log('🟡 Response:', { data, error });

  if (error) {
    console.error('❌ Insert failed:', error);
    throw error;
  }
  
  return convertSupabaseData([data])[0];
}

/**
 * Update an existing item
 * Why: Modify records (e.g., mark task complete)
 */
export async function updateItem(
  householdId: string,
  collection: string,
  id: string,
  updates: Partial<DataItem>
): Promise<void> {
  const tableName = COLLECTION_MAP[collection];
  
  const { error } = await supabase
    .from(tableName)
    .update(convertToSnakeCase(updates))
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) throw error;
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
  
  const { error, count } = await supabase
    .from(tableName)
    .delete({ count: 'exact' }) // Get count of deleted rows
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('❌ Delete error:', error);
    throw error;
  }
  
  if (count === 0) {
    console.warn('⚠️ No rows deleted - item may not exist');
  } else {
    console.log('✅ Delete successful');
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
      avatar: `https://picsum.photos/200/200?random=${Date.now()}`,
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

  return userData ? convertSupabaseData([userData])[0] as User : null;
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

  return data ? convertSupabaseData([data])[0] as User : null;
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

  return data ? convertSupabaseData([data])[0] as User : null;
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
  return convertSupabaseData([userData])[0] as User;
}

// HELPER FUNCTIONS

/**
 * Convert Supabase snake_case to camelCase
 * Why: Your app uses camelCase (householdId), Supabase uses snake_case (household_id)
 */
function convertSupabaseData(data: any[]): DataItem[] {
  return data.map(item => {
    const converted: any = {};
    for (const key in item) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      converted[camelKey] = item[key];
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