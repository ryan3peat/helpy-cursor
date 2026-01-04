/**
 * NotificationPrompt Component
 * 
 * Shows a first-launch notification prompt to users after they:
 * 1. Install Helpy as a PWA (standalone mode)
 * 2. Log in and land on the Dashboard
 * 
 * This prompt only shows:
 * - In PWA mode (not browser)
 * - Once per device per user (tracked in localStorage)
 * - If user hasn't already enabled notifications
 * - After a cooldown if previously dismissed
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { 
  isRunningAsPwa, 
  hasBeenPromptedForNotifications, 
  markAsPromptedForNotifications,
  isPromptDismissed,
  dismissPromptTemporarily
} from '../utils/pwaUtils';
import { 
  isPushSupported, 
  getNotificationPermission,
  subscribeToPush
} from '../services/pushNotificationService';
import type { User, TranslationDictionary } from '../types';

interface NotificationPromptProps {
  currentUser: User;
  t: TranslationDictionary;
  onNotificationEnabled?: () => void;
  /** Whether onboarding is active - if true, don't show the notification prompt */
  isOnboardingActive?: boolean;
}

const NotificationPrompt: React.FC<NotificationPromptProps> = ({
  currentUser,
  t,
  onNotificationEnabled,
  isOnboardingActive = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    // Don't show during onboarding - wait until it's complete
    if (isOnboardingActive) {
      setIsVisible(false);
      return;
    }
    
    // Check all conditions for showing the prompt
    const shouldShow = checkShouldShowPrompt();
    
    if (shouldShow) {
      // Small delay to let Dashboard load first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUser.id, isOnboardingActive]);

  /**
   * Check all conditions to determine if prompt should show
   */
  function checkShouldShowPrompt(): boolean {
    // 1. Must be running as PWA
    if (!isRunningAsPwa()) {
      console.log('[NotifPrompt] Not showing: not running as PWA');
      return false;
    }

    // 2. Must support push notifications
    if (!isPushSupported()) {
      console.log('[NotifPrompt] Not showing: push not supported');
      return false;
    }

    // 3. Check if permission is already granted or denied
    const permission = getNotificationPermission();
    if (permission === 'granted') {
      console.log('[NotifPrompt] Not showing: permission already granted');
      return false;
    }
    if (permission === 'denied') {
      console.log('[NotifPrompt] Not showing: permission was denied');
      return false;
    }

    // 4. Check if already prompted on this device for this user
    if (hasBeenPromptedForNotifications(currentUser.id)) {
      console.log('[NotifPrompt] Not showing: already prompted on this device');
      return false;
    }

    // 5. Check if temporarily dismissed
    if (isPromptDismissed(currentUser.id)) {
      console.log('[NotifPrompt] Not showing: dismissed recently');
      return false;
    }

    // 6. Check if user is a Child (they can't receive notifications)
    if (currentUser.role === 'Child') {
      console.log('[NotifPrompt] Not showing: user is a Child');
      return false;
    }

    console.log('[NotifPrompt] Showing prompt for user:', currentUser.id);
    return true;
  }

  /**
   * Handle Enable button click
   */
  async function handleEnable() {
    setIsEnabling(true);
    
    try {
      // Mark as prompted (even if they cancel the OS dialog)
      markAsPromptedForNotifications(currentUser.id);
      
      // Subscribe to push (this will trigger OS permission dialog)
      const subscription = await subscribeToPush(
        currentUser.id,
        currentUser.householdId
      );
      
      if (subscription) {
        console.log('[NotifPrompt] Successfully enabled notifications');
        onNotificationEnabled?.();
      } else {
        console.log('[NotifPrompt] Subscription failed or was denied');
      }
    } catch (error) {
      console.error('[NotifPrompt] Error enabling notifications:', error);
    } finally {
      setIsEnabling(false);
      setIsVisible(false);
    }
  }

  /**
   * Handle Not Now button click
   */
  function handleDismiss() {
    // Dismiss for 24 hours
    dismissPromptTemporarily(currentUser.id, 24);
    setIsVisible(false);
  }

  /**
   * Handle close button (X) click - same as dismiss
   */
  function handleClose() {
    handleDismiss();
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
            <Bell size={32} className="text-primary" />
          </div>

          {/* Title */}
          <h2 className="text-title font-bold text-foreground mb-2">
            {t['notifications.prompt_title'] || 'Stay in the loop'}
          </h2>

          {/* Description */}
          <p className="text-body text-muted-foreground mb-6">
            {t['notifications.prompt_description'] || 'Get notified when family members add items, complete tasks, or plan meals.'}
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleEnable}
              disabled={isEnabling}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-body transition-colors shadow-sm disabled:opacity-50"
            >
              {isEnabling 
                ? (t['common.enabling'] || 'Enabling...') 
                : (t['notifications.enable'] || 'Enable Notifications')
              }
            </button>
            
            <button
              onClick={handleDismiss}
              disabled={isEnabling}
              className="w-full py-3 text-muted-foreground font-medium text-body transition-colors disabled:opacity-50"
            >
              {t['common.not_now'] || 'Not Now'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NotificationPrompt;

