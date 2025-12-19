// Detailed JWT Test - Run in browser console while logged in
console.log('🔍 Detailed JWT Test Starting...');

// Step 1: Check if Clerk is loaded
if (typeof window.Clerk === 'undefined') {
  console.error('❌ STEP 1 FAILED: Clerk not loaded on window');
  return;
}
console.log('✅ STEP 1: Clerk loaded');

// Step 2: Check if user is signed in
const user = window.Clerk.user;
if (!user) {
  console.error('❌ STEP 2 FAILED: No user signed in');
  return;
}
console.log('✅ STEP 2: User signed in, ID:', user.id);

// Step 3: Check if session exists
const session = window.Clerk.session;
if (!session) {
  console.error('❌ STEP 3 FAILED: No session available');
  return;
}
console.log('✅ STEP 3: Session available');

// Step 4: Try to get JWT token
console.log('🔄 STEP 4: Attempting to get JWT token...');

session.getToken({ template: 'supabase' })
  .then(token => {
    console.log('📋 STEP 4 RESULT: Token retrieval completed');

    if (!token) {
      console.error('❌ STEP 4 FAILED: getToken() returned null/undefined');

      // Try without template to see if basic token works
      console.log('🔄 Trying basic token (no template)...');
      return session.getToken().then(basicToken => {
        if (basicToken) {
          console.log('✅ Basic token works, but supabase template failed');
          const payload = JSON.parse(atob(basicToken.split('.')[1]));
          console.log('🔍 Basic token payload:', payload);
          console.log('❌ ISSUE: supabase JWT template not configured or broken');
        } else {
          console.error('❌ EVEN basic token failed - major auth issue');
        }
      });
    }

    console.log('✅ STEP 4 SUCCESS: JWT token received');
    console.log('📏 Token length:', token.length);
    console.log('🔍 Token start:', token.substring(0, 50) + '...');

    // Step 5: Decode and analyze JWT
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('❌ STEP 5 FAILED: Invalid JWT format');
        return;
      }

      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));

      console.log('✅ STEP 5: JWT decoded successfully');
      console.log('🔍 Header:', header);
      console.log('🔍 Payload:', payload);

      // Check for clerk_id claim
      if (payload.clerk_id) {
        console.log('✅ clerk_id claim found:', payload.clerk_id);
      } else {
        console.error('❌ MISSING: clerk_id claim not in JWT payload');
        console.log('📋 Available claims:', Object.keys(payload));
      }

      // Check expiration
      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const now = new Date();
        if (expDate < now) {
          console.error('❌ EXPIRED: JWT expired at', expDate);
        } else {
          console.log('✅ VALID: JWT expires at', expDate);
        }
      }

    } catch (decodeError) {
      console.error('❌ STEP 5 FAILED: Could not decode JWT:', decodeError);
    }
  })
  .catch(error => {
    console.error('❌ STEP 4 FAILED: getToken() threw error:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
  });




