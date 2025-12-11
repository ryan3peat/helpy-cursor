import React from 'react';
import { ChevronRight } from 'lucide-react';
import { TranslationDictionary, UserRole } from '../types';

// Action types for onboarding steps
type OnboardingAction = 
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
  allowSkip: boolean;
}

// Role-based step configurations
const getStepsForRole = (role: UserRole, t: TranslationDictionary): OnboardingStep[] => {
  // Admin steps - Full onboarding tour
  if (role === UserRole.MASTER) {
    return [
      // Part 1: Add Family Members
      {
        id: '1.1',
        currentPage: 'dashboard',
        title: t['onboarding.admin.1.1.title'] || 'Welcome',
        description: t['onboarding.admin.1.1.desc'] || 'This is your home command center! First, let\'s add your family members.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'none' },
        allowSkip: false,
      },
      {
        id: '1.2',
        currentPage: 'dashboard',
        title: t['onboarding.admin.1.2.title'] || 'Add Family Members',
        description: t['onboarding.admin.1.2.desc'] || 'Tap your profile icon.',
        targetElement: 'onboarding-profile-btn',
        tooltipPosition: 'top-right',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'profile' },
        allowSkip: false,
      },
      {
        id: '1.3',
        currentPage: 'profile',
        title: t['onboarding.admin.1.3.title'] || 'Add Family Members',
        description: t['onboarding.admin.1.3.desc'] || 'Tap Add (+).',
        targetElement: 'onboarding-add-member-btn',
        tooltipPosition: 'below-add-button',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'dashboard' },
        allowSkip: false,
      },
      // Part 2: App Tour
      {
        id: '2.1',
        currentPage: 'dashboard',
        title: t['onboarding.admin.2.1.title'] || 'Welcome',
        description: t['onboarding.admin.2.1.desc'] || 'We\'re glad you\'re here! This is your hub for everything about our home and family.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'info', section: 'essentialInfo' },
        allowSkip: false,
      },
      {
        id: '2.2',
        currentPage: 'info',
        currentSection: 'essentialInfo',
        title: t['onboarding.admin.2.2.title'] || 'Get to Know the Family',
        description: t['onboarding.admin.2.2.desc'] || 'Here you\'ll find essential details about our home and important places.',
        targetElement: 'onboarding-info-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'info', section: 'houseRoutine' },
        allowSkip: false,
      },
      {
        id: '2.3',
        currentPage: 'info',
        currentSection: 'houseRoutine',
        title: t['onboarding.admin.2.3.title'] || 'Get to Know the Family',
        description: t['onboarding.admin.2.3.desc'] || 'This covers our family\'s daily routines and shared practices.',
        targetElement: 'onboarding-info-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'todo', section: 'shopping' },
        allowSkip: false,
      },
      {
        id: '2.4',
        currentPage: 'todo',
        currentSection: 'shopping',
        title: t['onboarding.admin.2.4.title'] || 'Things to Buy',
        description: t['onboarding.admin.2.4.desc'] || 'This is your shopping list.',
        targetElement: 'onboarding-todo-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'todo', section: 'task' },
        allowSkip: false,
      },
      {
        id: '2.5',
        currentPage: 'todo',
        currentSection: 'task',
        title: t['onboarding.admin.2.5.title'] || 'Things to Do',
        description: t['onboarding.admin.2.5.desc'] || 'This is your task list.',
        targetElement: 'onboarding-todo-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'meals' },
        allowSkip: false,
      },
      // Part 3: Meals
      {
        id: '3.1',
        currentPage: 'meals',
        title: t['onboarding.admin.3.1.title'] || 'What to Cook',
        description: t['onboarding.admin.3.1.desc'] || 'This is the family meal plan. View the dishes, see who\'s eating.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'expenses' },
        allowSkip: false,
      },
      // Part 4: Expenses
      {
        id: '4.1',
        currentPage: 'expenses',
        title: t['onboarding.admin.4.1.title'] || 'Add Receipt',
        description: t['onboarding.admin.4.1.desc'] || 'Add your receipt here.',
        targetElement: 'onboarding-expenses-fab',
        tooltipPosition: 'bottom-center',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'dashboard' },
        allowSkip: false,
      },
      // Part 5: Family Board
      {
        id: '5.1',
        currentPage: 'dashboard',
        title: t['onboarding.admin.5.1.title'] || 'Important Note',
        description: t['onboarding.admin.5.1.desc'] || 'We put special and important note here.',
        targetElement: 'onboarding-family-board',
        tooltipPosition: 'center-near-family-board',
        buttonText: t['onboarding.ok'] || 'OK',
        action: { type: 'complete' },
        allowSkip: false,
      },
    ];
  }

  // Spouse steps (same as Admin)
  if (role === UserRole.SPOUSE) {
    return [
      {
        id: '1.1',
        currentPage: 'dashboard',
        title: t['onboarding.spouse.1.1.title'] || 'Welcome',
        description: t['onboarding.spouse.1.1.desc'] || 'This is your home command center! First, let\'s add your family members.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'none' },
        allowSkip: false,
      },
      {
        id: '1.2',
        currentPage: 'dashboard',
        title: t['onboarding.spouse.1.2.title'] || 'Add Family Members',
        description: t['onboarding.spouse.1.2.desc'] || 'Tap your profile icon.',
        targetElement: 'onboarding-profile-btn',
        tooltipPosition: 'top-right',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'profile' },
        allowSkip: false,
      },
      {
        id: '1.3',
        currentPage: 'profile',
        title: t['onboarding.spouse.1.3.title'] || 'Add Family Members',
        description: t['onboarding.spouse.1.3.desc'] || 'Tap Add (+).',
        targetElement: 'onboarding-add-member-btn',
        tooltipPosition: 'below-add-button',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'dashboard' },
        allowSkip: false,
      },
      {
        id: '2.1',
        currentPage: 'dashboard',
        title: t['onboarding.spouse.2.1.title'] || 'Welcome',
        description: t['onboarding.spouse.2.1.desc'] || 'We\'re glad you\'re here! This is your hub for everything about our home and family.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'info', section: 'essentialInfo' },
        allowSkip: false,
      },
      {
        id: '2.2',
        currentPage: 'info',
        currentSection: 'essentialInfo',
        title: t['onboarding.spouse.2.2.title'] || 'Get to Know the Family',
        description: t['onboarding.spouse.2.2.desc'] || 'Here you\'ll find essential details about our home and important places.',
        targetElement: 'onboarding-info-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'info', section: 'houseRoutine' },
        allowSkip: false,
      },
      {
        id: '2.3',
        currentPage: 'info',
        currentSection: 'houseRoutine',
        title: t['onboarding.spouse.2.3.title'] || 'Get to Know the Family',
        description: t['onboarding.spouse.2.3.desc'] || 'This covers our family\'s daily routines and shared practices.',
        targetElement: 'onboarding-info-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'todo', section: 'shopping' },
        allowSkip: false,
      },
      {
        id: '2.4',
        currentPage: 'todo',
        currentSection: 'shopping',
        title: t['onboarding.spouse.2.4.title'] || 'Things to Buy',
        description: t['onboarding.spouse.2.4.desc'] || 'This is your shopping list.',
        targetElement: 'onboarding-todo-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'todo', section: 'task' },
        allowSkip: false,
      },
      {
        id: '2.5',
        currentPage: 'todo',
        currentSection: 'task',
        title: t['onboarding.spouse.2.5.title'] || 'Things to Do',
        description: t['onboarding.spouse.2.5.desc'] || 'This is your task list.',
        targetElement: 'onboarding-todo-tabnav',
        tooltipPosition: 'center-near-tabnav',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'meals' },
        allowSkip: false,
      },
      // Part 3: Meals
      {
        id: '3.1',
        currentPage: 'meals',
        title: t['onboarding.spouse.3.1.title'] || 'What to Cook',
        description: t['onboarding.spouse.3.1.desc'] || 'This is the family meal plan. View the dishes, see who\'s eating.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'expenses' },
        allowSkip: false,
      },
      // Part 4: Expenses
      {
        id: '4.1',
        currentPage: 'expenses',
        title: t['onboarding.spouse.4.1.title'] || 'Add Receipt',
        description: t['onboarding.spouse.4.1.desc'] || 'Add your receipt here.',
        targetElement: 'onboarding-expenses-fab',
        tooltipPosition: 'bottom-center',
        buttonText: t['onboarding.next'] || 'Next',
        action: { type: 'navigate', target: 'dashboard' },
        allowSkip: false,
      },
      // Part 5: Family Board
      {
        id: '5.1',
        currentPage: 'dashboard',
        title: t['onboarding.spouse.5.1.title'] || 'Important Note',
        description: t['onboarding.spouse.5.1.desc'] || 'We put special and important note here.',
        targetElement: 'onboarding-family-board',
        tooltipPosition: 'center-near-family-board',
        buttonText: t['onboarding.ok'] || 'OK',
        action: { type: 'complete' },
        allowSkip: false,
      },
    ];
  }

  // Helper steps (different flow - focus on tasks)
  if (role === UserRole.HELPER) {
    return [
      {
        id: '1.1',
        currentPage: 'dashboard',
        title: t['onboarding.helper.1.1.title'] || 'Welcome',
        description: t['onboarding.helper.1.1.desc'] || 'Welcome to your household! Here you can see your daily tasks and meals.',
        targetElement: null,
        tooltipPosition: 'center-middle',
        buttonText: t['onboarding.got_it'] || 'Got it',
        action: { type: 'complete' },
        allowSkip: true,
      },
    ];
  }

  // Child/Other - simple welcome
  return [
    {
      id: '1.1',
      currentPage: 'dashboard',
      title: t['onboarding.default.1.1.title'] || 'Welcome',
      description: t['onboarding.default.1.1.desc'] || 'Welcome to your family app!',
      targetElement: null,
      tooltipPosition: 'center-middle',
      buttonText: t['onboarding.got_it'] || 'Got it',
      action: { type: 'complete' },
      allowSkip: true,
    },
  ];
};

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
        // Position just below the "Add" label text
        return 'top-[300px] left-4 flex items-start justify-start';
      case 'center-near-tabnav':
        return 'top-[200px] inset-x-0 flex items-start justify-center';
      case 'bottom-center':
        // Positioned above the FAB (FAB is at bottom-28 right-6)
        return 'bottom-44 right-4 flex items-end justify-end';
      case 'center-near-family-board':
        // Positioned right below the Family Board card
        return 'top-[220px] inset-x-0 flex items-start justify-center';
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
        // Arrow pointing DOWN-RIGHT at the FAB
        return 'absolute w-4 h-4 bg-card transform rotate-45 -bottom-2 right-8 border-r border-b border-border';
      case 'center-near-family-board':
        // Arrow pointing UP at the Family Board
        return 'absolute w-4 h-4 bg-card transform rotate-45 -top-2 left-1/2 -ml-2 border-l border-t border-border';
          default:
        return 'hidden';
    }
  };

  // Only 2 card sizes: Large (centered, no pointer) or Small (with pointer)
  const isLarge = currentStep.tooltipPosition === 'center-middle';

  // ═══════════════════════════════════════════════════════════════════
  // LARGE CARD - Centered modal, no pointer
  // ═══════════════════════════════════════════════════════════════════
  if (isLarge) {
    return (
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
        <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto">
          <div className="bg-card rounded-3xl shadow-2xl p-8 w-[320px] border border-border animate-slide-up relative">
            <h3 className="text-xl font-bold text-foreground mb-3 text-center">
              {currentStep.title}
            </h3>
            <p className="text-body text-muted-foreground leading-relaxed mb-8 text-center">
              {currentStep.description}
            </p>
            <div className="flex flex-col items-center gap-3">
              <button 
                onClick={() => onNext(currentStep.action)}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-body shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {currentStep.buttonText}
                <ChevronRight size={18} />
              </button>
              {currentStep.allowSkip && (
                <button 
                  onClick={onSkip}
                  className="text-body font-bold text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  {t['onboarding.skip'] || 'Skip'}
                </button>
              )}
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

              <div className="relative z-10">
            <h3 className="text-xl font-bold text-foreground mb-2">
              {currentStep.title}
                  </h3>
            <p className="text-body text-muted-foreground leading-relaxed mb-6">
              {currentStep.description}
            </p>
            <div className="flex items-center justify-between gap-4">
              {currentStep.allowSkip ? (
                <button 
                  onClick={onSkip}
                  className="text-body font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t['onboarding.skip'] || 'Skip'}
                </button>
              ) : (
                <div />
              )}
                      <button 
                onClick={() => onNext(currentStep.action)}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-body shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center gap-2"
                      >
                {currentStep.buttonText}
                <ChevronRight size={18} />
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
