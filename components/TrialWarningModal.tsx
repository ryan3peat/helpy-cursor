// components/TrialWarningModal.tsx
// ============================================================================
// Trial Warning Modal - Shows warnings for trial expiry (Day 13 & 14)
// ============================================================================

import React from 'react';
import { createPortal } from 'react-dom';
import { Clock, Sparkles, X } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';
import { useSheetTheme } from '../hooks/useSheetTheme';
import type { TranslationDictionary } from '../types';
import type { TrialStatus } from '../services/trialService';

interface TrialWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  trialStatus: TrialStatus;
  t: TranslationDictionary;
  /** 'warning' for day 13, 'expired' for day 14, 'full_expired' for day 15+ */
  variant: 'warning' | 'expired' | 'full_expired';
}

export const TrialWarningModal: React.FC<TrialWarningModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  trialStatus,
  t,
  variant,
}) => {
  useScrollLock(isOpen);
  useSheetTheme(isOpen);

  if (!isOpen) return null;

  const getContent = () => {
    switch (variant) {
      case 'warning':
        // Day 13 - Warning that trial ends tomorrow
        return {
          icon: <Clock size={32} className="text-amber-500" />,
          iconBg: 'bg-amber-100',
          title: t['trial.warning_title'] || 'Trial Ending Soon',
          message: t['trial.warning_day13'] || 'Your free trial of premium features ends tomorrow!',
          subMessage: t['trial.upgrade_prompt'] || 'Subscribe to continue using AI receipt scanning, spending summaries, and helper management.',
          primaryButton: t['trial.upgrade_button'] || 'View Plans',
          secondaryButton: t['trial.continue_button'] || 'Continue',
          showSecondary: true,
        };
      case 'expired':
        // Day 14 - Last day notification
        return {
          icon: <Clock size={32} className="text-orange-500" />,
          iconBg: 'bg-orange-100',
          title: t['trial.expiring_today_title'] || 'Trial Ends Today',
          message: t['trial.warning_day14'] || 'Your free trial ends today. Subscribe to keep access to premium features.',
          subMessage: t['trial.upgrade_prompt'] || 'Subscribe to continue using AI receipt scanning, spending summaries, and helper management.',
          primaryButton: t['trial.upgrade_button'] || 'View Plans',
          secondaryButton: t['trial.continue_button'] || 'Continue',
          showSecondary: true,
        };
      case 'full_expired':
        // Day 15+ - Trial fully ended
        return {
          icon: <Sparkles size={32} className="text-primary" />,
          iconBg: 'bg-primary/10',
          title: t['trial.expired_title'] || 'Trial Ended',
          message: t['trial.expired'] || 'Your free trial has ended.',
          subMessage: t['trial.expired_upgrade_prompt'] || 'Upgrade to Core or Pro to unlock AI receipt scanning, spending summaries, and helper management.',
          primaryButton: t['trial.upgrade_button'] || 'View Plans',
          secondaryButton: t['common.close'] || 'Close',
          showSecondary: true,
        };
    }
  };

  const content = getContent();

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card w-full max-w-sm rounded-2xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex justify-end p-3">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 text-center">
          {/* Icon */}
          <div className={`w-16 h-16 mx-auto rounded-full ${content.iconBg} flex items-center justify-center mb-4`}>
            {content.icon}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-2">
            {content.title}
          </h2>

          {/* Message */}
          <p className="text-body font-medium text-foreground mb-2">
            {content.message}
          </p>

          {/* Sub-message */}
          <p className="text-caption text-muted-foreground mb-6">
            {content.subMessage}
          </p>

          {/* Trial days remaining badge (for warning variant) */}
          {variant === 'warning' && trialStatus.daysRemaining > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-6">
              <Clock size={14} />
              {(t['trial.days_remaining'] || '{days} days remaining').replace('{days}', trialStatus.daysRemaining.toString())}
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                onUpgrade();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-body shadow-sm hover:opacity-90 transition-opacity"
            >
              {content.primaryButton}
            </button>

            {content.showSecondary && (
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium text-body hover:bg-secondary/80 transition-colors"
              >
                {content.secondaryButton}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TrialWarningModal;
