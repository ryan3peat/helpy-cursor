
import React from 'react';
import { ChevronRight, Sparkles, UserPlus } from 'lucide-react';
import { TranslationDictionary } from '../types';

interface OnboardingOverlayProps {
  step: number;
  userName: string;
  onNext: () => void;
  onSkip: () => void;
  t: TranslationDictionary;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ step, userName, onNext, onSkip, t }) => {
  
  // Configuration for each step
  const steps = [
    {
        // Step 1: Dashboard -> Profile
        title: (t['onboarding.welcome'] || 'Welcome, {name}!').replace('{name}', userName),
        description: t['onboarding.step1.desc'],
        targetId: "onboarding-profile-btn",
        position: "top-right",
        buttonText: t['onboarding.got_it']
    },
    {
        // Step 2: Profile -> Add Member (Final Step)
        title: t['onboarding.step2.title'],
        description: t['onboarding.step2.desc'],
        targetId: "onboarding-add-member-btn",
        position: "top-left",
        buttonText: t['onboarding.add_member']
    }
  ];

  const currentStepConfig = steps[step - 1];
  if (!currentStepConfig) return null;

  // Helper to position the tooltip based on the target element's rough location
  const getPositionClasses = (pos: string) => {
      switch(pos) {
          case 'top-right': 
              return 'top-20 right-4 items-end text-right'; // Below the profile button
          case 'top-left':
              return 'top-36 left-4 items-start text-left'; // Below the add member button in profile carousel
          default:
              return 'bottom-20 left-4 right-4 items-center text-center';
      }
  };

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto transition-opacity duration-500" />

      {/* Tooltip Container */}
      <div className={`absolute w-full max-w-sm p-6 flex flex-col ${getPositionClasses(currentStepConfig.position)} animate-slide-up pointer-events-auto`}>
          
          {/* Card */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs relative border border-gray-100">
              {/* Decorative Arrow */}
              <div className={`absolute w-4 h-4 bg-white transform rotate-45 ${
                  currentStepConfig.position === 'top-right' ? '-top-2 right-8' : 
                  currentStepConfig.position === 'top-left' ? '-top-2 left-8' : 'bottom-0 left-1/2'
              }`}></div>

              <div className="relative z-10">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-4 text-brand-primary">
                      {step === 1 ? <Sparkles size={24} /> : <UserPlus size={24} />}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {currentStepConfig.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      {currentStepConfig.description}
                  </p>

                  <div className="flex items-center justify-between w-full gap-4">
                      <button 
                          onClick={onSkip}
                          className="text-xs font-bold text-gray-400 hover:text-gray-600"
                      >
                          {t['onboarding.skip']}
                      </button>
                      <button 
                          onClick={onNext}
                          className="bg-brand-primary text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary transition-colors flex items-center gap-2"
                      >
                          {currentStepConfig.buttonText}
                          <ChevronRight size={16} />
                      </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;