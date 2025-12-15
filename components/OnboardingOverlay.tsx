import React, { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { TranslationDictionary, UserRole } from '../types';

// Action types for onboarding steps
export type OnboardingAction = 
  | { type: 'none' }
  | { type: 'navigate'; target: string; section?: string }
  | { type: 'openSheet'; sheet: 'addMember' }
  | { type: 'complete' };

// Tooltip position types
type TooltipPosition = 
  | 'center-middle' 
  | 'top-right' 
  | 'top-left' 
  | 'below-add-button'
  | 'center-near-tabnav'
  | 'bottom-center'
  | 'center-near-family-board';

// Step configuration
interface OnboardingStep {
  id: string;
  currentPage: string;
  currentSection?: string;
  title: string;
  description: string;
  targetElement: string | null;
  tooltipPosition: TooltipPosition;
  buttonText: string;
  action: OnboardingAction;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE-BASED STEP CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

const getStepsForRole = (role: UserRole, t: TranslationDictionary): OnboardingStep[] => {
  
  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN - 6 steps
  // ─────────────────────────────────────────────────────────────────────────
  if (role === UserRole.MASTER) {
    return [
      // Step 1: Welcome
      {
        id: 'admin-1',
        currentPage: 'dashboard',
        title: t['onboarding.admin.1.title'] || 'Welcome',
        description: t['onboarding.admin.1.desc'] || 'This is your home command center! First, let\'s add your family members.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'none' },
      },
      // Step 2: Tap profile icon
      {
        id: 'admin-2',
        currentPage: 'dashboard',
        title: t['onboarding.admin.2.title'] || 'Add family members',
        description: t['onboarding.admin.2.desc'] || 'Tap your profile icon.',
        targetElement: 'onboarding-profile-btn',
        tooltipPosition: 'top-right',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'profile' },
      },
      // Step 3: Tap Add button -> Navigate directly to Household Info
      {
        id: 'admin-3',
        currentPage: 'profile',
        title: t['onboarding.admin.3.title'] || 'Add family members',
        description: t['onboarding.admin.3.desc'] || 'Tap Add (+).\nInput their name and send them the invitation link to join the Family.',
        targetElement: 'onboarding-add-member-btn',
        tooltipPosition: 'below-add-button',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'info', section: 'essentialInfo' },
      },
      // Step 4: Household Info - Essentials
      {
        id: 'admin-4',
        currentPage: 'info',
        currentSection: 'essentialInfo',
        title: t['onboarding.admin.4.title'] || 'All about your family',
        description: t['onboarding.admin.4.desc'] || 'Add important information and places here.',
        targetElement: 'onboarding-info-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'meals' },
      },
      // Step 5: Meals
      {
        id: 'admin-5',
        currentPage: 'meals',
        title: t['onboarding.admin.5.title'] || 'Home-cooked meals are the best',
        description: t['onboarding.admin.5.desc'] || 'Set the meal plan and let them know you are eating at home.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'dashboard' },
      },
      // Step 6: Family Board
      {
        id: 'admin-6',
        currentPage: 'dashboard',
        title: t['onboarding.admin.6.title'] || 'Got anything important to share with the rest?',
        description: t['onboarding.admin.6.desc'] || 'Write it down here for everyone to see.',
        targetElement: 'onboarding-family-board',
        tooltipPosition: 'center-near-family-board',
        buttonText: t['onboarding.finish'] || 'Finish',
        action: { type: 'complete' },
      },
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER - 8 steps
  // ─────────────────────────────────────────────────────────────────────────
  if (role === UserRole.HELPER) {
    return [
      // Step 1: Welcome
      {
        id: 'helper-1',
        currentPage: 'dashboard',
        title: t['onboarding.helper.1.title'] || 'Welcome',
        description: t['onboarding.helper.1.desc'] || 'We\'re glad you\'re here! This is your hub for everything about our home and family.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'info', section: 'essentialInfo' },
      },
      // Step 2: Household Info - Essentials
      {
        id: 'helper-2',
        currentPage: 'info',
        currentSection: 'essentialInfo',
        title: t['onboarding.helper.2.title'] || 'Get to know the family',
        description: t['onboarding.helper.2.desc'] || 'Here you\'ll find essential details about our home and important places.',
        targetElement: 'onboarding-info-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'info', section: 'houseRoutine' },
      },
      // Step 3: Household Info - House Routine
      {
        id: 'helper-3',
        currentPage: 'info',
        currentSection: 'houseRoutine',
        title: t['onboarding.helper.3.title'] || 'Get to know the family',
        description: t['onboarding.helper.3.desc'] || 'This covers our family\'s daily routines and shared practices.',
        targetElement: 'onboarding-info-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'todo', section: 'shopping' },
      },
      // Step 4: ToDo - Shopping
      {
        id: 'helper-4',
        currentPage: 'todo',
        currentSection: 'shopping',
        title: t['onboarding.helper.4.title'] || 'Things to buy',
        description: t['onboarding.helper.4.desc'] || 'This is your shopping list.',
        targetElement: 'onboarding-todo-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'todo', section: 'task' },
      },
      // Step 5: ToDo - Tasks
      {
        id: 'helper-5',
        currentPage: 'todo',
        currentSection: 'task',
        title: t['onboarding.helper.5.title'] || 'Things to do',
        description: t['onboarding.helper.5.desc'] || 'This is your task list.',
        targetElement: 'onboarding-todo-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'meals' },
      },
      // Step 6: Meals
      {
        id: 'helper-6',
        currentPage: 'meals',
        title: t['onboarding.helper.6.title'] || 'What to cook',
        description: t['onboarding.helper.6.desc'] || 'This is the family meal plan. View the dishes, see who\'s eating.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'expenses' },
      },
      // Step 7: Expenses
      {
        id: 'helper-7',
        currentPage: 'expenses',
        title: t['onboarding.helper.7.title'] || 'Add receipt',
        description: t['onboarding.helper.7.desc'] || 'Add your receipt here.',
        targetElement: 'onboarding-expenses-fab',
        tooltipPosition: 'bottom-center',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'dashboard' },
      },
      // Step 8: Family Board
      {
        id: 'helper-8',
        currentPage: 'dashboard',
        title: t['onboarding.helper.8.title'] || 'Important note',
        description: t['onboarding.helper.8.desc'] || 'We put a special and important note here.',
        targetElement: 'onboarding-family-board',
        tooltipPosition: 'center-near-family-board',
        buttonText: t['onboarding.finish'] || 'Finish',
        action: { type: 'complete' },
      },
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPOUSE & KIDS (Child/Other) - 4 steps
  // ─────────────────────────────────────────────────────────────────────────
  return [
    // Step 1: Welcome
    {
      id: 'family-1',
      currentPage: 'dashboard',
      title: t['onboarding.family.1.title'] || 'Welcome',
      description: t['onboarding.family.1.desc'] || 'Love it when family members get together! Let\'s see what has been prepared for you.',
      targetElement: null,
      tooltipPosition: 'center-middle',
      buttonText: t['onboarding.next'] || 'Next',
      action: { type: 'navigate', target: 'info', section: 'essentialInfo' },
    },
    // Step 2: Household Info - Essentials
    {
      id: 'family-2',
      currentPage: 'info',
      currentSection: 'essentialInfo',
      title: t['onboarding.family.2.title'] || 'All about your family',
      description: t['onboarding.family.2.desc'] || 'Add important information and places here.',
      targetElement: 'onboarding-info-tabnav',
      tooltipPosition: 'center-near-tabnav',
      buttonText: t['onboarding.next'] || 'Next',
      action: { type: 'navigate', target: 'meals' },
    },
    // Step 3: Meals
    {
      id: 'family-3',
      currentPage: 'meals',
      title: t['onboarding.family.3.title'] || 'Home-cooked meals are the best',
      description: t['onboarding.family.3.desc'] || 'Set the meal plan and let them know you are eating at home.',
      targetElement: null,
      tooltipPosition: 'center-middle',
      buttonText: t['onboarding.next'] || 'Next',
      action: { type: 'navigate', target: 'dashboard' },
    },
    // Step 4: Family Board
    {
      id: 'family-4',
      currentPage: 'dashboard',
      title: t['onboarding.family.4.title'] || 'Got anything important to share with the rest?',
      description: t['onboarding.family.4.desc'] || 'Write it down here for everyone to see.',
      targetElement: 'onboarding-family-board',
      tooltipPosition: 'center-near-family-board',
      buttonText: t['onboarding.finish'] || 'Finish',
      action: { type: 'complete' },
    },
  ];
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface OnboardingOverlayProps {
  stepIndex: number;
  userRole: UserRole;
  currentPage: string;
  currentSection?: string;
  onNext: (action: OnboardingAction) => void;
  onSkip: () => void;
  t: TranslationDictionary;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ 
  stepIndex, 
  userRole, 
  currentPage,
  currentSection,
  onNext, 
  onSkip, 
  t 
}) => {
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const steps = getStepsForRole(userRole, t);
  const currentStep = steps[stepIndex];
  
  // Don't render if no step
  if (!currentStep) return null;
  
  // Check if we're on the correct page
  if (currentStep.currentPage !== currentPage) return null;
  
  // Check if we're on the correct section (if step requires specific section)
  if (currentStep.currentSection && currentStep.currentSection !== currentSection) return null;

  // Position classes for tooltip
  const getPositionClasses = (pos: TooltipPosition) => {
    switch (pos) {
      case 'center-middle':
        return 'inset-0 flex items-center justify-center';
      case 'top-right':
        return 'top-20 right-4 flex items-end justify-end';
      case 'top-left':
        return 'top-36 left-4 flex items-start justify-start';
      case 'below-add-button':
        return 'top-[300px] left-4 flex items-start justify-start';
      case 'center-near-tabnav':
        return 'top-[200px] inset-x-0 flex items-start justify-center';
      case 'bottom-center':
        return 'bottom-44 right-4 flex items-end justify-end';
      case 'center-near-family-board':
        return 'top-[270px] inset-x-0 flex items-start justify-center';
      default:
        return 'inset-0 flex items-center justify-center';
    }
  };

  // Arrow position based on tooltip position
  const getArrowClasses = (pos: TooltipPosition) => {
    switch (pos) {
      case 'top-right': 
        return 'absolute w-4 h-4 bg-card transform rotate-45 -top-2 right-8 border-l border-t border-border';
      case 'top-left':
        return 'absolute w-4 h-4 bg-card transform rotate-45 -top-2 left-8 border-l border-t border-border';
      case 'below-add-button':
        return 'absolute w-4 h-4 bg-card transform rotate-45 -top-2 left-12 border-l border-t border-border';
      case 'center-near-tabnav':
        return 'absolute w-4 h-4 bg-card transform rotate-45 -top-2 left-1/2 -ml-2 border-l border-t border-border';
      case 'bottom-center':
        return 'absolute w-4 h-4 bg-card transform rotate-45 -bottom-2 right-8 border-r border-b border-border';
      case 'center-near-family-board':
        return 'absolute w-4 h-4 bg-card transform rotate-45 -top-2 left-1/2 -ml-2 border-l border-t border-border';
      default:
        return 'hidden';
    }
  };

  // Handle skip with confirmation
  const handleSkipClick = () => {
    setShowSkipConfirm(true);
  };

  const handleConfirmSkip = () => {
    setShowSkipConfirm(false);
    onSkip();
  };

  // Only 2 card sizes: Large (centered, no pointer) or Small (with pointer)
  const isLarge = currentStep.tooltipPosition === 'center-middle';

  // ═══════════════════════════════════════════════════════════════════
  // SKIP CONFIRMATION POPUP
  // ═══════════════════════════════════════════════════════════════════
  if (showSkipConfirm) {
    return (
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
        <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto">
          <div className="bg-card rounded-3xl shadow-2xl p-8 w-[320px] border border-border animate-slide-up relative">
            <h3 className="text-xl font-bold text-foreground mb-3 text-center">
              {t['onboarding.skip_confirm_title'] || 'Skip Tutorial?'}
            </h3>
            <p className="text-body text-muted-foreground leading-relaxed mb-8 text-center">
              {t['onboarding.skip_confirm_desc'] || 'You can redo the tutorial anytime by tapping your profile photo and scrolling down to "Tutorial".'}
            </p>
            <div className="flex flex-col items-center gap-3">
              <button 
                onClick={() => setShowSkipConfirm(false)}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-body shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
              >
                {t['onboarding.skip_confirm_no'] || 'Continue Tutorial'}
              </button>
              <button 
                onClick={handleConfirmSkip}
                className="text-body font-bold text-destructive hover:text-destructive/80 transition-colors py-2"
              >
                {t['onboarding.skip_confirm_yes'] || 'Skip for Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LARGE CARD - Centered modal, no pointer
  // ═══════════════════════════════════════════════════════════════════
  if (isLarge) {
    return (
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
        <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto">
          <div className="bg-card rounded-3xl shadow-2xl p-8 w-[320px] border border-border animate-slide-up relative">
            {/* Close/Skip button */}
            <button
              onClick={handleSkipClick}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-xl font-bold text-foreground mb-3 text-center">
              {currentStep.title}
            </h3>
            <p className="text-body text-muted-foreground leading-relaxed mb-8 text-center whitespace-pre-line">
              {currentStep.description}
            </p>
            <div className="flex flex-col items-center gap-3">
              <button 
                onClick={() => onNext(currentStep.action)}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-body shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {currentStep.buttonText}
                {currentStep.action.type !== 'complete' && <ChevronRight size={18} />}
              </button>
            </div>
            {steps.length > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`rounded-full transition-all ${
                      idx === stepIndex ? 'w-6 h-2 bg-primary' : idx < stepIndex ? 'w-2 h-2 bg-primary/40' : 'w-2 h-2 bg-muted'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SMALL CARD - With pointer
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" />
      <div className={`absolute ${getPositionClasses(currentStep.tooltipPosition)} p-4 pointer-events-auto`}>
        <div className="bg-card rounded-3xl shadow-2xl p-6 w-[280px] relative border border-border animate-slide-up">
          {/* Arrow pointer */}
          <div className={getArrowClasses(currentStep.tooltipPosition)} />

          {/* Close/Skip button */}
          <button
            onClick={handleSkipClick}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors z-20"
          >
            <X size={18} />
          </button>

          <div className="relative z-10">
            <h3 className="text-xl font-bold text-foreground mb-2 pr-8">
              {currentStep.title}
            </h3>
            <p className="text-body text-muted-foreground leading-relaxed mb-6 whitespace-pre-line">
              {currentStep.description}
            </p>
            <div className="flex items-center justify-end">
              <button 
                onClick={() => onNext(currentStep.action)}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-body shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                {currentStep.buttonText}
                {currentStep.action.type !== 'complete' && <ChevronRight size={18} />}
              </button>
            </div>
            {steps.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`rounded-full transition-all ${
                      idx === stepIndex ? 'w-6 h-2 bg-primary' : idx < stepIndex ? 'w-2 h-2 bg-primary/40' : 'w-2 h-2 bg-muted'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
