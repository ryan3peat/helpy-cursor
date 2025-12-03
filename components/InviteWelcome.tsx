// components/InviteWelcome.tsx
// Pre-authentication welcome page for invite links
// Shows before user signs up/signs in

import React, { useState, useEffect } from 'react';
import { useSignUp, useClerk } from '@clerk/clerk-react';
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
  
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState<'email' | null>(null);
  const [code, setCode] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  // Fetch invite info on mount
  useEffect(() => {
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
  }, [householdId, userId]);

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
      // Preserve invite params in redirect URL
      const redirectUrl = `${window.location.origin}${window.location.pathname}?invite=true&hid=${householdId}&uid=${userId}`;
      
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
        await setActive({ session: signUp.createdSessionId! });
        // After setActive, Auth.tsx will detect invite params and complete the flow
        // The page will reload and Auth.tsx will handle invite completion
      } else {
        setError('Account creation completed but requires additional setup. Please try signing in.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Sign up failed');
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
        await setActive({ session: result.createdSessionId });
        // After setActive, Auth.tsx will detect invite params and complete the flow
        // The page will reload and Auth.tsx will handle invite completion
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google signup
  const handleGoogleSignUp = () => {
    const redirectUrl = `${window.location.origin}${window.location.pathname}?invite=true&hid=${householdId}&uid=${userId}`;
    openSignUp({
      redirectUrl: redirectUrl,
    });
  };

  // Handle sign in for existing users
  const handleSignIn = () => {
    const redirectUrl = `${window.location.origin}${window.location.pathname}?invite=true&hid=${householdId}&uid=${userId}`;
    redirectToSignIn({
      redirectUrl: redirectUrl,
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="text-white text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold">Loading invitation...</p>
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

            {!showSignUp ? (
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

