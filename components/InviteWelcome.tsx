// components/InviteWelcome.tsx
// Pre-authentication welcome page for invite links
// Shows before user signs up/signs in

import React, { useState, useEffect, useRef } from 'react';
import { useSignUp, useSignIn, useClerk, useUser, SignUp } from '@clerk/clerk-react';
import { Loader2, Mail, ArrowRight } from 'lucide-react';
import ErrorBanner from './ui/ErrorBanner';

// Shared gradient background style for auth pages
const AUTH_GRADIENT_STYLE = {
  backgroundImage: 'linear-gradient(to right bottom, #fafafa, #f9f9fa, #f8f8fa, #f6f8f9, #f4f7f9, #f3f7f9, #f1f6f8, #f0f6f8, #f0f6f8, #eff6f8, #eff6f8, #eef6f8)',
  backgroundAttachment: 'fixed' as const
};

// Loading component for auth states  
const AuthLoading = ({ message }: { message: string }) => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 page-fade-in" style={AUTH_GRADIENT_STYLE}>
    <div className="text-center">
      <img 
        src="/helpy-logo-blue.png" 
        alt="Helpy" 
        className="h-14 w-auto mx-auto mb-8"
      />
      <div className="auth-loading-bar mx-auto mb-4">
        <div className="auth-loading-bar-fill" />
      </div>
      <p className="text-body text-muted-foreground">{message}</p>
    </div>
  </div>
);

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
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { redirectToSignIn, openSignUp } = useClerk();
  const { user, isSignedIn, isLoaded: userLoaded } = useUser();
  
  // Get production URL - use environment variable or fallback to current origin
  const getProductionUrl = () => {
    // In production, use the production domain explicitly
    if (typeof window !== 'undefined') {
      const prodUrl = import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://app.helpyfam.com';
      // If we're already on production domain, use it; otherwise use env var
      if (window.location.hostname === 'app.helpyfam.com' || window.location.hostname.includes('helpyfam.com')) {
        return `https://app.helpyfam.com`;
      }
      return prodUrl;
    }
    return 'https://app.helpyfam.com';
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

  // Handle Google sign-in - always goes directly to Google OAuth
  const handleGoogleSignIn = async () => {
    // Check if user is already signed in
    if (userLoaded && isSignedIn) {
      // User is already signed in, redirect to complete invite
      const prodUrl = getProductionUrl();
      const inviteUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
      window.location.href = inviteUrl;
      return;
    }
    
    // Use production URL for Clerk redirect
    const prodUrl = getProductionUrl();
    const redirectUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
    
    // Wait for signIn to be loaded before attempting OAuth
    if (!signInLoaded || !signIn) {
      // Retry after a short delay if signIn isn't ready
      setTimeout(() => handleGoogleSignIn(), 100);
      return;
    }
    
    try {
      // Always use direct OAuth authentication - no fallback
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: redirectUrl,
        redirectUrlComplete: redirectUrl,
      });
    } catch (error: any) {
      console.error('Google OAuth sign-in error:', error);
      setError('Failed to initiate Google sign-in. Please try again.');
    }
  };

  // Handle email/password sign-in - uses Clerk's SignIn component
  const handleEmailSignIn = () => {
    // Check if user is already signed in
    if (userLoaded && isSignedIn) {
      // User is already signed in, redirect to complete invite
      const prodUrl = getProductionUrl();
      const inviteUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
      window.location.href = inviteUrl;
      return;
    }
    
    // Use production URL for Clerk redirect
    const prodUrl = getProductionUrl();
    const redirectUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
    
    // Use Clerk's SignIn component for email/password authentication
    redirectToSignIn({
      redirectUrl: redirectUrl,
    });
  };

  // Loading state - also show loading if checking user status
  if (loading || !userLoaded) {
    return <AuthLoading message="Loading invitation..." />;
  }

  // If user is signed in, show loading while redirecting
  if (isSignedIn && user) {
    return <AuthLoading message="Completing invitation..." />;
  }

  // Error state
  if (!inviteInfo?.isValid || error) {
    return (
      <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in" style={AUTH_GRADIENT_STYLE}>
        <div className="w-full max-w-md mx-auto">
          <div className="mb-10">
            <img 
              src="/helpy-logo-blue.png" 
              alt="Helpy" 
              className="h-12 w-auto"
            />
          </div>
          <h1 className="text-display font-bold text-destructive mb-4">Invitation Error</h1>
          <p className="text-body text-muted-foreground mb-8">
            {error || inviteInfo?.error || 'This invitation is invalid or has expired.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-body font-semibold shadow-sm"
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
      <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in" style={AUTH_GRADIENT_STYLE}>
        <div className="w-full max-w-md mx-auto">
          <div className="mb-10">
            <img 
              src="/helpy-logo-blue.png" 
              alt="Helpy" 
              className="h-12 w-auto"
            />
          </div>

          <div className="mb-8">
            <h1 className="text-display font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-body text-muted-foreground">
              We sent a verification code to<br />
              <span className="text-foreground font-medium">{formData.email}</span>
            </p>
          </div>

          <ErrorBanner 
            error={error} 
            onDismiss={() => setError('')} 
            title="Error"
          />

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="text-caption text-muted-foreground mb-2 block">
                Verification Code
              </label>
              <input
                type="text"
                autoComplete="one-time-code"
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
                className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body tracking-widest text-center"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-body font-semibold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Verifying...
                </>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Welcome page
  const welcomeText = inviteInfo.adminName 
    ? `You've been invited to join ${inviteInfo.adminName}'s household`
    : `You've been invited to join ${inviteInfo.householdName}`;

  return (
    <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in" style={AUTH_GRADIENT_STYLE}>
      <div className="w-full max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-10">
          <img 
            src="/helpy-logo-blue.png" 
            alt="Helpy" 
            className="h-12 w-auto"
          />
        </div>

        {showGoogleOAuth ? (
          <>
            {/* Clerk SignUp Component for OAuth */}
            <button
              onClick={() => setShowGoogleOAuth(false)}
              className="flex items-center gap-2 text-muted-foreground mb-6 text-body"
            >
              <ArrowRight size={16} className="rotate-180" />
              <span>Back</span>
            </button>
            <div ref={signUpRef}>
              <SignUp
                routing="hash"
                redirectUrl={`${getProductionUrl()}?invite=true&hid=${householdId}&uid=${userId}`}
                fallbackRedirectUrl={`${getProductionUrl()}?invite=true&hid=${householdId}&uid=${userId}`}
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    cardBox: "w-full shadow-none rounded-none overflow-visible",
                    card: "bg-transparent rounded-none border-0 shadow-none p-0",
                    socialButtonsBlockButton: "bg-white border border-border rounded-xl font-medium py-3.5",
                    formButtonPrimary: "!bg-[#3EAFD2] !bg-none !shadow-sm rounded-xl font-semibold py-3.5",
                    formField: "hidden",
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
            {/* Welcome Header */}
            <div className="mb-8">
              <h1 className="text-display font-bold text-foreground mb-2">Welcome!</h1>
              <p className="text-body text-muted-foreground">{welcomeText}</p>
              {inviteInfo.pendingUserName && (
                <p className="text-caption text-muted-foreground mt-2">
                  You'll be added as: <span className="font-semibold text-foreground">{inviteInfo.pendingUserName}</span>
                  {inviteInfo.pendingUserRole && ` (${inviteInfo.pendingUserRole})`}
                </p>
              )}
            </div>

            {/* Sign Up Options */}
            <div className="space-y-3">
              <button
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 bg-white border border-border rounded-xl text-body font-medium text-foreground flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              <button
                onClick={() => setShowSignUp(true)}
                className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-body font-semibold shadow-sm flex items-center justify-center gap-2"
              >
                <Mail size={18} />
                Continue with Email
              </button>
            </div>

            {/* Sign In Link */}
            <p className="mt-8 text-body text-muted-foreground">
              Already have an account?{' '}
              <button
                onClick={handleEmailSignIn}
                className="text-primary font-semibold"
              >
                Sign In
              </button>
            </p>
          </>
        ) : (
          <>
            {/* Sign Up Form */}
            <button
              onClick={() => setShowSignUp(false)}
              className="flex items-center gap-2 text-muted-foreground mb-6 text-body"
            >
              <ArrowRight size={16} className="rotate-180" />
              <span>Back</span>
            </button>

            <div className="mb-8">
              <h1 className="text-display font-bold text-foreground">Create Account</h1>
            </div>

            <ErrorBanner 
              error={error} 
              onDismiss={() => setError('')} 
              title="Error"
            />

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground mb-2 block">
                    First Name
                  </label>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="John"
                    required
                    className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
                  />
                </div>
                <div>
                  <label className="text-caption text-muted-foreground mb-2 block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Doe"
                    required
                    className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
                  />
                </div>
              </div>

              <div>
                <label className="text-caption text-muted-foreground mb-2 block">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                  className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
                />
              </div>

              <div>
                <label className="text-caption text-muted-foreground mb-2 block">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
                />
              </div>

              {/* Clerk CAPTCHA widget container */}
              <div id="clerk-captcha"></div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-body font-semibold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
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
  );
};

export default InviteWelcome;

