// components/SignUp.tsx
import React, { useState } from 'react';
import { useSignUp } from '@clerk/clerk-react';
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
    phoneNumber: '',
    password: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState<'email' | 'phone' | null>(null);
  const [code, setCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    // Validate that at least email or phone is provided
    if (!formData.email && !formData.phoneNumber) {
      setError('Please provide either an email address or phone number');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await signUp.create({
        firstName: formData.firstName,
        lastName: formData.lastName,
        emailAddress: formData.email || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        password: formData.password,
      });

      // Check if verification is needed based on unverifiedFields array
      const hasUnverifiedEmail = signUp.unverifiedFields && signUp.unverifiedFields.length > 0 && 
        signUp.unverifiedFields.some(field => field === 'email_address');
      const hasUnverifiedPhone = signUp.unverifiedFields && signUp.unverifiedFields.length > 0 && 
        signUp.unverifiedFields.some(field => field === 'phone_number');
      
      if (hasUnverifiedEmail && formData.email) {
        // Send email verification code
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setVerificationStep('email');
      } else if (hasUnverifiedPhone && formData.phoneNumber) {
        // Send phone verification code
        await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
        setVerificationStep('phone');
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
      let result;
      if (verificationStep === 'email') {
        result = await signUp.attemptEmailAddressVerification({
          code,
        });
      } else if (verificationStep === 'phone') {
        result = await signUp.attemptPhoneNumberVerification({
          code,
        });
      } else {
        setError('Invalid verification step');
        setIsSubmitting(false);
        return;
      }

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

  if (verificationStep) {
    const verificationType = verificationStep === 'email' ? 'Email' : 'Phone';
    const verificationTarget = verificationStep === 'email' ? formData.email : formData.phoneNumber;
    
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
                Email <span className="text-gray-400 font-normal">(Optional if phone provided)</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:outline-none focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2] transition-colors"
              />
            </div>

            <div>
              <label className="text-[#474747] font-medium text-sm mb-1.5 block">
                Phone Number <span className="text-gray-400 font-normal">(Optional if email provided)</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={formData.phoneNumber}
                onChange={(e) => {
                  // Only allow digits, spaces, dashes, parentheses, and + for international format
                  const value = e.target.value.replace(/[^\d\s\-()+ ]/g, '');
                  setFormData({ ...formData, phoneNumber: value });
                }}
                placeholder="+1 (555) 123-4567"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#474747] placeholder-gray-400 focus:outline-none focus:border-[#3EAFD2] focus:ring-1 focus:ring-[#3EAFD2] transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5">Provide at least one: email or phone number</p>
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