// JWT Console Test - Run in browser while logged in
// This will check what JWT Clerk is generating

console.log('🔍 JWT Console Test Starting...');

// Check if Clerk is available
if (typeof window.Clerk === 'undefined') {
  console.error('❌ Clerk not loaded');
  return;
}

// Get the current session
const session = window.Clerk.session;
if (!session) {
  console.error('❌ No Clerk session');
  return;
}

console.log('✅ Clerk session found');

// Try to get JWT with supabase template
session.getToken({ template: 'supabase' }).then(token => {
  if (!token) {
    console.error('❌ No JWT token from Clerk template "supabase"');
    return;
  }

  console.log('✅ JWT token received, length:', token.length);
  console.log('🔍 First 50 chars:', token.substring(0, 50) + '...');

  // Decode the JWT payload
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('🔍 Decoded JWT payload:', payload);

    if (payload.clerk_id) {
      console.log('✅ clerk_id claim found:', payload.clerk_id);
    } else {
      console.error('❌ MISSING clerk_id claim in JWT!');
      console.log('Available claims:', Object.keys(payload));
    }

    // Check expiration
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    if (exp && exp < now) {
      console.error('❌ JWT is EXPIRED!');
    } else {
      console.log('✅ JWT is valid (not expired)');
    }

  } catch (e) {
    console.error('❌ Failed to decode JWT:', e);
  }
}).catch(error => {
  console.error('❌ Failed to get JWT token:', error);
});



