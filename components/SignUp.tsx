// components/SignUp.tsx
import React, { useState } from 'react';
import { useSignUp, SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { Loader2, ArrowLeft } from 'lucide-react';

interface SignUpProps {
  onBackToSignIn: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onBackToSignIn }) => {
  const { signUp, setActive, isLoaded } = useSignUp();
  
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
  const [showClerkSignUp, setShowClerkSignUp] = useState(false);

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

  // If showing Clerk SignUp for OAuth, render it
  if (showClerkSignUp) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="mb-8 text-center w-full">
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
          <div className="w-full">
            <div className="bg-white shadow-lg rounded-2xl p-6">
              <button
                onClick={() => setShowClerkSignUp(false)}
                className="flex items-center gap-2 text-gray-500 hover:text-[#3EAFD2] mb-4 transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="text-sm font-medium">Back</span>
              </button>
              <ClerkSignUp
                routing="hash"
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
                    cardBox: "w-full shadow-none rounded-2xl overflow-hidden",
                    card: "bg-white rounded-2xl border-0 shadow-none p-0",
                    headerTitle: "text-xl font-bold text-[#474747]",
                    headerSubtitle: "text-sm text-gray-500",
                    socialButtonsBlockButton: "border border-gray-200 hover:border-gray-300 transition-all rounded-xl font-medium py-3",
                    socialButtonsBlockButtonText: "font-medium text-sm",
                    formButtonPrimary: "!bg-[#3EAFD2] !bg-none !shadow-none rounded-xl font-semibold py-3 transition-all hover:opacity-90",
                    formFieldInput: "bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2]",
                    formFieldLabel: "font-medium text-sm text-[#474747] mb-1.5",
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStep) {
    const verificationType = 'Email';
    const verificationTarget = formData.email;
    
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
        {/* Single container for logo + form to ensure alignment */}
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Logo Area */}
          <div className="mb-8 text-center w-full">
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

          <div className="w-full">
            <div className="bg-white shadow-lg rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#474747] text-center mb-2">Verify Your {verificationType}</h2>
            <p className="text-gray-500 text-sm text-center mb-5">
              We sent a code to {verificationTarget}
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
                    // Only allow digits for verification code
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
                  `Verify ${verificationType}`
                )}
              </button>
            </form>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#3EAFD2' }}>
      {/* Single container for logo + form to ensure alignment */}
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo Area */}
        <div className="mb-8 text-center w-full">
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

        {/* Sign Up Form */}
        <div className="w-full">
          <div className="bg-white shadow-lg rounded-2xl p-6">
          <button
            onClick={onBackToSignIn}
            className="flex items-center gap-2 text-gray-500 hover:text-[#3EAFD2] mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Sign In</span>
          </button>

          <h2 className="text-xl font-bold text-[#474747] mb-5">Sign Up</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Google Sign Up Button */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowClerkSignUp(true)}
              className="w-full border-2 border-gray-200 hover:border-gray-300 rounded-xl font-semibold py-3 transition-all text-gray-700 flex items-center justify-center gap-2 mb-4"
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

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Clerk CAPTCHA widget container - required for bot protection */}
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

          <div className="mt-5 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <button
                onClick={onBackToSignIn}
                className="text-[#3EAFD2] font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
        </div>
      </div>

    </div>
  );
};

export default SignUp;