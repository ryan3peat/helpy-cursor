// components/Auth.tsx
import React, { useState } from 'react';
import { SignIn, useUser } from '@clerk/clerk-react';
import { supabase } from '../services/supabase';
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
    console.log('🔵 [Auth] useEffect triggered:', { isLoaded, user: !!user, isCreatingUser, hasCheckedUser: hasCheckedUser.current });
    if (isLoaded && user && !isCreatingUser && !hasCheckedUser.current) {
      console.log('✅ [Auth] Conditions met, calling checkOrCreateUser');
      hasCheckedUser.current = true;
      checkOrCreateUser(user);
    } else {
      console.log('⚠️ [Auth] Conditions not met:', {
        isLoaded,
        hasUser: !!user,
        isCreatingUser,
        hasCheckedUser: hasCheckedUser.current
      });
    }
  }, [isLoaded, user, isCreatingUser]);

  const checkOrCreateUser = async (clerkUser: any) => {
    setIsCreatingUser(true);
    
    // Get email once at the start to avoid duplicate declarations
    const clerkEmail = clerkUser.primaryEmailAddress?.emailAddress;
    
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

        const { data: pendingUser, error: pendingError } = await supabase
          .from('users')
          .select('*')
          .eq('id', uid)
          .eq('household_id', hid)
          .eq('status', 'pending')
          .maybeSingle();

        if (pendingUser && !pendingError) {
          // Check if invite hasn't expired
          const expiresAt = pendingUser.invite_expires_at;
          if (expiresAt && new Date(expiresAt) < new Date()) {
            console.log('⏰ Invitation expired');
            alert('This invitation has expired. Please ask for a new invite link.');
            // Clear URL params and continue to regular signup
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            // Activate the pending user and link to Clerk account
            const { data: activatedUser, error: activateError } = await supabase
              .from('users')
              .update({ 
                status: 'active',
                clerk_id: clerkUser.id,
                email: clerkUser.primaryEmailAddress?.emailAddress || pendingUser.email,
                invite_expires_at: null,
                name: clerkUser.fullName || clerkUser.firstName || pendingUser.name,
                avatar: clerkUser.imageUrl || pendingUser.avatar
              })
              .eq('id', uid)
              .eq('household_id', hid)
              .select()
              .single();

            if (!activateError && activatedUser) {
              console.log('✅ [Auth] Invited user activated via URL:', activatedUser);
              console.log('✅ [Auth] Calling onLogin() with user:', {
                id: activatedUser.clerk_id || activatedUser.id,
                householdId: activatedUser.household_id,
                email: activatedUser.email,
                name: activatedUser.name
              });
              
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
                status: 'active'
              });
              
              // Reset state after successful login
              setIsCreatingUser(false);
              console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
              return;
            } else {
              console.error('❌ [Auth] Failed to activate via URL:', activateError);
              console.error('❌ [Auth] activateError details:', activateError);
              console.error('❌ [Auth] activatedUser:', activatedUser);
            }
          }
        } else {
          console.log('⚠️ [Auth] No pending user found for invite params, may already be activated');
          console.log('⚠️ [Auth] pendingError:', pendingError);
          console.log('⚠️ [Auth] pendingUser:', pendingUser);
          // Clear URL params and continue to regular flow
          window.history.replaceState({}, '', window.location.pathname);
        }
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

        const { data: activatedUser, error: activateError } = await supabase
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
            status: 'active'
          });
          setIsCreatingUser(false);
          console.log('✅ [Auth] onLogin() called successfully, resetting isCreatingUser');
          return;
        }
      }

      // ============================================================
      // STEP 2: Check if user already exists (regular login)
      // ============================================================
      const { data: existingUser, error: checkError } = await supabase
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
          status: existingUser.status || 'active'
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
        const { data: pendingUser, error: pendingError } = await supabase
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
            const { data: activatedUser, error: activateError } = await supabase
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
                status: 'active'
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
      console.log('👤 New user, creating household and user...');

      const { data: newHousehold, error: householdError } = await supabase
        .from('households')
        .insert([{ name: `${clerkUser.firstName || 'User'}'s Family` }])
        .select()
        .single();

      if (householdError) {
        console.error('❌ Household error:', householdError);
        throw householdError;
      }

      console.log('✅ Household created:', newHousehold);

      const { data: createdUser, error: userError } = await supabase
        .from('users')
        .insert([{
          household_id: newHousehold.id,
          clerk_id: clerkUser.id,
          email: clerkEmail || '',
          name: clerkUser.fullName || clerkUser.firstName || 'User',
          role: 'Admin',
          avatar: clerkUser.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${clerkUser.firstName || 'User'}`,
          allergies: [],
          preferences: [],
          status: 'active'
        }])
        .select()
        .single();

      if (userError) {
        console.error('❌ User error:', userError);
        
        // Check if it's a duplicate email error (code 23505)
        if (userError.code === '23505' && userError.message?.includes('email')) {
          // Check if we're in an invite flow
          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
          const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
          const hid = urlParams.get('hid') || hashParams.get('hid');
          const uid = urlParams.get('uid') || hashParams.get('uid');
          
          if (isInvite && hid && uid && clerkEmail) {
            // Find existing user with this email
            const { data: existingUser } = await supabase
              .from('users')
              .select('id, household_id, email')
              .eq('email', clerkEmail)
              .maybeSingle();
            
            if (existingUser && existingUser.household_id !== hid) {
              // User exists in different household - show switch modal
              const { data: currentHousehold } = await supabase
                .from('households')
                .select('name')
                .eq('id', existingUser.household_id)
                .maybeSingle();
              
              const { data: newHouseholdData } = await supabase
                .from('households')
                .select('name')
                .eq('id', hid)
                .maybeSingle();
              
              // Get admin name for new household
              const { data: adminUser } = await supabase
                .from('users')
                .select('name')
                .eq('household_id', hid)
                .eq('role', 'Admin')
                .eq('status', 'active')
                .maybeSingle();
              
              setHouseholdSwitchInfo({
                currentHouseholdName: currentHousehold?.name || 'your current household',
                newHouseholdName: newHouseholdData?.name || 'the new household',
                adminName: adminUser?.name || null,
                existingUserId: existingUser.id,
                newHouseholdId: hid,
                newUserId: uid
              });
              setShowHouseholdSwitch(true);
              setIsCreatingUser(false);
              return;
            }
          }
        }
        
        throw userError;
      }

      console.log('✅ [Auth] User created:', createdUser);
      console.log('✅ [Auth] Calling onLogin() with new user');

      // Login
      onLogin({
        id: createdUser.clerk_id,
        householdId: createdUser.household_id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
        avatar: createdUser.avatar,
        allergies: createdUser.allergies || [],
        preferences: createdUser.preferences || [],
        status: 'active'
      });
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
    
    // Find existing user and log them in
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', householdSwitchInfo.existingUserId)
      .maybeSingle();
    
    if (existingUser) {
      // Update clerk_id if needed
      if (!existingUser.clerk_id) {
        await supabase
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
        status: existingUser.status || 'active'
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
    
    try {
      // Check if pending user exists for the invite
      const { data: pendingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', householdSwitchInfo.newUserId)
        .eq('household_id', householdSwitchInfo.newHouseholdId)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (pendingUser) {
        // Activate the pending user and link to Clerk account
        const { data: activatedUser, error: activateError } = await supabase
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
          await supabase
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
            status: 'active'
          });
          setIsCreatingUser(false);
          return;
        }
      }
      
      // If no pending user, update existing user to new household
      const { data: updatedUser, error: updateError } = await supabase
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
          status: updatedUser.status || 'active'
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
            <p className="text-sm font-bold whitespace-nowrap">Tidying things up...</p>
          </div>
          <p className="text-xs text-white/60 mt-2">Please wait a moment</p>
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
            <p className="text-sm font-bold whitespace-nowrap">Tidying things up...</p>
          </div>
          <p className="text-xs text-white/60 mt-2">Setting up your account</p>
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
            <p className="text-sm font-bold whitespace-nowrap">Tidying things up...</p>
          </div>
          <p className="text-xs text-white/60 mt-2">Almost ready</p>
        </div>
      </div>
    );
  }

  // Only show SignIn component if Clerk is loaded AND user is not authenticated
  // Now we know for sure that user is not authenticated (isLoaded is true, user is null)
  if (!user) {
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
              style={{ fontFamily: "'Peanut Butter', 'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}
            >
              helpy
            </h1>
            <p className="text-white/90 text-sm font-medium">
              "I just want you to know<br />I'm real grateful you're here"
            </p>
            <p className="text-white/70 text-xs mt-1 font-medium">
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
                fontFamily: '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, sans-serif',
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
            <p className="text-sm text-white/80">
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
          <p className="text-sm font-bold whitespace-nowrap">Tidying things up...</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;