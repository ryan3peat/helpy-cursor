# Manual RLS Test - Copy & Paste into Console

If `window.helpyTestRLS()` is not available, copy and paste this entire code block into your browser console:

```javascript
(async () => {
  console.log('🧪 Manual RLS Test Starting...');
  
  try {
    // Import the function
    const { getAuthenticatedSupabaseClient } = await import('./contexts/SupabaseContext');
    const client = getAuthenticatedSupabaseClient();
    
    if (!client) {
      console.error('❌ No authenticated client available');
      console.log('💡 Make sure you are signed in and SupabaseContext has initialized');
      console.log('💡 Check console for [SupabaseContext] logs');
      return;
    }
    
    console.log('✅ Authenticated client found');
    
    // Test 1: Try to read households
    console.log('\n📋 Test 1: Reading households...');
    const { data: households, error: hError } = await client
      .from('households')
      .select('id, name, subscription_plan')
      .limit(1);
    
    if (hError) {
      console.error('❌ Household query failed:', hError);
      console.error('Error code:', hError.code);
      console.error('Error message:', hError.message);
      if (hError.code === 'PGRST116') {
        console.log('💡 PGRST116 = RLS returned 0 rows - user may not have access');
      }
    } else {
      console.log('✅ Household query succeeded:', households);
    }
    
    // Test 2: Try to read users
    console.log('\n👥 Test 2: Reading users...');
    const { data: users, error: uError } = await client
      .from('users')
      .select('id, clerk_id, email, household_id')
      .limit(5);
    
    if (uError) {
      console.error('❌ Users query failed:', uError);
      console.error('Error code:', uError.code);
      console.error('Error message:', uError.message);
    } else {
      console.log('✅ Users query succeeded:', users);
      console.log('Users found:', users?.length || 0);
      if (users && users.length > 0) {
        console.log('Your clerk_id:', users.find(u => u.clerk_id)?.clerk_id);
      }
    }
    
    // Test 3: Check specific household
    console.log('\n🏠 Test 3: Reading specific household...');
    const { data: household, error: shError } = await client
      .from('households')
      .select('id, name, subscription_plan')
      .eq('id', 'ecb34564-470c-41ea-a7ef-ed7446dd853d')
      .single();
    
    if (shError) {
      console.error('❌ Specific household query failed:', shError);
      console.error('Error code:', shError.code);
      console.error('Error message:', shError.message);
      if (shError.code === 'PGRST116') {
        console.log('💡 PGRST116 = RLS returned 0 rows');
        console.log('💡 This means:');
        console.log('   1. JWT is being sent (otherwise you\'d get 401)');
        console.log('   2. But RLS policy is blocking access');
        console.log('   3. Likely cause: User not in database or wrong household_id');
      }
    } else {
      console.log('✅ Specific household query succeeded:', household);
    }
    
    // Test 4: Check Network tab
    console.log('\n🌐 Test 4: Check Network Tab');
    console.log('1. Open Network tab in DevTools');
    console.log('2. Filter by: supabase.co');
    console.log('3. Click on any request');
    console.log('4. Go to Headers → Request Headers');
    console.log('5. Look for: Authorization: Bearer eyJ...');
    console.log('   If present: ✅ JWT is being sent');
    console.log('   If missing: ❌ JWT is NOT being sent');
    
    console.log('\n✅ RLS test complete!');
  } catch (error) {
    console.error('❌ Error running RLS test:', error);
  }
})();
```

## Quick Alternative Test

If the import doesn't work, try this simpler version:

```javascript
// Check if authenticated client exists
const checkClient = () => {
  // Try to access it via the global
  const client = window.__SUPABASE_CLIENT__ || null;
  console.log('Client available:', !!client);
  
  // Or check via useSupabase hook (won't work from console)
  console.log('Note: You need to run this from within React component');
};

checkClient();
```

## What to Look For

After running the test:

1. **If Test 1 (households) fails with PGRST116:**
   - RLS is blocking
   - User likely not in database or wrong household_id

2. **If Test 2 (users) succeeds but returns 0 users:**
   - RLS is working but user not found
   - Check if your clerk_id matches what's in database

3. **If Test 3 (specific household) fails:**
   - RLS policy is blocking access to that household
   - User's household_id doesn't match

4. **If all tests fail with 401/403:**
   - JWT not being sent
   - Check Network tab for Authorization header

