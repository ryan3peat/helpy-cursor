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
  const [verificationStep, setVerificationStep] = useState(false);
  const [code, setCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setIsSubmitting(true);
    setError('');

    try {
      await signUp.create({
        firstName: formData.firstName,
        lastName: formData.lastName,
        emailAddress: formData.email,
        phoneNumber: formData.phoneNumber || undefined,
        password: formData.password,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerificationStep(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setIsSubmitting(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // User will be redirected by Auth component
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verificationStep) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-brand-primary to-brand-secondary flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/50 p-8">
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">Verify Your Email</h2>
            <p className="text-gray-500 text-sm text-center mb-6">
              We sent a code to {formData.email}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="text-gray-700 font-semibold text-sm mb-1 block">
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
                  className="w-full rounded-xl border-gray-300 focus:border-brand-primary focus:ring-brand-primary px-4 py-3"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-primary hover:bg-brand-secondary rounded-xl font-bold py-3 shadow-lg shadow-brand-primary/20 transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        <p className="text-white/80 mt-2 font-medium">Create Your Account</p>
      </div>

      {/* Sign Up Form */}
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/50 p-8">
          <button
            onClick={onBackToSignIn}
            className="flex items-center gap-2 text-gray-600 hover:text-brand-primary mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Sign In</span>
          </button>

          <h2 className="text-2xl font-bold text-gray-800 mb-6">Sign Up</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-700 font-semibold text-sm mb-1 block">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  required
                  className="w-full rounded-xl border-gray-300 focus:border-brand-primary focus:ring-brand-primary px-4 py-3"
                />
              </div>
              <div>
                <label className="text-gray-700 font-semibold text-sm mb-1 block">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  required
                  className="w-full rounded-xl border-gray-300 focus:border-brand-primary focus:ring-brand-primary px-4 py-3"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-700 font-semibold text-sm mb-1 block">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
                className="w-full rounded-xl border-gray-300 focus:border-brand-primary focus:ring-brand-primary px-4 py-3"
              />
            </div>

            <div>
              <label className="text-gray-700 font-semibold text-sm mb-1 block">
                Phone Number <span className="text-gray-400 font-normal">(Optional)</span>
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
                className="w-full rounded-xl border-gray-300 focus:border-brand-primary focus:ring-brand-primary px-4 py-3"
              />
            </div>

            <div>
              <label className="text-gray-700 font-semibold text-sm mb-1 block">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full rounded-xl border-gray-300 focus:border-brand-primary focus:ring-brand-primary px-4 py-3"
              />
              <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-primary hover:bg-brand-secondary rounded-xl font-bold py-3 shadow-lg shadow-brand-primary/20 transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={onBackToSignIn}
                className="text-brand-primary font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
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

export default SignUp;