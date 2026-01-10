// components/Auth.tsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { SignIn, useUser, useClerk } from '@clerk/clerk-react';
import { useSupabase, useSupabaseReady, getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';
import { supabase as defaultSupabase } from '../services/supabase';
import { User, TranslationDictionary } from '../types';
import SignUp from './SignUp';
import HouseholdSwitchModal from './HouseholdSwitchModal';
import RemovedFromHousehold from './RemovedFromHousehold';

// Loading component for auth states
const AuthLoading = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 page-fade-in auth-gradient-bg">
    {/* Loading bar only - no logo/text to avoid jarring transition from iOS splash */}
    <div className="auth-loading-bar mx-auto">
      <div className="auth-loading-bar-fill" />
    </div>
  </div>
);

// NOTE: checkHasPushSubscription was removed to speed up login
// Push subscription status is now checked asynchronously in App.tsx after login

interface AuthProps {
  onLogin: (user: User) => void;
  t: TranslationDictionary;
}

const Auth: React.FC<AuthProps> = ({ onLogin, t }) => {
  const { user, isLoaded } = useUser();
  const { signOut, redirectToSignIn } = useClerk();
  const supabaseFromContext = useSupabase(); // Authenticated client from context
  const isSupabaseReady = useSupabaseReady(); // Check if JWT is ready
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showHouseholdSwitch, setShowHouseholdSwitch] = useState(false);
  const [showRemovedFromHousehold, setShowRemovedFromHousehold] = useState(false);
  
  // Generic alert modal state (replaces native alert())
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });
  
  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };
  
  // Alert Modal Component (renders on top of any screen)
  const AlertModal = () => {
    if (!alertModal.isOpen) return null;
    return createPortal(
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) setAlertModal(prev => ({ ...prev, isOpen: false })); }}
      >
        {/* Safe area bottom cover */}
        <div 
          className="absolute bottom-0 left-0 right-0 bg-card"
          style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
        />
        <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
          {/* Header */}
          <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
            <h2 className={`text-title ${alertModal.type === 'error' ? 'text-destructive' : alertModal.type === 'success' ? 'text-primary' : 'text-foreground'}`}>
              {alertModal.title}
            </h2>
          </div>

          {/* Content */}
          <div className="p-5">
            <p className="text-body text-muted-foreground">
              {alertModal.message}
            </p>
          </div>

          {/* Footer */}
          <div className="p-5 pb-8 border-t border-border shrink-0">
            <button
              onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
              className={`w-full py-3.5 rounded-xl text-body ${
                alertModal.type === 'error' 
                  ? 'bg-destructive/10 text-destructive' 
                  : alertModal.type === 'success'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground'
              }`}
            >
              {t['common.ok'] || 'OK'}
            </button>
          </div>
        </div>
      </div>
    , document.body);
  };
  // Delay rendering the SignIn form to let Clerk component mount
  // This prevents the flash of the container without the form
  const [signInReady, setSignInReady] = useState(false);
  const [householdSwitchInfo, setHouseholdSwitchInfo] = useState<{
    currentHouseholdName: string;
    newHouseholdName: string;
    adminName: string | null;
    existingUserId: string;
    newHouseholdId: string;
    newUserId: string;
  } | null>(null);
  const hasCheckedUser = React.useRef(false);

  // Auth page styling handled by CSS only (html.auth-page class)
  React.useEffect(() => {
    // Use the global theme controller so status bar becomes Helpy blue on auth screens
    const w = window as any;
    if (typeof w.__helpySetAuthPage === 'function') {
      w.__helpySetAuthPage(true);
    } else {
      document.documentElement.classList.add('auth-page');
    }
    return () => {
      if (typeof w.__helpySetAuthPage === 'function') {
        w.__helpySetAuthPage(false);
      } else {
        document.documentElement.classList.remove('auth-page');
      }
    };
  }, []);
  
  // Delay showing the SignIn form to let Clerk component mount fully
  // This prevents the flash of container without the form
  React.useEffect(() => {
    if (isLoaded && !user) {
      // Give Clerk's SignIn component time to render
      const timer = setTimeout(() => setSignInReady(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, user]);

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
            
            // Call onLogin immediately - App.tsx will check push subscription async
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
              hasPushSubscription: false, // App.tsx will update this async
              onboardingStatus: activatedUser.onboarding_status || 'not_started'
            });
            
            // Reset state after successful login
            setIsCreatingUser(false);
            console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
            return;
          } else if (result.expired) {
            console.log('⏰ Invitation expired');
            showAlert(
              t['error.invite_expired_title'] || 'Invitation Expired',
              t['error.invite_expired'] || 'This invitation has expired. Please ask for a new invite link.',
              'error'
            );
            window.history.replaceState({}, '', window.location.pathname);
          } else if (result.notFound) {
            console.log('⚠️ [Auth] Invitation not found, may already be activated');
            // Don't clear URL yet - continue to check if user exists by email
          } else if (result.requiresSwitch) {
            // User already belongs to another household - need to handle switch
            console.log('🔄 [Auth] User belongs to different household, requires switch');
            console.log('🔄 [Auth] Existing household:', result.existingHouseholdId);
            console.log('🔄 [Auth] Invited household:', result.invitedHouseholdId);
            
            // Don't clear URL - let App.tsx/InviteSetup handle the household switch
            // The user needs to see the household switch modal
            // For now, continue to check existing user - they'll see the switch modal
          } else if (result.emailConflict) {
            // Email already used by another account
            console.log('📧 [Auth] Email conflict - another account has this email');
            showAlert(
              t['error.email_conflict_title'] || 'Email Already Used',
              t['error.email_conflict'] || 'This email is already associated with another Helpy account. If you already have an account, please sign in instead of signing up. Or use a different email address.',
              'error'
            );
            window.history.replaceState({}, '', window.location.pathname);
            setIsCreatingUser(false);
            return;
          } else {
            console.error('❌ [Auth] Failed to activate via API:', result.error);
          }
        } catch (error) {
          console.error('❌ [Auth] Accept invite API error:', error);
        }
        
        // DON'T clear URL params yet - let the flow continue
        // The invite might still be processable by later steps
        // Only clear after STEP 4 (new user creation) would run
        console.log('⚠️ [Auth] Invite processing incomplete, keeping URL params for debugging');
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
            hasPushSubscription: false, // App.tsx will update this async
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
        console.log('✅ [Auth] User exists:', existingUser);

        // Check if user has been removed from household (household_id is null)
        if (!existingUser.household_id) {
          console.log('⚠️ [Auth] User has no household, showing removed screen');
          setShowRemovedFromHousehold(true);
          setIsCreatingUser(false);
          return;
        }

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
          hasPushSubscription: false, // App.tsx will update this async
          onboardingStatus: existingUser.onboarding_status || 'completed'
        });
        setIsCreatingUser(false);
        console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
        return;
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
                hasPushSubscription: false, // App.tsx will update this async
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
      
      // CRITICAL: If invite params were detected but not processed, don't create a new household
      // Re-check URL params to see if this was an invite attempt
      const finalUrlParams = new URLSearchParams(window.location.search);
      const finalHashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const wasInviteAttempt = finalUrlParams.get('invite') === 'true' || finalHashParams.get('invite') === 'true';
      const finalHid = finalUrlParams.get('hid') || finalHashParams.get('hid');
      const finalUid = finalUrlParams.get('uid') || finalHashParams.get('uid');
      
      if (wasInviteAttempt && finalHid && finalUid) {
        console.error('❌ [Auth] Invite params detected but not processed - NOT creating new household');
        console.error('❌ [Auth] Invite details:', { hid: finalHid, uid: finalUid });
        showAlert(
          t['error.invite_processing_title'] || 'Invitation Error',
          t['error.invite_processing'] || 'There was a problem processing your invitation. Please try clicking the invite link again or contact the household admin for a new link.',
          'error'
        );
        window.history.replaceState({}, '', window.location.pathname);
        setIsCreatingUser(false);
        return;
      }
      
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
      showAlert(
        t['error.account_setup_title'] || 'Account Setup Failed',
        t['error.account_setup'] || 'Account setup failed. Please try again or contact support.',
        'error'
      );
      
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
        hasPushSubscription: false, // App.tsx will update this async
        onboardingStatus: existingUser.onboarding_status || 'completed'
      });
      setIsCreatingUser(false);
    } else {
      // Clear URL and go to home
      window.location.href = '/';
    }
  };

  // Handle creating new household from removed screen
  const handleCreateNewHousehold = async () => {
    if (!user) return;
    
    console.log('🏠 [Auth] Creating new household for removed user');
    setIsCreatingUser(true);
    
    try {
      const apiUrl = import.meta.env?.VITE_API_URL || '';
      
      // Call the signup API to create a new household for this existing user
      const signupResponse = await fetch(`${apiUrl}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.firstName || 'User',
          role: 'Admin'
        })
      });

      if (!signupResponse.ok) {
        const errorData = await signupResponse.json();
        console.error('❌ Signup API error:', errorData);
        throw new Error(errorData.error || 'Failed to create household');
      }

      const signupData = await signupResponse.json();
      console.log('✅ New household created:', signupData);

      const createdUser = signupData.user;
      
      // Login with the new household
      // Note: New user won't have push subscriptions yet, so hasPushSubscription is false
      setShowRemovedFromHousehold(false);
      onLogin({
        id: createdUser.clerk_id,
        householdId: createdUser.household_id,
        email: createdUser.email,
        name: createdUser.name || user.fullName || user.firstName || 'User',
        role: createdUser.role,
        avatar: createdUser.avatar,
        allergies: createdUser.allergies || [],
        preferences: createdUser.preferences || [],
        status: 'active',
        notificationsEnabled: createdUser.notifications_enabled ?? true,
        hasPushSubscription: false,
        onboardingStatus: 'not_started' // Start fresh with onboarding
      });
      
      setIsCreatingUser(false);
      console.log('✅ [Auth] User logged in with new household');
      
    } catch (error: any) {
      console.error('❌ Failed to create new household:', error);
      showAlert(
        t['error.create_household_title'] || 'Household Creation Failed',
        t['error.household_create'] || 'Could not create your household. Please try again.',
        'error'
      );
      setIsCreatingUser(false);
    }
  };

  // Handle permanent account deletion from removed screen
  const handleDeleteAccountFromRemoved = async () => {
    if (!user) return;
    
    console.log('🗑️ [Auth] Deleting account permanently');
    
    try {
      const apiUrl = import.meta.env?.VITE_API_URL || '';
      
      // Delete the user from Supabase (user with null household_id)
      const deleteResponse = await fetch(`${apiUrl}/api/delete-removed-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user.id
        })
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        console.error('❌ Delete API error:', errorData);
        throw new Error(errorData.error || 'Failed to delete account');
      }

      console.log('✅ User deleted from Supabase');

      // Sign out from Clerk and redirect to homepage
      // Note: We sign out instead of deleting the Clerk account because 
      // client-side deletion may not have proper permissions
      try {
        await signOut();
        console.log('✅ User signed out from Clerk');
      } catch (clerkError) {
        console.error('⚠️ Failed to sign out from Clerk:', clerkError);
        // Continue anyway - Supabase data is already deleted
      }

      // Redirect to homepage
      window.location.href = 'https://helpyfam.com';
      
    } catch (error: any) {
      console.error('❌ Failed to delete account:', error);
      throw error; // Re-throw so the component can handle it
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
            hasPushSubscription: false, // App.tsx will update this async
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
          hasPushSubscription: false, // App.tsx will update this async
          onboardingStatus: updatedUser.onboarding_status || 'completed'
        });
        setIsCreatingUser(false);
      } else {
        throw updateError || new Error('Failed to switch household');
      }
    } catch (error: any) {
      console.error('Failed to switch household:', error);
      // Check for session expired errors
      const isSessionExpired = error.message?.toLowerCase().includes('jwt') || 
                               error.message?.toLowerCase().includes('expired') ||
                               error.message?.toLowerCase().includes('token');
      showAlert(
        t['error.switch_household_title'] || 'Household Switch Failed',
        isSessionExpired 
          ? (t['error.session_expired'] || 'Session expired. Please sign in again.')
          : (t['error.switch_household'] || 'Failed to switch household. Please try again.'),
        'error'
      );
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

  // Show removed from household screen
  if (showRemovedFromHousehold) {
    return (
      <RemovedFromHousehold
        t={t}
        onDeleteAccount={handleDeleteAccountFromRemoved}
        onCreateNewHousehold={handleCreateNewHousehold}
        isLoading={isCreatingUser}
      />
    );
  }

  // Show custom signup page
  if (showSignUp) {
    return <SignUp onBackToSignIn={() => setShowSignUp(false)} t={t} />;
  }

  // CRITICAL: Show loading while Clerk is initializing (after OAuth redirect)
  // Don't render SignIn until we know if user is authenticated or not
  if (!isLoaded) {
    console.log('🟣 [Auth] Clerk not loaded yet, showing loading state');
    return <AuthLoading />;
  }

  // Loading state while creating user OR while user is authenticated but being processed
  if (isCreatingUser || (isLoaded && user && !hasCheckedUser.current)) {
    return (
      <>
        <AlertModal />
        <AuthLoading />
      </>
    );
  }

  // If user is authenticated but checkOrCreateUser has completed (hasCheckedUser.current is true)
  // This means the user was processed but onLogin wasn't called yet (or is being called)
  // Show loading to prevent showing SignIn component
  if (isLoaded && user && hasCheckedUser.current) {
    console.log('🟡 [Auth] Rendering loading state - user authenticated, hasCheckedUser is true');
    console.log('🟡 [Auth] State:', { isCreatingUser, hasCheckedUser: hasCheckedUser.current });
    return <AuthLoading />;
  }

  // Only show SignIn component if Clerk is loaded AND user is not authenticated
  // Check for invite params - if present, show SignUp instead
  if (!user) {
    // Check for invite params
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
    const hid = urlParams.get('hid') || hashParams.get('hid');
    const uid = urlParams.get('uid') || hashParams.get('uid');
    
    // If invite params present, show SignUp component instead
    if (isInvite) {
      console.log('🔴 [Auth] Rendering SignUp component - invite params detected');
      
      // Create handler that preserves invite params when redirecting to sign-in
      const handleBackToSignIn = () => {
        if (isInvite && hid && uid) {
          // Preserve invite params in redirect URL
          const redirectUrl = `${window.location.origin}${window.location.pathname}?invite=true&hid=${hid}&uid=${uid}`;
          redirectToSignIn({
            redirectUrl: redirectUrl,
          });
        } else {
          // No invite params, just toggle to sign-in view
          setShowSignUp(false);
        }
      };
      
      return <SignUp onBackToSignIn={handleBackToSignIn} t={t} />;
    }
    
    // Wait for SignIn component to be ready (prevents flash of container without form)
    if (!signInReady) {
      console.log('🔴 [Auth] Waiting for SignIn component to be ready...');
      return <AuthLoading />;
    }
    
    console.log('🔴 [Auth] Rendering SignIn component - Clerk loaded but no authenticated user');
    console.log('🔴 [Auth] State:', { isLoaded, hasUser: !!user });
    return (
      <>
        <AlertModal />
        {/* Override Clerk "Last Used" badge styles only */}
        <style>{`
          /* Target Clerk badge by appearance - positioned element with small text */
          [class*="cl-badge"],
          [class*="cl-"][class*="badge"],
          [class*="Badge"],
          /* Target by structure - element containing "Last used" text */
          [class*="cl-socialButtonsBlockButton"] + [class*="cl-"],
          [class*="cl-socialButtons"] > div > [class*="cl-"]:not(button):not(form) {
            background-color: white !important;
            background: white !important;
            border: 1px solid #E5E7EB !important;
          }
        `}</style>
        <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in auth-gradient-bg">
          <div className="w-full max-w-md mx-auto">
            {/* Logo */}
            <div className="mb-10">
              <img 
                src="/helpy-logo-blue.png" 
                alt="Helpy" 
                className="h-12 w-auto"
              />
            </div>

            {/* Spacer to align with SignUp page (matches back button + mb-6) */}
            <div className="h-[44px]"></div>

            {/* Header - left aligned */}
            <div className="mb-8">
              <h1 className="text-display font-bold text-foreground mb-2">Welcome back</h1>
              <p className="text-body text-muted-foreground">Sign in to continue to Helpy</p>
            </div>

            {/* Clerk Auth Component */}
            <div className="w-full">
              <SignIn 
                appearance={{
                  variables: {
                    colorPrimary: '#3EAFD2',
                    colorText: '#474747',
                    colorTextSecondary: '#757575',
                    colorInputBackground: '#FFB6C1',
                    colorInputText: '#474747',
                    colorBackground: 'transparent',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    spacingUnit: '1rem',
                  },
                  elements: {
                    rootBox: "w-full",
                    cardBox: "w-full shadow-none rounded-none overflow-visible",
                    card: "bg-transparent rounded-none border-0 shadow-none p-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "!bg-white !border !border-[#E5E7EB] !rounded-2xl !font-medium !shadow-none !py-[14px]",
                    socialButtonsBlockButtonText: "!font-medium !text-sm !text-[#474747]",
                    formButtonPrimary: "!bg-[#3EAFD2] !border-0 !shadow-sm !rounded-2xl !font-semibold !py-[14px]",
                    formFieldInput: "!bg-white !border-[1px] !border-solid !border-[#E5E7EB] !rounded-2xl !px-[16px] !py-[14px] !text-[14px] !text-[#474747] !placeholder-[#9CA3AF] focus:!border-[#3EAFD2] !ring-0 !outline-none !shadow-none !leading-[1.5] !box-border !h-[52px] !min-h-[52px]",
                    formFieldInputGroup: "!h-[52px] !min-h-[52px] !rounded-2xl !overflow-hidden",
                    formField: "!rounded-2xl",
                    formFieldRow: "!min-h-0 !rounded-2xl",
                    formFieldLabel: "!font-normal !text-xs !text-[#757575] !mb-2",
                    dividerLine: "!bg-[#E5E7EB]",
                    dividerText: "!text-[#757575] !text-xs",
                    identityPreviewEditButtonIcon: "!text-[#3EAFD2]",
                    formFieldInputShowPasswordButton: "!text-[#9CA3AF]",
                    footer: "hidden",
                    // Badge styling for "Last Used" indicator
                    badge: {
                      backgroundColor: 'white',
                      background: 'white',
                      border: '1px solid #E5E7EB'
                    }
                  }
                }}
                routing="hash"
                signUpUrl={null}
              />
            
              {/* Custom Sign Up Button */}
              <div className="mt-6">
                <p className="text-body text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    onClick={() => setShowSignUp(true)}
                    className="font-semibold text-primary"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </div>

            {/* Features Link */}
            <div className="mt-8">
              <a
                href="https://helpyfam.com"
                className="text-primary text-body"
              >
                See Helpyfam Features
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Fallback - should never reach here
  return <AuthLoading />;
};

export default Auth;