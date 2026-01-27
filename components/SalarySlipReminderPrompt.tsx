/**
 * SalarySlipReminderPrompt Component
 * 
 * Shows a one-time notification to admin and spouse users who have NOT
 * created a salary slip for January 2026.
 * 
 * This prompt:
 * - Only shows to Admin/Spouse users who are activated (not pending)
 * - Only shows if there are helpers in the household
 * - Only shows if no salary slip exists for January 2026
 * - Shows "Remind me Later" (next app open), "Dismiss" (7 days), or "Show me how"
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X } from 'lucide-react';
import { 
  getSalarySlipReminderState, 
  setSalarySlipReminderState,
  SalarySlipReminderAction
} from '../utils/pwaUtils';
import type { User, TranslationDictionary } from '../types';
import { UserRole } from '../types';
import type { SalarySlip } from '@src/types/helperManagement';
import { logger } from '../utils/logger';

interface SalarySlipReminderPromptProps {
  currentUser: User;
  users: User[];
  salarySlips: SalarySlip[];
  t: TranslationDictionary;
  /** Whether onboarding is active - if true, don't show the prompt */
  isOnboardingActive?: boolean;
  /** Callback when "Show me how" is clicked - navigate to Family > Helper and open Create Salary Slip */
  onShowMeHow: () => void;
  /** Callback when visibility changes */
  onVisibilityChange?: (isVisible: boolean) => void;
}

const SalarySlipReminderPrompt: React.FC<SalarySlipReminderPromptProps> = ({
  currentUser,
  users,
  salarySlips,
  t,
  isOnboardingActive = false,
  onShowMeHow,
  onVisibilityChange
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Notify parent when visibility changes
  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  useEffect(() => {
    // Don't show during onboarding
    if (isOnboardingActive) {
      setIsVisible(false);
      return;
    }
    
    // Check all conditions for showing the prompt
    const shouldShow = checkShouldShowPrompt();
    
    if (shouldShow) {
      // Small delay to let the page load first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentUser, users, salarySlips, isOnboardingActive]);

  /**
   * Check all conditions to determine if prompt should show
   */
  function checkShouldShowPrompt(): boolean {
    // 1. Must be Admin or Spouse role
    const isAdminOrSpouse = currentUser.role === UserRole.MASTER || 
                            currentUser.role === UserRole.SUPERADMIN ||
                            currentUser.role === UserRole.SPOUSE;
    if (!isAdminOrSpouse) {
      logger.log('[SalarySlipReminder] Not showing: user is not Admin/Spouse');
      return false;
    }

    // 2. User must be activated (not pending)
    if (currentUser.status === 'pending') {
      logger.log('[SalarySlipReminder] Not showing: user is pending activation');
      return false;
    }

    // 3. Must have helpers in the household
    const helpers = users.filter(u => u.role === UserRole.HELPER);
    if (helpers.length === 0) {
      logger.log('[SalarySlipReminder] Not showing: no helpers in household');
      return false;
    }

    // 4. Check if we're in the right time period (late January 2026)
    // We show this notification in the last ~10 days of January 2026
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = January)
    const currentDay = now.getDate();
    
    // Only show in January 2026, day 20 onwards (last ~10 days)
    if (currentYear !== 2026 || currentMonth !== 0 || currentDay < 20) {
      logger.log('[SalarySlipReminder] Not showing: not in late January 2026');
      return false;
    }

    // 5. Check if salary slip already exists for January 2026
    // January 2026 dates: payment period containing any dates in 2026-01
    const hasJanuary2026Slip = salarySlips.some(slip => {
      const periodStart = new Date(slip.paymentPeriodStart);
      const periodEnd = new Date(slip.paymentPeriodEnd);
      
      // Check if the payment period overlaps with January 2026
      const jan2026Start = new Date(2026, 0, 1); // January 1, 2026
      const jan2026End = new Date(2026, 0, 31); // January 31, 2026
      
      // Overlaps if: periodStart <= jan2026End && periodEnd >= jan2026Start
      return periodStart <= jan2026End && periodEnd >= jan2026Start;
    });

    if (hasJanuary2026Slip) {
      logger.log('[SalarySlipReminder] Not showing: January 2026 salary slip already exists');
      return false;
    }

    // 6. Check localStorage state
    const reminderState = getSalarySlipReminderState(currentUser.id);
    
    if (reminderState.dismissed) {
      // Check if 7 days have passed since dismissal
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() < reminderState.dismissedAt + sevenDaysMs) {
        logger.log('[SalarySlipReminder] Not showing: dismissed less than 7 days ago');
        return false;
      }
    }

    // If "remind later" was selected, we should show it (that's the intended behavior)
    // If never shown before, show it
    
    logger.log('[SalarySlipReminder] Showing prompt for user:', currentUser.id);
    return true;
  }

  /**
   * Handle "Show me how" button click
   */
  function handleShowMeHow() {
    // Mark as shown
    setSalarySlipReminderState(currentUser.id, 'show_me_how');
    setIsVisible(false);
    onShowMeHow();
  }

  /**
   * Handle "Remind me Later" button click
   */
  function handleRemindLater() {
    // Clear the reminder state so it shows next time the app is opened
    setSalarySlipReminderState(currentUser.id, 'remind_later');
    setIsVisible(false);
  }

  /**
   * Handle "Dismiss" button click
   */
  function handleDismiss() {
    // Dismiss for 7 days
    setSalarySlipReminderState(currentUser.id, 'dismiss');
    setIsVisible(false);
  }

  /**
   * Handle close button (X) click - same as remind later
   */
  function handleClose() {
    handleRemindLater();
  }

  // Don't render anything if not visible
  if (!isVisible) {
    return null;
  }

  // Render the prompt as a portal to ensure it's above everything
  return createPortal(
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center px-4"
      onClick={handleClose}
    >
      <div 
        className="bg-card w-full max-w-sm rounded-2xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute z-10 right-4 top-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-muted-foreground"
          style={{ position: 'absolute' }}
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FileText size={32} className="text-primary" />
          </div>

          {/* Title */}
          <h2 className="text-title font-bold text-foreground mb-2">
            {t['salary_reminder.title'] || "Don't forget!"}
          </h2>

          {/* Description */}
          <p className="text-body font-medium text-muted-foreground mb-6">
            {t['salary_reminder.description'] || "It's nearly the end of the month, use Helpy to create a salary slip for your helper that can be e-signed!"}
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleShowMeHow}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-body transition-colors shadow-sm"
            >
              {t['salary_reminder.show_me_how'] || 'Show me how'}
            </button>
            
            <button
              onClick={handleRemindLater}
              className="w-full py-3 text-muted-foreground font-medium text-body transition-colors"
            >
              {t['salary_reminder.remind_later'] || 'Remind me Later'}
            </button>
            
            <button
              onClick={handleDismiss}
              className="w-full py-2 text-muted-foreground/70 font-medium text-caption transition-colors"
            >
              {t['common.dismiss'] || 'Dismiss'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SalarySlipReminderPrompt;
