import React, { useEffect, useState } from 'react';

interface IntroAnimationProps {
  onComplete: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Step 1: Animation Start
    const t1 = setTimeout(() => setStep(1), 100);
    // Step 2: Text Fade In
    const t2 = setTimeout(() => setStep(2), 800);
    // Step 3: Exit
    const t3 = setTimeout(() => {
      setStep(3);
      setTimeout(onComplete, 500); // Allow fade out time
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${step === 3 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="relative w-32 h-32 mb-6">
        <div className={`absolute inset-0 bg-brand-primary/20 rounded-full animate-morph transition-all duration-1000 ${step >= 1 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
        <div className={`absolute inset-2 bg-brand-primary/40 rounded-full animate-morph transition-all duration-1000 delay-100 ${step >= 1 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} style={{ animationDirection: 'reverse' }} />
        <div className={`absolute inset-0 flex items-center justify-center text-brand-primary transform transition-all duration-700 ${step >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
            {/* Helping Hand Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 15h2a2 2 0 1 0 0-4h-2" />
              <path d="M3 9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
              <path d="m15 10.5 3 3" />
              <path d="m18 13.5-3 3" />
              <line x1="2" x2="22" y1="20" y2="20" />
            </svg>
        </div>
      </div>
      <h1 className={`text-4xl font-bold text-brand-primary tracking-tight transition-all duration-700 ${step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        Helpy
      </h1>
      <p className={`mt-2 text-gray-400 text-sm font-medium transition-all duration-700 delay-200 ${step >= 2 ? 'opacity-100' : 'opacity-0'}`}>
        Your Home Command Center
      </p>
    </div>
  );
};

export default IntroAnimation;