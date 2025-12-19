// Debug JWT Console Test
// Run this in browser console when signed in to your app

console.log('🔍 JWT Debug Test Starting...');

// Check if Clerk is loaded
if (typeof window.Clerk === 'undefined') {
  console.error('❌ Clerk not loaded');
} else {
  console.log('✅ Clerk loaded');
}

// Check if user is signed in
window.Clerk.user.then(user => {
  if (user) {
    console.log('✅ User signed in:', user.id);

    // Try to get JWT token
    window.Clerk.session.getToken({ template: 'supabase' }).then(token => {
      if (token) {
        console.log('✅ JWT token received:', token.substring(0, 50) + '...');
        console.log('📏 Token length:', token.length);

        // Decode and check claims
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔍 Decoded payload:', payload);
          console.log('👤 clerk_id claim:', payload.clerk_id || 'MISSING');
        } catch (e) {
          console.error('❌ Failed to decode token:', e);
        }
      } else {
        console.error('❌ No JWT token received from Clerk');
      }
    }).catch(error => {
      console.error('❌ JWT request failed:', error);
    });

  } else {
    console.error('❌ User not signed in');
  }
}).catch(error => {
  console.error('❌ Clerk user check failed:', error);
});

// Check if SupabaseProvider has initialized
setTimeout(() => {
  console.log('🔍 Checking SupabaseProvider status...');

  // Look for any SupabaseContext logs in recent console history
  // (This won't work directly, but we can check if authenticated client exists)

  if (typeof window !== 'undefined' && window.location) {
    console.log('🌐 Current URL:', window.location.href);
  }
}, 2000);




