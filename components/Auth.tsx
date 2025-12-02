// components/Auth.tsx
import React, { useState } from 'react';
import { SignIn, useUser } from '@clerk/clerk-react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import SignUp from './SignUp';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { user, isLoaded } = useUser();
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const hasCheckedUser = React.useRef(false);

  React.useEffect(() => {
    if (isLoaded && user && !isCreatingUser && !hasCheckedUser.current) {
      hasCheckedUser.current = true;
      checkOrCreateUser(user);
    }
  }, [isLoaded, user]);

  const checkOrCreateUser = async (clerkUser: any) => {
    setIsCreatingUser(true);
    
    try {
      console.log('🔍 Checking for user:', clerkUser.id);
      
      // ============================================================
      // STEP 1: Check if this user came from a Clerk invitation
      // (Kept for backwards compatibility)
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
          console.log('✅ Invited user activated:', activatedUser);
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
          return;
        }
      }

      // ============================================================
      // STEP 1.5: Check URL for invite parameters (SHAREABLE LINK FLOW)
      // This handles the flow where admin shares a link without email
      // ============================================================
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      
      // Check both query params and hash params (Clerk uses hash routing)
      const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
      const hid = urlParams.get('hid') || hashParams.get('hid');
      const uid = urlParams.get('uid') || hashParams.get('uid');

      if (isInvite && hid && uid) {
        console.log('🔗 Invite URL detected:', { hid, uid });

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
              console.log('✅ Invited user activated via URL:', activatedUser);
              
              // Clear the invite params from URL
              window.history.replaceState({}, '', window.location.pathname);
              
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
              return;
            } else {
              console.error('❌ Failed to activate via URL:', activateError);
            }
          }
        } else {
          console.log('⚠️ No pending user found for invite params, may already be activated');
          // Clear URL params and continue to regular flow
          window.history.replaceState({}, '', window.location.pathname);
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
        console.log('✅ User exists, logging in');
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
        return;
      }

      // ============================================================
      // STEP 3: Check if there's a pending user with matching email
      // This handles cases where invitation metadata wasn't passed through
      // ============================================================
      const clerkEmail = clerkUser.primaryEmailAddress?.emailAddress;
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
              console.log('✅ Pending user activated by email:', activatedUser);
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
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
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
        throw userError;
      }

      console.log('✅ User created:', createdUser);

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
    } catch (error: any) {
      console.error('❌ Failed to create user:', error);
      alert(`Account setup failed: ${error.message || 'Unknown error'}\n\nPlease try signing up again.`);
      
      // Reset so user can try again
      hasCheckedUser.current = false;
      setIsCreatingUser(false);
    }
  };

  // Show custom signup page
  if (showSignUp) {
    return <SignUp onBackToSignIn={() => setShowSignUp(false)} />;
  }

  // Loading state while creating user
  if (isCreatingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-bold">Setting up your account...</p>
          <p className="text-sm text-white/60 mt-2">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-brand-primary to-brand-secondary flex flex-col items-center justify-center p-6 animate-fade-in">
      
      {/* Logo Area */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30 shadow-xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Helpy</h1>
        <p className="text-white/80 mt-2 font-medium">Your Family Command Center</p>
      </div>

      {/* Clerk Auth Component */}
      <div className="w-full max-w-md">
        <SignIn 
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/50 p-8",
              headerTitle: "text-2xl font-bold text-gray-800",
              headerSubtitle: "text-gray-500 text-sm",
              socialButtonsBlockButton: "bg-white border-2 border-gray-200 hover:border-brand-primary transition-all rounded-xl font-semibold text-gray-700 hover:bg-gray-50",
              socialButtonsBlockButtonText: "font-semibold text-sm",
              formButtonPrimary: "bg-brand-primary hover:bg-brand-secondary rounded-xl font-bold py-3 shadow-lg shadow-brand-primary/20 transition-all",
              footerActionLink: "text-brand-primary font-bold hover:underline",
              formFieldInput: "rounded-xl border-gray-300 focus:border-brand-primary focus:ring-brand-primary",
              formFieldLabel: "text-gray-700 font-semibold text-sm",
              identityPreviewText: "text-gray-700",
              identityPreviewEditButton: "text-brand-primary hover:text-brand-secondary"
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

      {/* Footer */}
      <div className="mt-8 text-white/60 text-xs font-medium text-center leading-relaxed">
        Secure • Private • Family First
        <br />
        <span className="text-white/40 text-[10px]">Powered by Clerk & Supabase</span>
      </div>
    </div>
  );
};

export default Auth;