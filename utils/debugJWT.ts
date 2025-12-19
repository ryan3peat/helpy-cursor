/**
 * Debug utility to check JWT token and Clerk ID
 * Use this in browser console to debug admin access issues
 */

export function debugJWT() {
  console.log('=== JWT Debug Information ===');
  
  // Check if we can access the Supabase client
  try {
    const { getAuthenticatedSupabaseClient } = require('../contexts/SupabaseContext');
    const client = getAuthenticatedSupabaseClient();
    
    if (!client) {
      console.error('❌ No authenticated Supabase client available');
      return;
    }
    
    console.log('✅ Authenticated Supabase client found');
    
    // Try to get the current user from Supabase
    client.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.error('❌ Error getting user:', error);
      } else {
        console.log('✅ Supabase user:', data.user);
        console.log('   User ID:', data.user?.id);
        console.log('   User metadata:', data.user?.user_metadata);
      }
    });
    
    // Check Clerk user
    try {
      const { useUser } = require('@clerk/clerk-react');
      // This won't work directly, but we can check in the component
      console.log('ℹ️  To check Clerk user, use this in a React component:');
      console.log('   const { user } = useUser();');
      console.log('   console.log("Clerk user:", user);');
      console.log('   console.log("Clerk ID:", user?.id);');
    } catch (e) {
      console.log('ℹ️  Clerk hooks not available in this context');
    }
    
    // Test query to see what RLS returns
    console.log('\n=== Testing RLS Query ===');
    client
      .from('users')
      .select('id, name, email, role, clerk_id')
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ Error querying users:', error);
          console.error('   Error code:', error.code);
          console.error('   Error message:', error.message);
          console.error('   Error details:', error.details);
          console.error('   Error hint:', error.hint);
        } else {
          console.log('✅ Users query successful');
          console.log('   Found users:', data?.length || 0);
          data?.forEach((user: any) => {
            console.log(`   - ${user.name} (${user.email}): role=${user.role}, clerk_id=${user.clerk_id}`);
          });
        }
      });
    
    // Test support tickets query
    console.log('\n=== Testing Support Tickets Query ===');
    client
      .from('support_tickets')
      .select('*, users!support_tickets_user_id_fkey(name, email, role)')
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ Error querying support_tickets:', error);
          console.error('   Error code:', error.code);
          console.error('   Error message:', error.message);
          console.error('   Error details:', error.details);
          console.error('   Error hint:', error.hint);
        } else {
          console.log('✅ Support tickets query successful');
          console.log('   Found tickets:', data?.length || 0);
          data?.forEach((ticket: any) => {
            console.log(`   - ${ticket.subject} (from: ${ticket.users?.name || 'unknown'})`);
          });
        }
      });
    
  } catch (error) {
    console.error('❌ Error in debug function:', error);
  }
  
  console.log('\n=== Manual Check ===');
  console.log('To manually check your JWT token:');
  console.log('1. Open browser DevTools → Network tab');
  console.log('2. Look for requests to your Supabase URL');
  console.log('3. Check the Authorization header');
  console.log('4. Decode the JWT at https://jwt.io');
  console.log('5. Look for "clerk_id" in the payload');
}

// Also export a function to check the current user's role
export async function checkUserRole() {
  try {
    const { getAuthenticatedSupabaseClient } = require('../contexts/SupabaseContext');
    const client = getAuthenticatedSupabaseClient();
    
    if (!client) {
      console.error('❌ No authenticated Supabase client');
      return null;
    }
    
    // Get current user's clerk_id from JWT
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      console.error('❌ No Supabase user found');
      return null;
    }
    
    // Query users table to find matching user
    const { data: users, error } = await client
      .from('users')
      .select('id, name, email, role, clerk_id')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('❌ Error fetching user:', error);
      return null;
    }
    
    console.log('=== Current User Info ===');
    console.log('Supabase User ID:', user.id);
    console.log('User Name:', users?.name);
    console.log('User Email:', users?.email);
    console.log('User Role:', users?.role);
    console.log('Clerk ID:', users?.clerk_id);
    console.log('Is Admin?', users?.role === 'Admin');
    
    return users;
  } catch (error) {
    console.error('❌ Error checking user role:', error);
    return null;
  }
}
