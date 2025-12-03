// components/AcceptInvite.tsx
// This component handles users clicking on Clerk invitation links
// It works without react-router-dom by reading URL params directly

import React, { useEffect, useState } from 'react';
import { useSignUp, useSignIn, useUser } from '@clerk/clerk-react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

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
      setErrorMessage(err.errors?.[0]?.message || err.message || 'Failed to create account');
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
      setErrorMessage(err.errors?.[0]?.message || err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (status === 'loading' || status === 'signin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary">
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-md">
          <Loader2 className="w-12 h-12 animate-spin text-brand-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">
            {status === 'signin' ? 'Signing you in...' : 'Loading invitation...'}
          </h2>
          <p className="text-gray-500 mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary">
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Invitation Error</h2>
          <p className="text-gray-500 mt-2">{errorMessage || 'This invitation is invalid or has expired.'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-colors"
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary">
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-md">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Welcome to Helpy!</h2>
          <p className="text-gray-500 mt-2">Your account is ready. Redirecting...</p>
        </div>
      </div>
    );
  }

  // Verification form
  if (status === 'verify-email' || status === 'verify-phone') {
    const verifyType = verificationType === 'email' ? 'Email' : 'Phone';
    const verifyTarget = verificationType === 'email' ? email : phoneNumber;
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary p-6">
        <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Verify Your {verifyType}</h1>
            <p className="text-gray-500 mt-2">We sent a code to {verifyTarget}</p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setVerificationCode(value);
                }}
                required
                maxLength={6}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none text-center text-lg tracking-widest"
                placeholder="Enter 6-digit code"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                `Verify ${verifyType}`
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Signup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary p-6">
      <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Join Your Household</h1>
          <p className="text-gray-500 mt-2">Complete your account setup</p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              Email <span className="text-gray-400 font-normal">(Optional if phone provided)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              Phone Number <span className="text-gray-400 font-normal">(Optional if email provided)</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phoneNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d\s\-()+ ]/g, '');
                setPhoneNumber(value);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="+1 (555) 123-4567"
            />
            <p className="text-xs text-gray-400 mt-1">Provide at least one: email or phone number</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Join Household'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          By joining, you agree to the household's shared access to tasks, meals, and shopping lists.
        </p>
      </div>
    </div>
  );
};

export default AcceptInvite;