// components/InviteWelcome.tsx
// Pre-authentication welcome page for invite links
// Shows before user signs up/signs in

import React, { useState, useEffect, useRef } from 'react';
import { useSignUp, useClerk, useUser, SignUp } from '@clerk/clerk-react';
import { Loader2, Mail, ArrowRight } from 'lucide-react';

interface InviteWelcomeProps {
  householdId: string;
  userId: string;
  onComplete: () => void;
}

interface InviteInfo {
  isValid: boolean;
  pendingUserName: string;
  pendingUserRole: string;
  householdName: string;
  adminName: string | null;
  expiresAt: string | null;
  error?: string;
  expired?: boolean;
}

const InviteWelcome: React.FC<InviteWelcomeProps> = ({ householdId, userId, onComplete }) => {
  const { signUp, setActive, isLoaded: signUpLoaded } = useSignUp();
  const { redirectToSignIn, openSignUp } = useClerk();
  const { user, isSignedIn, isLoaded: userLoaded } = useUser();
  
  // Get production URL - use environment variable or fallback to current origin
  const getProductionUrl = () => {
    // In production, use the production domain explicitly
    if (typeof window !== 'undefined') {
      const prodUrl = import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://helpyfam.com';
      // If we're already on production domain, use it; otherwise use env var
      if (window.location.hostname === 'helpyfam.com' || window.location.hostname.includes('helpyfam.com')) {
        return `https://helpyfam.com`;
      }
      return prodUrl;
    }
    return 'https://helpyfam.com';
  };

  // Get Clerk domain for OAuth URLs
  const getClerkDomain = () => {
    // Use custom domain if available, otherwise use default
    return 'accounts.helpyfam.com'; // Your custom Clerk domain
  };
  
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState<'email' | null>(null);
  const [code, setCode] = useState('');
  const [showGoogleOAuth, setShowGoogleOAuth] = useState(false);
  const signUpRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  // Check if user is already signed in - if so, redirect immediately
  useEffect(() => {
    if (userLoaded && isSignedIn && user) {
      // User is already signed in, redirect to complete invite flow
      const prodUrl = getProductionUrl();
      const inviteUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
      window.location.href = inviteUrl;
      return;
    }
  }, [userLoaded, isSignedIn, user, householdId, userId]);

  // Fetch invite info on mount
  useEffect(() => {
    // Don't fetch if user is already signed in
    if (userLoaded && isSignedIn) {
      return;
    }

    async function fetchInviteInfo() {
      try {
        const response = await fetch(`/api/get-invite-info?hid=${householdId}&uid=${userId}`);
        const data = await response.json();
        
        if (!response.ok || !data.isValid) {
          setError(data.error || 'Invalid invitation');
          setInviteInfo({ ...data, isValid: false });
        } else {
          setInviteInfo(data);
          // Pre-fill form with pending user name if available
          if (data.pendingUserName) {
            const nameParts = data.pendingUserName.split(' ');
            setFormData(prev => ({
              ...prev,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || ''
            }));
          }
        }
      } catch (err: any) {
        setError('Failed to load invitation details');
        console.error('Fetch invite info error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchInviteInfo();
  }, [householdId, userId, userLoaded, isSignedIn]);

  // Handle email signup
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;

    if (!formData.email) {
      setError('Please provide an email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Preserve invite params in redirect URL - use production URL
      const prodUrl = getProductionUrl();
      const redirectUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
      
      await signUp.create({
        firstName: formData.firstName,
        lastName: formData.lastName,
        emailAddress: formData.email,
        password: formData.password,
      });

      const hasUnverifiedEmail = signUp.unverifiedFields && signUp.unverifiedFields.length > 0 && 
        signUp.unverifiedFields.some(field => field === 'email_address');
      
      if (hasUnverifiedEmail && formData.email) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setVerificationStep('email');
      } else if (signUp.status === 'complete') {
        // Preserve invite params in URL before setActive - use production URL
        const prodUrl = getProductionUrl();
        const inviteUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
        window.history.replaceState({}, '', `/?invite=true&hid=${householdId}&uid=${userId}`);
        
        try {
          await setActive({ session: signUp.createdSessionId! });
          
          // After setActive completes, redirect to ensure Auth.tsx picks up the invite params
          // Small delay to ensure setActive has fully processed
          setTimeout(() => {
            window.location.href = inviteUrl;
          }, 500);
        } catch (setActiveError: any) {
          console.error('setActive error:', setActiveError);
          // If setActive fails, still redirect - Auth.tsx will handle it
          window.location.href = inviteUrl;
        }
      } else {
        setError('Account creation completed but requires additional setup. Please try signing in.');
      }
    } catch (err: any) {
      const errorMessage = err.errors?.[0]?.longMessage || err.message || 'Sign up failed';
      
      // If user already exists, redirect to sign in with invite params - use production URL
      if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('taken')) {
        const prodUrl = getProductionUrl();
        const signInUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
        redirectToSignIn({ redirectUrl: signInUrl });
        return;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verification
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    setIsSubmitting(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        // Preserve invite params in URL before setActive - use production URL
        const prodUrl = getProductionUrl();
        const inviteUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
        window.history.replaceState({}, '', `/?invite=true&hid=${householdId}&uid=${userId}`);
        
        try {
          await setActive({ session: result.createdSessionId });
          
          // After setActive completes, redirect to ensure Auth.tsx picks up the invite params
          // Small delay to ensure setActive has fully processed
          setTimeout(() => {
            window.location.href = inviteUrl;
          }, 500);
        } catch (setActiveError: any) {
          console.error('setActive error:', setActiveError);
          // If setActive fails, still redirect - Auth.tsx will handle it
          window.location.href = inviteUrl;
        }
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google signup - show Clerk SignUp component with OAuth
  const handleGoogleSignUp = () => {
    // Check if user is already signed in
    if (userLoaded && isSignedIn) {
      // User is already signed in, redirect to complete invite
      const prodUrl = getProductionUrl();
      const inviteUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
      window.location.href = inviteUrl;
      return;
    }
    
    // Show Clerk SignUp component which will have OAuth buttons
    setShowGoogleOAuth(true);
  };

  // Auto-click Google button when SignUp component is shown
  useEffect(() => {
    if (showGoogleOAuth && signUpRef.current) {
      // Wait for Clerk's SignUp component to render
      setTimeout(() => {
        // Find the Google OAuth button in Clerk's SignUp component
        const googleButton = signUpRef.current?.querySelector('button[data-provider="oauth_google"]') as HTMLButtonElement;
        if (googleButton) {
          googleButton.click();
        } else {
          // Fallback: try finding by text content
          const buttons = signUpRef.current?.querySelectorAll('button');
          buttons?.forEach(button => {
            if (button.textContent?.toLowerCase().includes('google')) {
              button.click();
            }
          });
        }
      }, 100);
    }
  }, [showGoogleOAuth]);

  // Handle sign in for existing users
  const handleSignIn = () => {
    // Use production URL for Clerk redirect
    const prodUrl = getProductionUrl();
    const redirectUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
    redirectToSignIn({
      redirectUrl: redirectUrl,
    });
  };

  // Loading state - also show loading if checking user status
  if (loading || !userLoaded) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="text-white text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // If user is signed in, show loading while redirecting
  if (isSignedIn && user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="text-white text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold">Completing invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!inviteInfo?.isValid || error) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Invitation Error</h2>
          <p className="text-gray-600 mb-6">
            {error || inviteInfo?.error || 'This invitation is invalid or has expired.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-[#3EAFD2] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Verification step
  if (verificationStep === 'email') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="w-full max-w-md">
          <div className="bg-white shadow-lg rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#474747] text-center mb-2">Verify Your Email</h2>
            <p className="text-gray-500 text-sm text-center mb-5">
              We sent a code to {formData.email}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="text-[#474747] font-medium text-sm mb-1.5 block">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setCode(value);
                  }}
                  placeholder="Enter 6-digit code"
                  required
                  maxLength={6}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:outline-none focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2] transition-colors text-center text-lg tracking-widest"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: '#3EAFD2' }}
                className="w-full hover:opacity-90 rounded-xl font-semibold py-3 transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Verifying...
                  </>
                ) : (
                  'Verify Email'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Welcome page
  const welcomeName = inviteInfo.adminName || inviteInfo.householdName;
  const welcomeText = inviteInfo.adminName 
    ? `You've been invited to join ${inviteInfo.adminName}'s household`
    : `You've been invited to join ${inviteInfo.householdName}`;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo Area */}
        <div className="mb-8 text-center w-full">
          <h1 
            className="text-5xl text-white mb-3"
            style={{ fontFamily: "'Peanut Butter', 'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            helpy
          </h1>
        </div>

        {/* Welcome Card */}
        <div className="w-full">
          <div className="bg-white shadow-lg rounded-2xl p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#474747] mb-2">Welcome!</h2>
              <p className="text-gray-600 text-sm">
                {welcomeText}
              </p>
              {inviteInfo.pendingUserName && (
                <p className="text-gray-500 text-xs mt-2">
                  You'll be added as: <span className="font-semibold">{inviteInfo.pendingUserName}</span>
                  {inviteInfo.pendingUserRole && ` (${inviteInfo.pendingUserRole})`}
                </p>
              )}
            </div>

            {showGoogleOAuth ? (
              <>
                {/* Clerk SignUp Component for OAuth - auto-clicks Google button */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowGoogleOAuth(false)}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#3EAFD2] mb-4 transition-colors text-sm"
                  >
                    <ArrowRight size={16} className="rotate-180" />
                    <span>Back</span>
                  </button>
                </div>
                <div ref={signUpRef}>
                  <SignUp
                    routing="hash"
                    redirectUrl={`${getProductionUrl()}?invite=true&hid=${householdId}&uid=${userId}`}
                    fallbackRedirectUrl={`${getProductionUrl()}?invite=true&hid=${householdId}&uid=${userId}`}
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                        cardBox: "w-full shadow-none rounded-2xl overflow-hidden",
                        card: "bg-white rounded-2xl border-0 shadow-none p-0",
                        socialButtonsBlockButton: "border border-gray-200 hover:border-gray-300 transition-all rounded-xl font-medium py-3",
                        formButtonPrimary: "!bg-[#3EAFD2] !bg-none !shadow-none rounded-xl font-semibold py-3 transition-all hover:opacity-90",
                        formField: "hidden", // Hide email/password form fields
                        formFieldInput: "hidden",
                        formFieldLabel: "hidden",
                        dividerLine: "hidden",
                        dividerText: "hidden",
                      }
                    }}
                  />
                </div>
              </>
            ) : !showSignUp ? (
              <>
                {/* Sign Up Options */}
                <div className="space-y-3">
                  <button
                    onClick={() => setShowSignUp(true)}
                    style={{ backgroundColor: '#3EAFD2' }}
                    className="w-full hover:opacity-90 rounded-xl font-semibold py-3 transition-all text-white flex items-center justify-center gap-2"
                  >
                    <Mail size={18} />
                    Sign Up with Email
                  </button>

                  <button
                    onClick={handleGoogleSignUp}
                    className="w-full border-2 border-gray-200 hover:border-gray-300 rounded-xl font-semibold py-3 transition-all text-gray-700 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign Up with Google
                  </button>
                </div>

                {/* Sign In Option */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-center text-sm text-gray-500 mb-3">
                    Already have an account?
                  </p>
                  <button
                    onClick={handleSignIn}
                    className="w-full text-[#3EAFD2] font-semibold hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Sign Up Form */}
                <button
                  onClick={() => setShowSignUp(false)}
                  className="flex items-center gap-2 text-gray-500 hover:text-[#3EAFD2] mb-4 transition-colors text-sm"
                >
                  <ArrowRight size={16} className="rotate-180" />
                  <span>Back</span>
                </button>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[#474747] font-medium text-sm mb-1.5 block">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="John"
                        required
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:outline-none focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[#474747] font-medium text-sm mb-1.5 block">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Doe"
                        required
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:outline-none focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[#474747] font-medium text-sm mb-1.5 block">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:outline-none focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[#474747] font-medium text-sm mb-1.5 block">
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      required
                      minLength={8}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:outline-none focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2] transition-colors"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">Must be at least 8 characters</p>
                  </div>

                  {/* Clerk CAPTCHA widget container */}
                  <div id="clerk-captcha" className="mb-4"></div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ backgroundColor: '#3EAFD2' }}
                    className="w-full hover:opacity-90 rounded-xl font-semibold py-3 transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteWelcome;

