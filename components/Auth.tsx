// components/Auth.tsx
import React, { useState } from 'react';
import { SignIn, useUser } from '@clerk/clerk-react';
import { useSupabase, useSupabaseReady, getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';
import { supabase as defaultSupabase } from '../services/supabase';
import { User } from '../types';
import SignUp from './SignUp';
import HouseholdSwitchModal from './HouseholdSwitchModal';

// Broom icon component for loading animation (matching flaticon clean_9755169)
const BroomIcon = ({ className }: { className?: string }) => (
  <img 
    src="https://cdn-icons-png.flaticon.com/512/9755/9755169.png" 
    alt="" 
    className={className}
    style={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
  />
);

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { user, isLoaded } = useUser();
  const supabaseFromContext = useSupabase(); // Authenticated client from context
  const isSupabaseReady = useSupabaseReady(); // Check if JWT is ready
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showHouseholdSwitch, setShowHouseholdSwitch] = useState(false);
  const [householdSwitchInfo, setHouseholdSwitchInfo] = useState<{
    currentHouseholdName: string;
    newHouseholdName: string;
    adminName: string | null;
    existingUserId: string;
    newHouseholdId: string;
    newUserId: string;
  } | null>(null);
  const hasCheckedUser = React.useRef(false);

  React.useEffect(() => {
    console.log('🔵 [Auth] useEffect triggered:', { 
      isLoaded, 
      user: !!user, 
      isCreatingUser, 
      hasCheckedUser: hasCheckedUser.current,
      isSupabaseReady 
    });
    // Also wait for Supabase client to be ready (JWT fetched)
    if (isLoaded && user && !isCreatingUser && !hasCheckedUser.current && isSupabaseReady) {
      console.log('✅ [Auth] Conditions met, calling checkOrCreateUser');
      hasCheckedUser.current = true;
      checkOrCreateUser(user);
    } else {
      console.log('⚠️ [Auth] Conditions not met:', {
        isLoaded,
        hasUser: !!user,
        isCreatingUser,
        hasCheckedUser: hasCheckedUser.current,
        isSupabaseReady
      });
    }
  }, [isLoaded, user, isCreatingUser, isSupabaseReady]);

  const checkOrCreateUser = async (clerkUser: any) => {
    setIsCreatingUser(true);
    
    // Get email once at the start to avoid duplicate declarations
    const clerkEmail = clerkUser.primaryEmailAddress?.emailAddress;
    
    // Get the authenticated client - prefer global reference which is always up-to-date
    // The useEffect already waits for isSupabaseReady, but we double-check here
    let clientToUse = getAuthenticatedSupabaseClient();
    
    // If no authenticated client yet, wait a bit and retry (shouldn't happen due to useEffect check)
    if (!clientToUse) {
      console.log('[Auth] Waiting for authenticated Supabase client...');
      await new Promise(resolve => setTimeout(resolve, 500));
      clientToUse = getAuthenticatedSupabaseClient();
    }
    
    // Final fallback to context value or default (shouldn't be needed)
    if (!clientToUse) {
      console.warn('[Auth] ⚠️ Using context supabase client (JWT may not be ready)');
      clientToUse = supabaseFromContext || defaultSupabase;
    }
    
    // Log client status for debugging
    console.log('[Auth] Supabase client status:', {
      hasClient: !!clientToUse,
      clientType: clientToUse === defaultSupabase ? 'Default (no JWT)' : 'Authenticated (with JWT)'
    });
    
    if (!clientToUse) {
      console.error('[Auth] ❌ Supabase client is NULL - this should not happen!');
      console.error('[Auth] SupabaseProvider might not be initialized');
      setIsCreatingUser(false);
      return;
    }
    
    try {
      console.log('🔍 [Auth] checkOrCreateUser started for Clerk user:', clerkUser.id);
      console.log('🔍 [Auth] Clerk email:', clerkEmail);
      console.log('🔍 [Auth] Full URL:', window.location.href);
      console.log('🔍 [Auth] Search params:', window.location.search);
      console.log('🔍 [Auth] Hash:', window.location.hash);
      
      // ============================================================
      // STEP 1: PRIORITY - Check URL for invite parameters FIRST
      // This must run before checking for existing users or creating new households
      // ============================================================
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      
      // Also check the full URL as fallback (Clerk might put params in different places)
      const fullUrl = window.location.href;
      const urlMatch = fullUrl.match(/[?&]invite=true[&]?/);
      const hidMatch = fullUrl.match(/[?&]hid=([^&]+)/);
      const uidMatch = fullUrl.match(/[?&]uid=([^&]+)/);
      
      // Check both query params and hash params (Clerk uses hash routing)
      const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true' || urlMatch !== null;
      const hid = urlParams.get('hid') || hashParams.get('hid') || (hidMatch ? decodeURIComponent(hidMatch[1]) : null);
      const uid = urlParams.get('uid') || hashParams.get('uid') || (uidMatch ? decodeURIComponent(uidMatch[1]) : null);
      
      console.log('🔍 [Auth] Invite params check:', { isInvite, hid, uid });
      console.log('🔍 [Auth] URL params:', { urlParams: Object.fromEntries(urlParams), hashParams: Object.fromEntries(hashParams) });

      if (isInvite && hid && uid) {
        console.log('🔗 Invite URL detected (PRIORITY):', { hid, uid });

        // Use API endpoint to accept invite (bypasses RLS issues with new users)
        try {
          const apiUrl = import.meta.env?.VITE_API_URL || '';
          const response = await fetch(`${apiUrl}/api/accept-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pendingUserId: uid,
              householdId: hid,
              clerkId: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress,
              name: clerkUser.fullName || clerkUser.firstName,
              avatar: clerkUser.imageUrl,
            }),
          });

          const result = await response.json();
          console.log('🔗 [Auth] Accept invite API response:', result);

          if (response.ok && result.success && result.user) {
            const activatedUser = result.user;
            console.log('✅ [Auth] Invited user activated via API:', activatedUser);
            
            // Clear the invite params from URL
            window.history.replaceState({}, '', window.location.pathname);
            
            // Call onLogin and then reset state
            onLogin({
              id: activatedUser.clerk_id || activatedUser.id,
              householdId: activatedUser.household_id,
              email: activatedUser.email,
              name: activatedUser.name,
              role: activatedUser.role,
              avatar: activatedUser.avatar,
              allergies: activatedUser.allergies || [],
              preferences: activatedUser.preferences || [],
              status: 'active',
              notificationsEnabled: activatedUser.notifications_enabled ?? true,
              onboardingStatus: activatedUser.onboarding_status || 'not_started'
            });
            
            // Reset state after successful login
            setIsCreatingUser(false);
            console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
            return;
          } else if (result.expired) {
            console.log('⏰ Invitation expired');
            alert('This invitation has expired. Please ask for a new invite link.');
            window.history.replaceState({}, '', window.location.pathname);
          } else if (result.notFound) {
            console.log('⚠️ [Auth] Invitation not found, may already be activated');
            // Don't clear URL yet - continue to check if user exists by email
          } else {
            console.error('❌ [Auth] Failed to activate via API:', result.error);
          }
        } catch (error) {
          console.error('❌ [Auth] Accept invite API error:', error);
        }
        
        // Clear URL params if we didn't return above
        window.history.replaceState({}, '', window.location.pathname);
      }

      // ============================================================
      // STEP 2: Check if this user came from a Clerk invitation (backwards compatibility)
      // ============================================================
      const metadata = clerkUser.publicMetadata as {
        supabaseUserId?: string;
        householdId?: string;
        role?: string;
      } | undefined;

      if (metadata?.supabaseUserId && metadata?.householdId) {
        console.log('📨 User came from Clerk invitation, activating pending user...');
        console.log('📨 Metadata:', metadata);

        const { data: activatedUser, error: activateError } = await clientToUse
          .from('users')
          .update({ 
            status: 'active',
            clerk_id: clerkUser.id,
            invite_expires_at: null
          })
          .eq('id', metadata.supabaseUserId)
          .eq('household_id', metadata.householdId)
          .select()
          .single();

        if (activateError) {
          console.error('❌ Failed to activate invited user:', activateError);
        } else if (activatedUser) {
          console.log('✅ [Auth] Invited user activated via metadata:', activatedUser);
          console.log('✅ [Auth] Calling onLogin() with user');
          onLogin({
            id: activatedUser.clerk_id || activatedUser.id,
            householdId: activatedUser.household_id,
            email: activatedUser.email,
            name: activatedUser.name,
            role: activatedUser.role,
            avatar: activatedUser.avatar,
            allergies: activatedUser.allergies || [],
            preferences: activatedUser.preferences || [],
            status: 'active',
            notificationsEnabled: activatedUser.notifications_enabled ?? true,
            onboardingStatus: activatedUser.onboarding_status || 'not_started'
          });
          setIsCreatingUser(false);
          console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
          return;
        }
      }

      // ============================================================
      // STEP 2: Check if user already exists (regular login)
      // ============================================================
      const { data: existingUser, error: checkError } = await clientToUse
        .from('users')
        .select('*')
        .eq('clerk_id', clerkUser.id)
        .maybeSingle();

      console.log('📊 Existing user check:', existingUser);

      if (checkError) {
        console.error('❌ Check error:', checkError);
      }

      if (existingUser) {
        console.log('✅ [Auth] User exists, logging in:', existingUser);
        console.log('✅ [Auth] Calling onLogin() with existing user');
        onLogin({
          id: existingUser.clerk_id,
          householdId: existingUser.household_id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          avatar: existingUser.avatar,
          allergies: existingUser.allergies || [],
          preferences: existingUser.preferences || [],
          status: existingUser.status || 'active',
          notificationsEnabled: existingUser.notifications_enabled ?? true,
          onboardingStatus: existingUser.onboarding_status || 'completed'
        });
        setIsCreatingUser(false);
        console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
        return;
      }

      // ============================================================
      // STEP 2.5: Check if user exists by email (for returning users)
      // This handles cases where clerk_id doesn't match or wasn't set
      // ============================================================
      if (clerkEmail) {
        const { data: existingUserByEmail, error: emailCheckError } = await clientToUse
          .from('users')
          .select('*')
          .eq('email', clerkEmail)
          .eq('status', 'active')
          .maybeSingle();

        if (existingUserByEmail && !emailCheckError) {
          console.log('✅ [Auth] Found existing user by email, updating clerk_id and logging in:', existingUserByEmail);
          
          // Update clerk_id if it's missing or different
          if (!existingUserByEmail.clerk_id || existingUserByEmail.clerk_id !== clerkUser.id) {
            const { error: updateError } = await clientToUse
              .from('users')
              .update({ clerk_id: clerkUser.id })
              .eq('id', existingUserByEmail.id);
            
            if (updateError) {
              console.error('❌ Failed to update clerk_id:', updateError);
            } else {
              console.log('✅ Updated clerk_id for existing user');
            }
          }
          
          console.log('✅ [Auth] Calling onLogin() with existing user (found by email)');
          onLogin({
            id: clerkUser.id, // Use the current clerk_id
            householdId: existingUserByEmail.household_id,
            email: existingUserByEmail.email,
            name: existingUserByEmail.name,
            role: existingUserByEmail.role,
            avatar: existingUserByEmail.avatar,
            allergies: existingUserByEmail.allergies || [],
            preferences: existingUserByEmail.preferences || [],
            status: existingUserByEmail.status || 'active',
            notificationsEnabled: existingUserByEmail.notifications_enabled ?? true,
            onboardingStatus: existingUserByEmail.onboarding_status || 'completed'
          });
          setIsCreatingUser(false);
          console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
          return;
        }
      }

      // ============================================================
      // STEP 3: Check if there's a pending user with matching email
      // This handles cases where invitation metadata wasn't passed through
      // ============================================================
      if (clerkEmail) {
        const { data: pendingUser, error: pendingError } = await clientToUse
          .from('users')
          .select('*')
          .eq('email', clerkEmail)
          .eq('status', 'pending')
          .maybeSingle();

        if (pendingUser && !pendingError) {
          console.log('📨 Found pending user by email, activating...');
          
          // Check if invite hasn't expired
          const expiresAt = pendingUser.invite_expires_at;
          if (expiresAt && new Date(expiresAt) < new Date()) {
            console.log('⏰ Invitation expired');
            // Continue to create new user instead
          } else {
            // Activate the pending user
            const { data: activatedUser, error: activateError } = await clientToUse
              .from('users')
              .update({ 
                status: 'active',
                clerk_id: clerkUser.id,
                invite_expires_at: null
              })
              .eq('id', pendingUser.id)
              .select()
              .single();

            if (!activateError && activatedUser) {
              console.log('✅ [Auth] Pending user activated by email:', activatedUser);
              console.log('✅ [Auth] Calling onLogin() with activated user');
              onLogin({
                id: activatedUser.clerk_id,
                householdId: activatedUser.household_id,
                email: activatedUser.email,
                name: activatedUser.name,
                role: activatedUser.role,
                avatar: activatedUser.avatar,
                allergies: activatedUser.allergies || [],
                preferences: activatedUser.preferences || [],
                status: 'active',
                notificationsEnabled: activatedUser.notifications_enabled ?? true,
                onboardingStatus: activatedUser.onboarding_status || 'not_started'
              });
              setIsCreatingUser(false);
              console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
              return;
            }
          }
        }
      }

      // ============================================================
      // STEP 4: Create new household and user (first-time signup)
      // ============================================================
      console.log('👤 New user, creating household and user via API...');

      // Use the signup API route with service role key (bypasses RLS)
      const signupResponse = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkId: clerkUser.id,
          email: clerkEmail || '',
          name: clerkUser.fullName || clerkUser.firstName || 'User',
          role: 'Admin'
        })
      });

      if (!signupResponse.ok) {
        const errorData = await signupResponse.json();
        console.error('❌ Signup API error:', errorData);
        throw new Error(errorData.error || 'Failed to create user account');
      }

      const signupData = await signupResponse.json();
      console.log('✅ User and household created via API:', signupData);
      console.log('🔍 User data:', signupData.user);
      console.log('🔍 User name field:', signupData.user?.name);

      // Use the created user data from API
      const createdUser = signupData.user;
      const newHousehold = signupData.household;

      // Ensure name field exists
      if (!createdUser.name) {
        console.error('❌ User name is missing from API response!');
        createdUser.name = clerkUser.fullName || clerkUser.firstName || 'User';
      }

      console.log('✅ [Auth] User created:', createdUser);
      console.log('✅ [Auth] Calling onLogin() with new user');
      console.log('✅ [Auth] User data being passed:', {
        id: createdUser.clerk_id,
        householdId: createdUser.household_id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role
      });

      // Login - new users default to notifications enabled and not_started onboarding
      const userData = {
        id: createdUser.clerk_id,
        householdId: createdUser.household_id,
        email: createdUser.email,
        name: createdUser.name || clerkUser.fullName || clerkUser.firstName || 'User',
        role: createdUser.role,
        avatar: createdUser.avatar,
        allergies: createdUser.allergies || [],
        preferences: createdUser.preferences || [],
        status: 'active',
        notificationsEnabled: createdUser.notifications_enabled ?? true,
        onboardingStatus: createdUser.onboarding_status || 'not_started'
      };

      console.log('✅ [Auth] Final user data for onLogin:', userData);
      onLogin(userData);
      setIsCreatingUser(false);
      console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
    } catch (error: any) {
      console.error('❌ Failed to create user:', error);
      alert(`Account setup failed: ${error.message || 'Unknown error'}\n\nPlease try signing up again.`);
      
      // Reset so user can try again
      hasCheckedUser.current = false;
      setIsCreatingUser(false);
    }
  };

  // Handle household switch - stay in current household
  const handleStayInCurrentHousehold = async () => {
    if (!householdSwitchInfo || !user) return;
    
    setShowHouseholdSwitch(false);
    
    // Get authenticated client
    const client = getAuthenticatedSupabaseClient() || defaultSupabase;
    
    // Find existing user and log them in
    const { data: existingUser } = await client
      .from('users')
      .select('*')
      .eq('id', householdSwitchInfo.existingUserId)
      .maybeSingle();
    
    if (existingUser) {
      // Update clerk_id if needed
      if (!existingUser.clerk_id) {
        await client
          .from('users')
          .update({ clerk_id: user.id })
          .eq('id', existingUser.id);
      }
      
      console.log('✅ [Auth] Calling onLogin() from handleStayInCurrentHousehold');
      onLogin({
        id: existingUser.clerk_id || existingUser.id,
        householdId: existingUser.household_id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        avatar: existingUser.avatar,
        allergies: existingUser.allergies || [],
        preferences: existingUser.preferences || [],
        status: existingUser.status || 'active',
        notificationsEnabled: existingUser.notifications_enabled ?? true,
        onboardingStatus: existingUser.onboarding_status || 'completed'
      });
      setIsCreatingUser(false);
    } else {
      // Clear URL and go to home
      window.location.href = '/';
    }
  };

  // Handle household switch - switch to new household
  const handleSwitchToNewHousehold = async () => {
    if (!householdSwitchInfo || !user) return;
    
    setShowHouseholdSwitch(false);
    setIsCreatingUser(true);
    
    // Get authenticated client
    const client = getAuthenticatedSupabaseClient() || defaultSupabase;
    
    try {
      // Check if pending user exists for the invite
      const { data: pendingUser } = await client
        .from('users')
        .select('*')
        .eq('id', householdSwitchInfo.newUserId)
        .eq('household_id', householdSwitchInfo.newHouseholdId)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (pendingUser) {
        // Activate the pending user and link to Clerk account
        const { data: activatedUser, error: activateError } = await client
          .from('users')
          .update({
            status: 'active',
            clerk_id: user.id,
            email: user.primaryEmailAddress?.emailAddress || pendingUser.email,
            invite_expires_at: null,
            name: user.fullName || user.firstName || pendingUser.name,
            avatar: user.imageUrl || pendingUser.avatar
          })
          .eq('id', householdSwitchInfo.newUserId)
          .eq('household_id', householdSwitchInfo.newHouseholdId)
          .select()
          .single();
        
        if (!activateError && activatedUser) {
          // Delete the old user record (user can only be in one household)
          await client
            .from('users')
            .delete()
            .eq('id', householdSwitchInfo.existingUserId);
          
          // Clear invite params
          window.history.replaceState({}, '', window.location.pathname);
          
          console.log('✅ [Auth] Calling onLogin() from handleSwitchToNewHousehold (activated user)');
          onLogin({
            id: activatedUser.clerk_id || activatedUser.id,
            householdId: activatedUser.household_id,
            email: activatedUser.email,
            name: activatedUser.name,
            role: activatedUser.role,
            avatar: activatedUser.avatar,
            allergies: activatedUser.allergies || [],
            preferences: activatedUser.preferences || [],
            status: 'active',
            notificationsEnabled: activatedUser.notifications_enabled ?? true,
            onboardingStatus: activatedUser.onboarding_status || 'not_started'
          });
          setIsCreatingUser(false);
          return;
        }
      }
      
      // If no pending user, update existing user to new household
      const { data: updatedUser, error: updateError } = await client
        .from('users')
        .update({
          household_id: householdSwitchInfo.newHouseholdId,
          clerk_id: user.id
        })
        .eq('id', householdSwitchInfo.existingUserId)
        .select()
        .single();
      
      if (!updateError && updatedUser) {
        // Clear invite params
        window.history.replaceState({}, '', window.location.pathname);
        
        console.log('✅ [Auth] Calling onLogin() from handleSwitchToNewHousehold (updated user)');
        onLogin({
          id: updatedUser.clerk_id || updatedUser.id,
          householdId: updatedUser.household_id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          avatar: updatedUser.avatar,
          allergies: updatedUser.allergies || [],
          preferences: updatedUser.preferences || [],
          status: updatedUser.status || 'active',
          notificationsEnabled: updatedUser.notifications_enabled ?? true,
          onboardingStatus: updatedUser.onboarding_status || 'completed'
        });
        setIsCreatingUser(false);
      } else {
        throw updateError || new Error('Failed to switch household');
      }
    } catch (error: any) {
      console.error('Failed to switch household:', error);
      alert(`Failed to switch household: ${error.message || 'Unknown error'}`);
      setIsCreatingUser(false);
    }
  };

  // Show household switch modal
  if (showHouseholdSwitch && householdSwitchInfo) {
    return (
      <HouseholdSwitchModal
        currentHouseholdName={householdSwitchInfo.currentHouseholdName}
        newHouseholdName={householdSwitchInfo.newHouseholdName}
        adminName={householdSwitchInfo.adminName}
        onStay={handleStayInCurrentHousehold}
        onSwitch={handleSwitchToNewHousehold}
      />
    );
  }

  // Show custom signup page
  if (showSignUp) {
    return <SignUp onBackToSignIn={() => setShowSignUp(false)} />;
  }

  // CRITICAL: Show loading while Clerk is initializing (after OAuth redirect)
  // Don't render SignIn until we know if user is authenticated or not
  if (!isLoaded) {
    console.log('🟣 [Auth] Clerk not loaded yet, showing loading state');
    return (
      <div className="min-h-screen flex flex-col justify-end pb-24" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="text-white text-center">
          <div className="broom-loader-wrapper">
            <div className="broom-loader mb-4">
              <BroomIcon className="broom-icon-svg" />
              <div className="broom-track"></div>
              <div className="broom-trail"></div>
            </div>
            <p className="text-body whitespace-nowrap">Tidying things up...</p>
          </div>
          <p className="text-caption text-white/60 mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Loading state while creating user OR while user is authenticated but being processed
  if (isCreatingUser || (isLoaded && user && !hasCheckedUser.current)) {
    return (
      <div className="min-h-screen flex flex-col justify-end pb-24" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="text-white text-center">
          <div className="broom-loader-wrapper">
            <div className="broom-loader mb-4">
              <BroomIcon className="broom-icon-svg" />
              <div className="broom-track"></div>
              <div className="broom-trail"></div>
            </div>
            <p className="text-body whitespace-nowrap">Tidying things up...</p>
          </div>
          <p className="text-caption text-white/60 mt-2">Setting up your account</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but checkOrCreateUser has completed (hasCheckedUser.current is true)
  // This means the user was processed but onLogin wasn't called yet (or is being called)
  // Show loading to prevent showing SignIn component
  if (isLoaded && user && hasCheckedUser.current) {
    console.log('🟡 [Auth] Rendering loading state - user authenticated, hasCheckedUser is true');
    console.log('🟡 [Auth] State:', { isCreatingUser, hasCheckedUser: hasCheckedUser.current });
    return (
      <div className="min-h-screen flex flex-col justify-end pb-24" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="text-white text-center">
          <div className="broom-loader-wrapper">
            <div className="broom-loader mb-4">
              <BroomIcon className="broom-icon-svg" />
              <div className="broom-track"></div>
              <div className="broom-trail"></div>
            </div>
            <p className="text-body whitespace-nowrap">Tidying things up...</p>
          </div>
          <p className="text-caption text-white/60 mt-2">Almost ready</p>
        </div>
      </div>
    );
  }

  // Only show SignIn component if Clerk is loaded AND user is not authenticated
  // Check for invite params - if present, show SignUp instead
  if (!user) {
    // Check for invite params
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
    
    // If invite params present, show SignUp component instead
    if (isInvite) {
      console.log('🔴 [Auth] Rendering SignUp component - invite params detected');
      return <SignUp onBackToSignIn={() => setShowSignUp(false)} />;
    }
    
    console.log('🔴 [Auth] Rendering SignIn component - Clerk loaded but no authenticated user');
    console.log('🔴 [Auth] State:', { isLoaded, hasUser: !!user });
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        
        {/* Single container for logo + auth to ensure alignment */}
        <div className="w-full max-w-md">
          {/* Logo Area */}
          <div className="mb-8 text-center">
            <h1 
              className="text-5xl text-white mb-3"
              style={{ fontFamily: "'Peanut Butter', var(--font-sans)" }}
            >
              helpy
            </h1>
            <p className="text-white/90 text-body">
              "I just want you to know<br />I'm real grateful you're here"
            </p>
            <p className="text-white/70 text-caption mt-1">
              Aibileen Clark, The Help
            </p>
          </div>

          {/* Clerk Auth Component */}
          <div className="w-full">
            <SignIn 
            appearance={{
              variables: {
                colorPrimary: '#3EAFD2',
                colorText: '#474747',
                colorTextSecondary: '#757575',
                colorInputBackground: '#FFFFFF',
                colorInputText: '#474747',
                colorBackground: '#FFFFFF',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                spacingUnit: '0.9rem',
              },
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-lg rounded-2xl overflow-hidden",
                card: "bg-white rounded-2xl border-0 shadow-none p-6",
                headerTitle: "text-xl font-bold text-[#474747]",
                headerSubtitle: "text-sm text-gray-500",
                socialButtonsBlockButton: "border border-gray-200 hover:border-gray-300 transition-all rounded-xl font-medium py-3",
                socialButtonsBlockButtonText: "font-medium text-sm",
                formButtonPrimary: "!bg-[#3EAFD2] !bg-none !shadow-none rounded-xl font-semibold py-3 transition-all hover:opacity-90",
                formFieldInput: "bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2]",
                formFieldLabel: "font-medium text-sm text-[#474747] mb-1.5",
                dividerLine: "bg-gray-200",
                dividerText: "text-gray-400 text-sm",
                identityPreviewEditButtonIcon: "text-[#3EAFD2]",
                formFieldInputShowPasswordButton: "text-gray-400 hover:text-gray-600",
                footer: "hidden"
              }
            }}
            routing="hash"
            signUpUrl={null}
          />
          
          {/* Custom Sign Up Button */}
          <div className="mt-4 text-center">
            <p className="text-body text-white/80">
              Don't have an account?{' '}
              <button
                onClick={() => setShowSignUp(true)}
                className="font-bold text-white hover:underline"
              >
                Sign up
              </button>
            </p>
          </div>
          </div>
        </div>

      </div>
    );
  }

  // Fallback - should never reach here
  return (
    <div className="min-h-screen flex flex-col justify-end pb-24" style={{ backgroundColor: '#3EAFD2' }}>
      <div className="text-white text-center">
        <div className="broom-loader-wrapper">
          <div className="broom-loader mb-4">
            <BroomIcon className="broom-icon-svg" />
            <div className="broom-track"></div>
            <div className="broom-trail"></div>
          </div>
          <p className="text-body whitespace-nowrap">Tidying things up...</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;