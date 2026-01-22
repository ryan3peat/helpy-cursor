// components/UsageLimitModal.tsx
// ============================================================================
// Usage Limit Modal - Shows when user has reached usage limits
// ============================================================================

import React from 'react';
import { createPortal } from 'react-dom';
import { Camera, FileSignature, PieChart, X } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';
import { useSheetTheme } from '../hooks/useSheetTheme';
import type { TranslationDictionary, UsageStatus } from '../types';
import { FREE_AI_SCAN_LIMIT, FREE_SALARY_SIGN_LIMIT } from '../services/trialService';

interface UsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  usageStatus: UsageStatus;
  feature: 'aiScan' | 'salarySign' | 'spendingSummary';
  t: TranslationDictionary;
}

export const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  usageStatus,
  feature,
  t,
}) => {
  useScrollLock(isOpen);
  useSheetTheme(isOpen);

  if (!isOpen) return null;

  const getContent = () => {
    switch (feature) {
      case 'aiScan':
        return {
          icon: <Camera size={32} className="text-primary" />,
          iconBg: 'bg-primary/10',
          title: t['trial.ai_scan_upgrade_title'] || 'Scan Limit Reached',
          message: (t['trial.ai_scan_limit_reached'] || 'You\'ve used all {limit} free scans').replace('{limit}', FREE_AI_SCAN_LIMIT.toString()),
          subMessage: t['trial.ai_scan_upgrade_desc'] || 'Upgrade to Core or Pro for unlimited receipt scanning.',
          usageText: `${usageStatus.aiScanCount} / ${FREE_AI_SCAN_LIMIT} scans used`,
        };
      case 'salarySign':
        return {
          icon: <FileSignature size={32} className="text-primary" />,
          iconBg: 'bg-primary/10',
          title: t['trial.salary_sign_upgrade_title'] || 'Upgrade Required',
          message: t['trial.salary_sign_limit_reached'] || 'Free signature used',
          subMessage: t['trial.salary_sign_upgrade_desc'] || 'Upgrade to Core or Pro to sign more salary slips.',
          usageText: `${usageStatus.salarySignCount} / ${FREE_SALARY_SIGN_LIMIT} signature used`,
        };
      case 'spendingSummary':
        return {
          icon: <PieChart size={32} className="text-primary" />,
          iconBg: 'bg-primary/10',
          title: t['trial.spending_summary_upgrade_title'] || 'Trial Ended',
          message: t['trial.spending_summary_expired'] || 'Spending summary trial ended',
          subMessage: t['trial.spending_summary_upgrade_desc'] || 'Upgrade to Core or Pro to view monthly spending summaries.',
          usageText: usageStatus.spendingSummaryDaysRemaining > 0 
            ? `${usageStatus.spendingSummaryDaysRemaining} days remaining`
            : 'Trial expired',
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
          <p className="text-body text-foreground mb-2">
            {content.message}
          </p>

          {/* Sub-message */}
          <p className="text-caption text-muted-foreground mb-4">
            {content.subMessage}
          </p>

          {/* Usage indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium mb-6">
            {content.usageText}
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                onUpgrade();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-body shadow-sm hover:opacity-90 transition-opacity"
            >
              {t['trial.upgrade_button'] || 'View Plans'}
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium text-body hover:bg-secondary/80 transition-colors"
            >
              {t['common.close'] || 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UsageLimitModal;
