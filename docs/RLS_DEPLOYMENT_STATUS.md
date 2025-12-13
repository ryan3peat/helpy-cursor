# RLS Deployment Status

## ✅ Completed Steps

1. **Clerk JWT Template** - Created with `clerk_id` claim
2. **Code Deployment** - SupabaseContext and SupabaseProvider deployed
3. **SQL Migration** - RLS policies applied successfully

## 🔍 Current Status

### What's Working

- ✅ RLS policies are active in Supabase
- ✅ Helper functions (`get_clerk_id()`, `get_user_household_id()`) created
- ✅ SupabaseProvider wraps the app
- ✅ Components using `useSupabase()` hook will have authenticated client

### What Needs Attention

Some components and services still use the old `supabase` import directly. These will **fail with 403 errors** because they don't send JWT tokens.

**Affected Files:**
- `components/Auth.tsx` - Uses `import { supabase } from '../services/supabase'`
- `components/Profile.tsx` - Uses `import { supabase } from '../services/supabase'`
- `components/Expenses.tsx` - Uses `import { supabase } from '../services/supabase'`
- `services/supabaseService.ts` - Uses `import { supabase } from './supabase'`
- `services/trainingService.ts` - Uses `import { supabase } from './supabase'`

## 🧪 Immediate Testing

### Test 1: Check if App Loads

1. Open your app
2. Sign in
3. Check browser console for errors

**Expected:**
- If components use old `supabase` import → 403 errors
- If components use `useSupabase()` → Should work

### Test 2: Verify JWT Token

1. Open DevTools → Network tab
2. Sign in
3. Look for Supabase requests
4. Check if `Authorization: Bearer ...` header exists

**If header exists:** JWT is being sent (good!)
**If header missing:** Components not using authenticated client

## 🔧 Next Steps

### Option 1: Quick Fix (If App is Broken)

If you're seeing 403 errors everywhere, you can temporarily make the old client work by updating `services/supabase.ts`:

```typescript
// Temporary: Make default client also try to get JWT token
// This is a workaround until all components are migrated
```

But this is not ideal - better to update components.

### Option 2: Update Components (Recommended)

Update components to use the authenticated client:

**Before:**
```typescript
import { supabase } from '../services/supabase';

// In component:
const { data } = await supabase.from('todo_items').select();
```

**After:**
```typescript
import { useSupabase } from '../contexts/SupabaseContext';

// In component:
const supabase = useSupabase();
const { data } = await supabase.from('todo_items').select();
```

### Option 3: Update Services (For Service Files)

Service files can't use hooks. Options:

1. **Pass client as parameter:**
```typescript
export async function addItem(
  householdId: string,
  collection: string,
  item: any,
  client?: SupabaseClient  // Optional authenticated client
) {
  const supabaseClient = client || supabase; // Use provided or default
  // ...
}
```

2. **Create a getter function:**
```typescript
// In services/supabase.ts
let authenticatedClient: SupabaseClient | null = null;

export function setAuthenticatedClient(client: SupabaseClient) {
  authenticatedClient = client;
}

export function getSupabaseClient(): SupabaseClient {
  return authenticatedClient || supabase;
}
```

## 📋 Priority Update Order

1. **Critical:** `components/Auth.tsx` - User creation/login
2. **High:** `services/supabaseService.ts` - Core data operations
3. **Medium:** `components/Profile.tsx` - User profile
4. **Medium:** `components/Expenses.tsx` - Expense management
5. **Low:** `services/trainingService.ts` - Training modules

## 🚨 If Everything is Broken

If the app is completely broken after deployment:

1. **Quick rollback:** Revert to permissive policies temporarily
2. **Fix components:** Update to use authenticated client
3. **Re-apply RLS:** Run migration again

**Rollback SQL:**
```sql
-- Temporarily restore permissive policies
-- (Copy from migration 004_fix_rls_for_clerk.sql)
```

## ✅ Success Criteria

You'll know RLS is working when:
- ✅ Users can access their own household data
- ✅ Users cannot access other households' data
- ✅ No 403 errors in browser console
- ✅ JWT token appears in request headers
- ✅ Supabase logs show no policy violations

## 📞 Need Help?

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs for policy violations
3. Verify JWT token is in request headers
4. Test with a simple query in browser console

