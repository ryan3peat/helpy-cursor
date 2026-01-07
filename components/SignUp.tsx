// components/SignUp.tsx
import React, { useState, useEffect } from 'react';
import { useSignUp, useSignIn } from '@clerk/clerk-react';
import { Loader2, ArrowLeft } from 'lucide-react';
import ErrorBanner from './ui/ErrorBanner';

interface SignUpProps {
  onBackToSignIn: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onBackToSignIn }) => {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState<'email' | null>(null);
  const [code, setCode] = useState('');
  const [isOAuthProcessing, setIsOAuthProcessing] = useState(false);
  const [hasCheckedOAuthRedirect, setHasCheckedOAuthRedirect] = useState(false);

  // Check for invite params and preserve them
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
    const hid = urlParams.get('hid') || hashParams.get('hid');
    const uid = urlParams.get('uid') || hashParams.get('uid');
    
    if (isInvite && hid && uid) {
      // Preserve invite params in URL
      const inviteUrl = `/?invite=true&hid=${hid}&uid=${uid}`;
      window.history.replaceState({}, '', inviteUrl);
    }
  }, []);

  // Helper function to get redirect URL with invite params preserved
  const getRedirectUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
    const hid = urlParams.get('hid') || hashParams.get('hid');
    const uid = urlParams.get('uid') || hashParams.get('uid');
    
    if (isInvite && hid && uid) {
      return `${baseUrl}?invite=true&hid=${hid}&uid=${uid}`;
    }
    return baseUrl.split('?')[0];
  };

  // Handle OAuth redirect completion
  useEffect(() => {
    if (!isLoaded || !signUp) return;

    // Check if we're returning from an OAuth redirect
    const handleOAuthRedirect = async () => {
      // Only check once per signUp session to avoid duplicate processing
      if (hasCheckedOAuthRedirect) return;

      try {
        setHasCheckedOAuthRedirect(true);

        // Check if signUp is complete after OAuth
        if (signUp.status === 'complete' && signUp.createdSessionId) {
          setIsOAuthProcessing(true);
          await setActive({ session: signUp.createdSessionId });
          // User will be redirected by Auth component
          return;
        }

        // If signUp needs additional requirements (like CAPTCHA), Clerk will handle it
        // The CAPTCHA widget will be automatically mounted in the container
        if (signUp.status === 'missing_requirements') {
          // Clerk will automatically show CAPTCHA in the #clerk-captcha container
          // Reset processing state so user can interact with CAPTCHA
          setIsOAuthProcessing(false);
          console.log('OAuth completed but missing requirements - CAPTCHA should appear');
        } else if (signUp.status === 'abandoned') {
          // OAuth was cancelled or failed
          setIsOAuthProcessing(false);
          setHasCheckedOAuthRedirect(false);
        }
      } catch (error: any) {
        console.error('OAuth redirect handling error:', error);
        
        // Check for external_account_exists error (Clerk's way of saying user already exists)
        const hasExternalAccountError = error.errors?.some(
          (e: any) => e.code === 'external_account_exists' || 
                      e.code === 'form_identifier_exists' ||
                      e.message?.toLowerCase().includes('already exists')
        );

        if (hasExternalAccountError && signInLoaded && signIn) {
          // Use Clerk's transfer mechanism to switch to sign-in
          try {
            console.log('Existing account detected, transferring to sign-in...');
            
            // Transfer the OAuth flow from sign-up to sign-in
            await signIn.create({ transfer: true });
            
            // If transfer successful, continue with sign-in OAuth
            const redirectUrl = getRedirectUrl();
            
            await signIn.authenticateWithRedirect({
              strategy: 'oauth_google',
              redirectUrl: redirectUrl,
              redirectUrlComplete: redirectUrl,
            });
            return;
          } catch (transferError: any) {
            console.error('Transfer to sign-in failed:', transferError);
            // Fallback: try direct sign-in OAuth
            try {
              const redirectUrl = getRedirectUrl();
              
              await signIn.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: redirectUrl,
                redirectUrlComplete: redirectUrl,
              });
              return;
            } catch (signInError: any) {
              console.error('Sign-in OAuth error:', signInError);
              setError('Account already exists. Please use Sign In instead.');
            }
          }
        } else {
          setError('Failed to complete sign up. Please try again.');
        }
        
        setIsOAuthProcessing(false);
        setHasCheckedOAuthRedirect(false);
      }
    };

    handleOAuthRedirect();
  }, [isLoaded, signUp, setActive, hasCheckedOAuthRedirect, signIn, signInLoaded]);

  // Handle sign-in OAuth redirect completion
  useEffect(() => {
    if (!signInLoaded || !signIn) return;

    const handleSignInOAuthRedirect = async () => {
      try {
        // Check if sign-in is complete after OAuth
        if (signIn.status === 'complete' && signIn.createdSessionId) {
          setIsOAuthProcessing(true);
          await setActiveSignIn({ session: signIn.createdSessionId });
          // User will be redirected by Auth component
          return;
        }
      } catch (error: any) {
        console.error('Sign-in OAuth redirect handling error:', error);
        setError('Failed to sign in. Please try again.');
        setIsOAuthProcessing(false);
      }
    };

    handleSignInOAuthRedirect();
  }, [signInLoaded, signIn, setActiveSignIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    // Validate that email is provided
    if (!formData.email) {
      setError('Please provide an email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Preserve invite params before signup
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
      const hid = urlParams.get('hid') || hashParams.get('hid');
      const uid = urlParams.get('uid') || hashParams.get('uid');
      
      if (isInvite && hid && uid) {
        window.history.replaceState({}, '', `/?invite=true&hid=${hid}&uid=${uid}`);
      }

      await signUp.create({
        firstName: formData.firstName,
        lastName: formData.lastName,
        emailAddress: formData.email,
        password: formData.password,
      });

      // Check if verification is needed based on unverifiedFields array
      const hasUnverifiedEmail = signUp.unverifiedFields && signUp.unverifiedFields.length > 0 && 
        signUp.unverifiedFields.some(field => field === 'email_address');
      
      if (hasUnverifiedEmail && formData.email) {
        // Send email verification code
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setVerificationStep('email');
      } else if (signUp.status === 'complete') {
        // Preserve invite params before setActive
        if (isInvite && hid && uid) {
          window.history.replaceState({}, '', `/?invite=true&hid=${hid}&uid=${uid}`);
        }
        // No verification needed, sign up is complete
        await setActive({ session: signUp.createdSessionId! });
        // User will be redirected by Auth component
      } else {
        // Unexpected status - show error
        setError('Account creation completed but requires additional setup. Please try signing in.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setIsSubmitting(true);
    setError('');

    try {
      if (verificationStep !== 'email') {
        setError('Invalid verification step');
        setIsSubmitting(false);
        return;
      }

      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        // Preserve invite params before setActive
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isInvite = urlParams.get('invite') === 'true' || hashParams.get('invite') === 'true';
        const hid = urlParams.get('hid') || hashParams.get('hid');
        const uid = urlParams.get('uid') || hashParams.get('uid');
        
        if (isInvite && hid && uid) {
          window.history.replaceState({}, '', `/?invite=true&hid=${hid}&uid=${uid}`);
        }
        
        await setActive({ session: result.createdSessionId });
        // User will be redirected by Auth component
      } else {
        // Handle other statuses
        switch (result.status) {
          case 'missing_requirements':
            setError('Additional information is required. Please check your email or phone for verification instructions.');
            break;
          case 'abandoned':
            setError('Verification was cancelled. Please try again.');
            break;
          default:
            setError(`Verification status: ${result.status}. Please try again or contact support if the issue persists.`);
        }
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google OAuth signup - directly initiate OAuth flow
  const handleGoogleSignUp = async () => {
    if (!signUp || !isLoaded) {
      // If signUp isn't ready, wait a bit and try again
      setTimeout(() => handleGoogleSignUp(), 100);
      return;
    }

    // Prevent duplicate clicks
    if (isOAuthProcessing) {
      return;
    }

    setIsOAuthProcessing(true);
    setError('');
    setHasCheckedOAuthRedirect(false);

    try {
      // Preserve invite params in redirect URL
      const redirectUrl = getRedirectUrl();
      
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: redirectUrl,
        redirectUrlComplete: redirectUrl,
      });
    } catch (error: any) {
      console.error('Google OAuth error:', error);
      
      // Check for external_account_exists error BEFORE redirect
      const hasExternalAccountError = error.errors?.some(
        (e: any) => e.code === 'external_account_exists' || 
                    e.code === 'form_identifier_exists' ||
                    e.message?.toLowerCase().includes('already exists')
      );

      if (hasExternalAccountError && signInLoaded && signIn) {
        // Use Clerk's transfer mechanism
        try {
          console.log('Existing account detected before redirect, transferring to sign-in...');
          await signIn.create({ transfer: true });
          
          const redirectUrl = getRedirectUrl();
          
          await signIn.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: redirectUrl,
            redirectUrlComplete: redirectUrl,
          });
          return;
        } catch (signInError: any) {
          console.error('Sign-in OAuth error:', signInError);
          setError('Account already exists. Please use Sign In instead.');
        }
      } else {
        setError('Failed to initiate Google sign-in. Please try again.');
      }
      
      setIsOAuthProcessing(false);
      setHasCheckedOAuthRedirect(false);
    }
  };

  if (verificationStep) {
    return (
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

          {/* Header */}
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

          <button className="mt-6 text-body text-primary font-medium">
            Didn't receive a code? Resend
          </button>
        </div>
      </div>
    );
  }

  return (
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

        {/* Back button */}
        <button
          onClick={onBackToSignIn}
          className="flex items-center gap-2 text-muted-foreground mb-6"
        >
          <ArrowLeft size={18} />
          <span className="text-body">Back to Sign In</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display font-bold text-foreground">Create Account</h1>
        </div>

        <ErrorBanner 
          error={error} 
          onDismiss={() => setError('')} 
          title="Error"
        />

        {/* Google Sign Up Button */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={!isLoaded || isOAuthProcessing}
          className="w-full py-3.5 bg-white border border-border rounded-2xl text-body font-medium text-foreground flex items-center justify-center gap-3 disabled:opacity-50 mb-5"
        >
          {isOAuthProcessing ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-caption text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full px-4 py-3.5 rounded-2xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
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
                className="w-full px-4 py-3.5 rounded-2xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
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
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
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
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
            />
          </div>

          {/* Clerk CAPTCHA widget container */}
          <div id="clerk-captcha"></div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl text-body font-semibold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
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

        {/* Footer */}
        <p className="mt-6 text-body text-muted-foreground">
          Already have an account?{' '}
          <button onClick={onBackToSignIn} className="text-primary font-semibold">
            Sign In
          </button>
        </p>

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
  );
};

export default SignUp;