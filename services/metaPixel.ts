/**
 * Meta Pixel (Facebook Pixel) Service
 * 
 * This service handles Meta Pixel initialization and event tracking.
 * Pixel ID: 1683194409316610
 * 
 * Usage:
 * - initMetaPixel() is called once in index.tsx before React mounts
 * - trackSignupComplete() - for trial signup completion (Lead event)
 * - trackCheckoutInitiated() - when user initiates Stripe checkout
 * - trackPurchase() - when subscription is successfully completed
 * - trackSubscriptionPlanSelection() - when user selects a subscription plan
 */

import ReactPixel from 'react-facebook-pixel';
import { logger } from '../utils/logger';

// Pixel configuration
const PIXEL_ID = '1683194409316610';
const DEBUG_MODE = false; // Set to false in production

// TypeScript types for Meta Pixel events
export interface LeadEventData {
  content_name: string;
  content_category?: string;
  currency: 'HKD';
  value?: number;
}

export interface CheckoutEventData {
  content_name: string;
  content_category: string;
  content_ids?: string[];
  currency: 'HKD';
  value: number;
  num_items?: number;
}

export interface PurchaseEventData {
  content_name: string;
  content_category: string;
  content_ids?: string[];
  currency: 'HKD';
  value: number;
  num_items?: number;
}

export interface SubscriptionEventData {
  content_name: string;
  content_category: string;
  currency: 'HKD';
  value?: number;
  plan?: string;
  period?: string;
}

// Track whether pixel has been initialized
let isPixelInitialized = false;

// Track whether ad blocker is detected
let adBlockerDetected = false;

/**
 * Check if ad blocker is blocking the pixel
 */
const checkAdBlocker = (): boolean => {
  try {
    // Check if fbq function exists (would be blocked by ad blockers)
    const fbq = (window as any).fbq;
    return typeof fbq !== 'function';
  } catch {
    return true;
  }
};

/**
 * Safe wrapper for pixel calls that handles ad blockers
 */
const safePixelCall = <T extends (...args: any[]) => void>(
  fn: T,
  ...args: Parameters<T>
): void => {
  if (adBlockerDetected) {
    logger.log('[MetaPixel] Skipping call - ad blocker detected');
    return;
  }

  try {
    fn(...args);
  } catch (error) {
    // Silently handle errors from ad blockers
    if (!adBlockerDetected) {
      adBlockerDetected = true;
      logger.warn('[MetaPixel] Ad blocker detected, pixel tracking disabled');
    }
  }
};

/**
 * Initialize Meta Pixel
 * Should be called once before React mounts
 */
export const initMetaPixel = (): void => {
  if (isPixelInitialized) {
    logger.log('[MetaPixel] Already initialized, skipping');
    return;
  }

  try {
    // Initialize the pixel
    ReactPixel.init(PIXEL_ID, undefined, {
      autoConfig: true,
      debug: DEBUG_MODE,
    });

    // Check for ad blocker after initialization
    setTimeout(() => {
      adBlockerDetected = checkAdBlocker();
      if (adBlockerDetected) {
        logger.warn('[MetaPixel] Ad blocker detected - pixel events will be skipped');
      }
    }, 100);

    // Skip initial PageView - base pixel code in index.html already tracks it
    // (avoids double-counting and ensures Meta Pixel Helper detects the pixel)

    isPixelInitialized = true;
    logger.log('[MetaPixel] ✅ Initialized successfully with Pixel ID:', PIXEL_ID);
    
    if (DEBUG_MODE) {
      logger.log('[MetaPixel] Debug mode is enabled');
    }
  } catch (error) {
    adBlockerDetected = true;
    logger.warn('[MetaPixel] Failed to initialize (likely ad blocker):', error);
  }
};

/**
 * Track page view
 * Call this on route changes if using React Router
 */
export const trackPageView = (): void => {
  if (!isPixelInitialized) {
    logger.warn('[MetaPixel] Not initialized, skipping PageView');
    return;
  }

  safePixelCall(() => {
    ReactPixel.pageView();
    logger.log('[MetaPixel] PageView tracked');
  });
};

/**
 * Track trial signup completion (Lead event)
 * Call this when a user completes registration/signup
 */
export const trackSignupComplete = (data?: Partial<LeadEventData>): void => {
  if (!isPixelInitialized) {
    logger.warn('[MetaPixel] Not initialized, skipping Lead event');
    return;
  }

  const eventData: LeadEventData = {
    content_name: 'Trial Signup',
    content_category: 'signup',
    currency: 'HKD',
    ...data,
  };

  safePixelCall(() => {
    ReactPixel.track('Lead', eventData);
    logger.log('[MetaPixel] Lead event tracked:', eventData);
  });
};

/**
 * Track checkout initiation
 * Call this when user initiates Stripe checkout
 */
export const trackCheckoutInitiated = (
  plan: string,
  period: string,
  value: number
): void => {
  if (!isPixelInitialized) {
    logger.warn('[MetaPixel] Not initialized, skipping InitiateCheckout event');
    return;
  }

  const eventData: CheckoutEventData = {
    content_name: `${plan.toUpperCase()} Plan - ${period}`,
    content_category: 'subscription',
    content_ids: [`${plan}_${period}`],
    currency: 'HKD',
    value,
    num_items: 1,
  };

  safePixelCall(() => {
    ReactPixel.track('InitiateCheckout', eventData);
    logger.log('[MetaPixel] InitiateCheckout event tracked:', eventData);
  });
};

/**
 * Track successful purchase/subscription
 * Call this when subscription is successfully completed (after Stripe return)
 */
export const trackPurchase = (
  plan: string,
  period: string,
  value: number
): void => {
  if (!isPixelInitialized) {
    logger.warn('[MetaPixel] Not initialized, skipping Purchase event');
    return;
  }

  const eventData: PurchaseEventData = {
    content_name: `${plan.toUpperCase()} Plan - ${period}`,
    content_category: 'subscription',
    content_ids: [`${plan}_${period}`],
    currency: 'HKD',
    value,
    num_items: 1,
  };

  safePixelCall(() => {
    ReactPixel.track('Purchase', eventData);
    logger.log('[MetaPixel] Purchase event tracked:', eventData);
  });
};

/**
 * Track subscription plan selection
 * Call this when user selects a subscription plan (before checkout)
 */
export const trackSubscriptionPlanSelection = (
  plan: string,
  period: string,
  value?: number
): void => {
  if (!isPixelInitialized) {
    logger.warn('[MetaPixel] Not initialized, skipping custom event');
    return;
  }

  const eventData: SubscriptionEventData = {
    content_name: `${plan.toUpperCase()} Plan - ${period}`,
    content_category: 'subscription',
    currency: 'HKD',
    plan,
    period,
    value,
  };

  safePixelCall(() => {
    ReactPixel.trackCustom('SubscriptionPlanSelected', eventData);
    logger.log('[MetaPixel] SubscriptionPlanSelected event tracked:', eventData);
  });
};

/**
 * Track custom event
 * Generic function for tracking custom events
 */
export const trackCustomEvent = (
  eventName: string,
  data?: Record<string, any>
): void => {
  if (!isPixelInitialized) {
    logger.warn('[MetaPixel] Not initialized, skipping custom event:', eventName);
    return;
  }

  safePixelCall(() => {
    ReactPixel.trackCustom(eventName, data);
    logger.log(`[MetaPixel] Custom event "${eventName}" tracked:`, data);
  });
};

// Export pixel status for debugging
export const getPixelStatus = (): { initialized: boolean; adBlockerDetected: boolean } => ({
  initialized: isPixelInitialized,
  adBlockerDetected,
});
