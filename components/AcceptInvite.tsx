// components/AcceptInvite.tsx
// This component handles users clicking on Clerk invitation links
// It works without react-router-dom by reading URL params directly

import React, { useEffect, useState } from 'react';
import { useSignUp, useSignIn, useUser } from '@clerk/clerk-react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

// Helper function to get user-friendly error message from Clerk errors
function getClerkErrorMessage(err: any): string {
  const errorCode = err.errors?.[0]?.code;
  const errorMessage = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || '';
  
  if (errorCode === 'form_identifier_exists' || errorMessage.toLowerCase().includes('email address is taken')) {
    return 'This email is already registered. Please sign in instead.';
  }
  if (errorCode === 'form_password_pwned' || errorMessage.toLowerCase().includes('data breach')) {
    return 'Please choose a stronger password.';
  }
  if (errorCode === 'form_password_length_too_short' || errorMessage.toLowerCase().includes('password')) {
    return 'Please choose a stronger password.';
  }
  if (errorCode === 'form_code_incorrect' || errorMessage.toLowerCase().includes('incorrect code')) {
    return 'Incorrect code. Please check your email and enter the correct 6-digit code.';
  }
  if (errorCode === 'verification_expired' || errorMessage.toLowerCase().includes('expired')) {
    return 'Code expired. Please request a new one.';
  }
  if (errorCode === 'too_many_requests' || errorMessage.toLowerCase().includes('too many')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  
  return 'Failed to create account. Please try again.';
}

// Loading component for auth states  
const AuthLoading = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 page-fade-in auth-gradient-bg">
    {/* Loading bar only - no logo/text to avoid jarring transition from iOS splash */}
    <div className="auth-loading-bar mx-auto">
      <div className="auth-loading-bar-fill" />
    </div>
  </div>
);

interface AcceptInviteProps {
  onComplete: () => void;
}

const AcceptInvite: React.FC<AcceptInviteProps> = ({ onComplete }) => {
  const { signUp, setActive: setActiveSignUp } = useSignUp();
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { user, isSignedIn } = useUser();
  
  const [status, setStatus] = useState<'loading' | 'signup' | 'signin' | 'complete' | 'error' | 'verify-email' | 'verify-phone'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationType, setVerificationType] = useState<'email' | 'phone' | null>(null);

  // Extract ticket and status from URL (Clerk adds these)
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get('__clerk_ticket');
  const clerkStatus = urlParams.get('__clerk_status'); // 'sign_in', 'sign_up', or 'complete'

  useEffect(() => {
    if (!ticket) {
      setStatus('error');
      setErrorMessage('Invalid invitation link. No ticket found.');
      return;
    }

    // If Clerk says the flow is complete, user is already signed in
    if (clerkStatus === 'complete' || isSignedIn) {
      setStatus('complete');
      // Redirect to main app after brief delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return;
    }

    // Determine if user needs to sign up or sign in
    if (clerkStatus === 'sign_in') {
      setStatus('signin');
      handleAutoSignIn();
    } else {
      // Default to signup flow
      setStatus('signup');
    }
  }, [ticket, clerkStatus, isSignedIn]);

  // Auto sign-in for existing users
  const handleAutoSignIn = async () => {
    if (!signIn || !ticket) return;
    
    try {
      const result = await signIn.create({
        strategy: 'ticket',
        ticket: ticket
      });

      if (result.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId });
        setStatus('complete');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to sign in with invitation');
    }
  };

  // Handle signup form submission
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signUp || !ticket) return;

    // Validate that at least email or phone is provided
    if (!email && !phoneNumber) {
      setErrorMessage('Please provide either an email address or phone number');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = await signUp.create({
        strategy: 'ticket',
        ticket: ticket,
        firstName: firstName,
        lastName: lastName,
        emailAddress: email || undefined,
        phoneNumber: phoneNumber || undefined,
        password: password
      });

      if (result.status === 'complete') {
        await setActiveSignUp({ session: result.createdSessionId });
        setStatus('complete');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        // Check if verification is needed based on unverifiedFields array
        // unverifiedFields contains field identifiers that need verification
        const hasUnverifiedEmail = signUp.unverifiedFields && signUp.unverifiedFields.length > 0 && 
          signUp.unverifiedFields.some(field => field === 'email_address');
        const hasUnverifiedPhone = signUp.unverifiedFields && signUp.unverifiedFields.length > 0 && 
          signUp.unverifiedFields.some(field => field === 'phone_number');
        
        if (email && hasUnverifiedEmail) {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setVerificationType('email');
          setStatus('verify-email');
        } else if (phoneNumber && hasUnverifiedPhone) {
          await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
          setVerificationType('phone');
          setStatus('verify-phone');
        } else {
          setErrorMessage('Additional verification may be required. Please check your email or phone.');
        }
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setErrorMessage(getClerkErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verification
  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signUp) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      let result;
      if (verificationType === 'email') {
        result = await signUp.attemptEmailAddressVerification({
          code: verificationCode,
        });
      } else if (verificationType === 'phone') {
        result = await signUp.attemptPhoneNumberVerification({
          code: verificationCode,
        });
      } else {
        setErrorMessage('Invalid verification type');
        setIsSubmitting(false);
        return;
      }

      if (result.status === 'complete') {
        await setActiveSignUp({ session: result.createdSessionId });
        setStatus('complete');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        // Handle other statuses
        switch (result.status) {
          case 'missing_requirements':
            setErrorMessage('Additional information is required. Please check your email or phone for verification instructions.');
            break;
          case 'abandoned':
            setErrorMessage('Verification was cancelled. Please try again.');
            break;
          default:
            setErrorMessage(`Verification status: ${result.status}. Please try again or contact support if the issue persists.`);
        }
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setErrorMessage(getClerkErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (status === 'loading' || status === 'signin') {
    return <AuthLoading />;
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in auth-gradient-bg">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-10">
            <img 
              src="/helpy-logo-blue.png" 
              alt="Helpy" 
              className="h-12 w-auto"
            />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
            <h1 className="text-display font-bold text-foreground">Invitation Error</h1>
          </div>
          <p className="text-body text-muted-foreground mb-8">
            {errorMessage || 'This invitation is invalid or has expired.'}
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

  // Complete state
  if (status === 'complete') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 page-fade-in auth-gradient-bg">
        <div className="text-center">
          <img 
            src="/helpy-logo-blue.png" 
            alt="Helpy" 
            className="h-14 w-auto mx-auto mb-8"
          />
          <CheckCircle className="w-16 h-16 text-[#4CAF50] mx-auto mb-4" />
          <h1 className="text-display font-bold text-foreground mb-2">Welcome to Helpy!</h1>
          <p className="text-body text-muted-foreground">Your account is ready. Redirecting...</p>
        </div>
      </div>
    );
  }

  // Verification form
  if (status === 'verify-email' || status === 'verify-phone') {
    const verifyTarget = verificationType === 'email' ? email : phoneNumber;
    
    return (
      <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in auth-gradient-bg">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-10">
            <img 
              src="/helpy-logo-blue.png" 
              alt="Helpy" 
              className="h-12 w-auto"
            />
          </div>

          <div className="mb-8">
            <h1 className="text-display font-bold text-foreground mb-2">
              Check your {verificationType === 'email' ? 'email' : 'phone'}
            </h1>
            <p className="text-body text-muted-foreground">
              We sent a verification code to<br />
              <span className="text-foreground font-medium">{verifyTarget}</span>
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-body">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="text-caption text-muted-foreground mb-2 block">Verification Code</label>
              <input
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setVerificationCode(value);
                }}
                required
                maxLength={6}
                className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body tracking-widest text-center"
                placeholder="Enter 6-digit code"
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

  // Signup form
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
          <h1 className="text-display font-bold text-foreground mb-2">Join Your Household</h1>
          <p className="text-body text-muted-foreground">Complete your account setup</p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-body">
            {errorMessage}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-caption text-muted-foreground mb-2 block">First Name</label>
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
                placeholder="John"
              />
            </div>
            <div>
              <label className="text-caption text-muted-foreground mb-2 block">Last Name</label>
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="text-caption text-muted-foreground mb-2 block">
              Email <span className="opacity-60">(Optional if phone provided)</span>
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="text-caption text-muted-foreground mb-2 block">
              Phone Number <span className="opacity-60">(Optional if email provided)</span>
            </label>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phoneNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d\s\-()+ ]/g, '');
                setPhoneNumber(value);
              }}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
              placeholder="+1 (555) 123-4567"
            />
            <p className="text-caption text-muted-foreground mt-1.5">Provide at least one: email or phone number</p>
          </div>

          <div>
            <label className="text-caption text-muted-foreground mb-2 block">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all text-body"
              placeholder="Enter password"
            />
            <p className="text-caption text-muted-foreground mt-2 ml-1">
              Min. 8 characters, 1 lowercase, 1 uppercase, 1 special character
            </p>
          </div>

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
              'Join Household'
            )}
          </button>
        </form>

        <p className="text-caption text-muted-foreground mt-6">
          By joining, you agree to the household's shared access to tasks, meals, and shopping lists.
        </p>
      </div>
    </div>
  );
};

export default AcceptInvite;
