import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Loader2, Check, Send } from 'lucide-react';
import { resendInvite } from '../../services/inviteService';
import type { User, TranslationDictionary } from '../../types';
import { UserRole } from '../../types';
import { logger } from '../../utils/logger';

interface PendingHelperBannerProps {
  users: User[];
  currentUser: User;
  householdId: string;
  t: TranslationDictionary;
  /** Called when invite link is successfully generated */
  onInviteLinkGenerated?: (link: string, helperName: string) => void;
}

// LocalStorage key for dismissed helpers (per household)
const getDismissedKey = (householdId: string) => `helpy_dismissed_pending_helpers_${householdId}`;

/**
 * PendingHelperBanner Component
 * 
 * Shows a notification banner when there are helpers in the household
 * who have been invited but haven't activated their account yet.
 * 
 * Features:
 * - Only shows for Admin/SuperAdmin/Spouse roles (who can manage invites)
 * - Shows for each pending helper (one at a time)
 * - "Resend" button regenerates invite link
 * - "Dismiss" button hides the notification (stored in localStorage)
 * - Dismissal is per-helper and resets if the helper is re-invited
 */
const PendingHelperBanner: React.FC<PendingHelperBannerProps> = ({
  users,
  currentUser,
  householdId,
  t,
  onInviteLinkGenerated,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedHelpers, setDismissedHelpers] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(getDismissedKey(householdId));
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Only Admin, SuperAdmin, and Spouse can manage invites
  const canManageInvites = 
    currentUser.role === UserRole.MASTER || 
    currentUser.role === UserRole.SUPERADMIN || 
    currentUser.role === UserRole.SPOUSE;

  // Find pending helpers that haven't been dismissed
  const pendingHelpers = users.filter(
    user => 
      user.role === UserRole.HELPER && 
      user.status === 'pending' &&
      !dismissedHelpers.has(user.id)
  );

  // Get the first pending helper to show (one at a time)
  const pendingHelper = pendingHelpers[0];

  // Persist dismissed helpers to localStorage
  useEffect(() => {
    if (dismissedHelpers.size > 0) {
      localStorage.setItem(
        getDismissedKey(householdId),
        JSON.stringify([...dismissedHelpers])
      );
    }
  }, [dismissedHelpers, householdId]);

  // Don't render if user can't manage invites or no pending helpers
  if (!canManageInvites || !pendingHelper) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      const result = await resendInvite(pendingHelper.id, householdId);
      
      logger.log('[PendingHelperBanner] Invite resent for:', pendingHelper.name);
      setResendSuccess(true);
      
      // Notify parent about the invite link if callback provided
      if (onInviteLinkGenerated && result.inviteLink) {
        onInviteLinkGenerated(result.inviteLink, pendingHelper.name);
      }
      
      // Auto-dismiss after success (with delay for user to see success state)
      setTimeout(() => {
        handleDismiss();
      }, 2000);
    } catch (err) {
      logger.error('[PendingHelperBanner] Failed to resend invite:', err);
      setError(t['notification.resend_error'] || 'Failed to resend invite. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setDismissedHelpers(prev => {
      const newSet = new Set(prev);
      newSet.add(pendingHelper.id);
      return newSet;
    });
    setError(null);
    setResendSuccess(false);
  };

  // Format the message with helper name
  const message = (t['notification.pending_helper'] || 'Oh no! It looks like {name} has not activated their account yet. Would you like to resend the invite?')
    .replace('{name}', pendingHelper.name);

  return (
    <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
      {/* Header with icon and dismiss button */}
      <div className="flex items-start gap-3">
        <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
        
        <div className="flex-1 min-w-0">
          {/* Message */}
          <p className="text-body font-medium text-amber-800 dark:text-amber-200">
            {message}
          </p>
          
          {/* Error message */}
          {error && (
            <p className="mt-2 text-body font-medium text-destructive">
              {error}
            </p>
          )}
          
          {/* Success message */}
          {resendSuccess && (
            <p className="mt-2 text-body font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check size={16} />
              {t['notification.resend_success'] || 'Invite resent successfully!'}
            </p>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleResend}
              disabled={isResending || resendSuccess}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-body font-semibold transition-colors disabled:opacity-50"
            >
              {isResending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t['common.processing'] || 'Processing...'}</span>
                </>
              ) : resendSuccess ? (
                <>
                  <Check size={16} />
                  <span>{t['common.done'] || 'Done'}</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>{t['notification.resend'] || 'Resend'}</span>
                </>
              )}
            </button>
            
            <button
              onClick={handleDismiss}
              disabled={isResending}
              className="px-4 py-2 text-muted-foreground text-body font-medium transition-colors disabled:opacity-50"
            >
              {t['common.dismiss'] || 'Dismiss'}
            </button>
          </div>
        </div>
        
        {/* Close button */}
        <button
          onClick={handleDismiss}
          disabled={isResending}
          className="text-amber-600/60 dark:text-amber-400/60 transition-colors flex-shrink-0 disabled:opacity-50"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PendingHelperBanner;
