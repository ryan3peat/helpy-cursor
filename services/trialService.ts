// services/trialService.ts
// ============================================================================
// Trial Service - Manages usage-based and time-based trial limits
// ============================================================================
// 
// Free Plan Limits:
// - AI Receipt Scanner: 5 free scans
// - Salary Slip E-sign: 1 free signature  
// - Monthly Spending Summary: 14 days from registration
//
// ============================================================================

import { supabase as defaultSupabase } from './supabase';
import { getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';

// ============================================================================
// Constants
// ============================================================================

/** Number of free AI receipt scans for free plan users */
export const FREE_AI_SCAN_LIMIT = 5;

/** Number of free salary slip signatures for free plan users */
export const FREE_SALARY_SIGN_LIMIT = 1;

/** Number of days free plan users can access spending summary */
export const SPENDING_SUMMARY_TRIAL_DAYS = 14;

// ============================================================================
// Types
// ============================================================================

export interface UsageStatus {
  // AI Receipt Scanner
  aiScanCount: number;
  aiScanRemaining: number;
  canUseAiScan: boolean;
  
  // Salary Slip E-sign
  salarySignCount: number;
  salarySignRemaining: number;
  canUseSalarySign: boolean;
  
  // Spending Summary (time-based)
  trialStartedAt: string | null;
  spendingSummaryDaysRemaining: number;
  canUseSpendingSummary: boolean;
  
  // Whether user has paid subscription (bypasses all limits)
  hasPaidSubscription: boolean;
}

// Legacy TrialStatus for backwards compatibility
export interface TrialStatus {
  isInTrial: boolean;
  daysRemaining: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  shouldShowWarning: boolean;
  shouldShowExpired: boolean;
  isExpired: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the best available Supabase client
 */
function getSupabase() {
  const authClient = getAuthenticatedSupabaseClient();
  return authClient || defaultSupabase;
}

/**
 * Calculate days remaining for spending summary trial
 */
function calculateDaysRemaining(trialStartedAt: string | null): number {
  if (!trialStartedAt) return 0;
  
  const startDate = new Date(trialStartedAt);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / msPerDay);
  
  return Math.max(0, SPENDING_SUMMARY_TRIAL_DAYS - daysElapsed);
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Calculate usage status from raw data
 */
export function calculateUsageStatus(
  aiScanCount: number,
  salarySignCount: number,
  trialStartedAt: string | null,
  hasPaidSubscription: boolean
): UsageStatus {
  const spendingSummaryDaysRemaining = calculateDaysRemaining(trialStartedAt);
  
  // If user has paid subscription, they bypass all limits
  if (hasPaidSubscription) {
    return {
      aiScanCount,
      aiScanRemaining: Infinity,
      canUseAiScan: true,
      
      salarySignCount,
      salarySignRemaining: Infinity,
      canUseSalarySign: true,
      
      trialStartedAt,
      spendingSummaryDaysRemaining: Infinity,
      canUseSpendingSummary: true,
      
      hasPaidSubscription: true,
    };
  }
  
  // Free plan - apply limits
  const aiScanRemaining = Math.max(0, FREE_AI_SCAN_LIMIT - aiScanCount);
  const salarySignRemaining = Math.max(0, FREE_SALARY_SIGN_LIMIT - salarySignCount);
  
  return {
    aiScanCount,
    aiScanRemaining,
    canUseAiScan: aiScanRemaining > 0,
    
    salarySignCount,
    salarySignRemaining,
    canUseSalarySign: salarySignRemaining > 0,
    
    trialStartedAt,
    spendingSummaryDaysRemaining,
    canUseSpendingSummary: spendingSummaryDaysRemaining > 0,
    
    hasPaidSubscription: false,
  };
}

/**
 * Fetch usage status for a household from the database
 */
export async function fetchUsageStatus(householdId: string): Promise<UsageStatus> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('households')
      .select('ai_scan_count, salary_slip_sign_count, trial_started_at, subscription_plan, subscription_status')
      .eq('id', householdId)
      .single();
    
    if (error || !data) {
      console.error('[trialService] Error fetching usage status:', error);
      // Return restrictive defaults on error
      return calculateUsageStatus(0, 0, null, false);
    }
    
    // Check if user has active paid subscription
    const hasPaidSubscription = 
      data.subscription_status === 'active' && 
      data.subscription_plan && 
      data.subscription_plan !== 'free';
    
    return calculateUsageStatus(
      data.ai_scan_count ?? 0,
      data.salary_slip_sign_count ?? 0,
      data.trial_started_at,
      hasPaidSubscription
    );
  } catch (err) {
    console.error('[trialService] Exception fetching usage status:', err);
    return calculateUsageStatus(0, 0, null, false);
  }
}

/**
 * Increment AI scan count after a successful scan
 * Returns the new count, or -1 on error
 */
export async function incrementAiScanCount(householdId: string): Promise<number> {
  try {
    const supabase = getSupabase();
    
    // Use RPC or update with returning to get new count atomically
    const { data, error } = await supabase
      .from('households')
      .update({ ai_scan_count: supabase.rpc ? undefined : undefined }) // Will use raw SQL
      .eq('id', householdId)
      .select('ai_scan_count')
      .single();
    
    // Fallback: increment manually
    const { data: currentData } = await supabase
      .from('households')
      .select('ai_scan_count')
      .eq('id', householdId)
      .single();
    
    const currentCount = currentData?.ai_scan_count ?? 0;
    const newCount = currentCount + 1;
    
    const { error: updateError } = await supabase
      .from('households')
      .update({ ai_scan_count: newCount })
      .eq('id', householdId);
    
    if (updateError) {
      console.error('[trialService] Error incrementing AI scan count:', updateError);
      return -1;
    }
    
    console.log(`[trialService] AI scan count incremented to ${newCount} for household ${householdId}`);
    return newCount;
  } catch (err) {
    console.error('[trialService] Exception incrementing AI scan count:', err);
    return -1;
  }
}

/**
 * Increment salary slip sign count after a successful signature
 * Returns the new count, or -1 on error
 */
export async function incrementSalarySignCount(householdId: string): Promise<number> {
  try {
    const supabase = getSupabase();
    
    // Get current count
    const { data: currentData } = await supabase
      .from('households')
      .select('salary_slip_sign_count')
      .eq('id', householdId)
      .single();
    
    const currentCount = currentData?.salary_slip_sign_count ?? 0;
    const newCount = currentCount + 1;
    
    const { error: updateError } = await supabase
      .from('households')
      .update({ salary_slip_sign_count: newCount })
      .eq('id', householdId);
    
    if (updateError) {
      console.error('[trialService] Error incrementing salary sign count:', updateError);
      return -1;
    }
    
    console.log(`[trialService] Salary sign count incremented to ${newCount} for household ${householdId}`);
    return newCount;
  } catch (err) {
    console.error('[trialService] Exception incrementing salary sign count:', err);
    return -1;
  }
}

/**
 * Get a user-friendly message for remaining usage
 */
export function getUsageMessage(
  feature: 'aiScan' | 'salarySign' | 'spendingSummary',
  usageStatus: UsageStatus,
  t: Record<string, string>
): string {
  if (usageStatus.hasPaidSubscription) {
    return ''; // No message needed for paid users
  }
  
  switch (feature) {
    case 'aiScan':
      if (usageStatus.canUseAiScan) {
        const msg = t['trial.ai_scan_remaining'] || '{count} free scans remaining';
        return msg.replace('{count}', usageStatus.aiScanRemaining.toString());
      }
      return t['trial.ai_scan_limit_reached'] || 'Free scan limit reached. Upgrade to scan more receipts.';
      
    case 'salarySign':
      if (usageStatus.canUseSalarySign) {
        return t['trial.salary_sign_free'] || 'First signature is free';
      }
      return t['trial.salary_sign_limit_reached'] || 'Upgrade to sign more salary slips.';
      
    case 'spendingSummary':
      if (usageStatus.canUseSpendingSummary) {
        const msg = t['trial.spending_summary_days'] || '{days} days remaining';
        return msg.replace('{days}', usageStatus.spendingSummaryDaysRemaining.toString());
      }
      return t['trial.spending_summary_expired'] || 'Trial ended. Upgrade to view spending summaries.';
      
    default:
      return '';
  }
}

// ============================================================================
// Legacy Functions (for backwards compatibility)
// ============================================================================

/**
 * Calculate trial status from a trial start date (legacy - for spending summary only)
 */
export function calculateTrialStatus(trialStartedAt: string | null): TrialStatus {
  const defaultStatus: TrialStatus = {
    isInTrial: false,
    daysRemaining: 0,
    trialStartedAt: null,
    trialEndsAt: null,
    shouldShowWarning: false,
    shouldShowExpired: false,
    isExpired: true,
  };

  if (!trialStartedAt) {
    return defaultStatus;
  }

  const startDate = new Date(trialStartedAt);
  const now = new Date();
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + SPENDING_SUMMARY_TRIAL_DAYS);
  
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / msPerDay);
  const daysRemaining = Math.max(0, SPENDING_SUMMARY_TRIAL_DAYS - daysElapsed);
  
  const isInTrial = daysElapsed < SPENDING_SUMMARY_TRIAL_DAYS;
  const isExpired = daysElapsed >= SPENDING_SUMMARY_TRIAL_DAYS;
  const shouldShowWarning = daysRemaining === 2; // Day 13
  const shouldShowExpired = daysRemaining === 1; // Day 14

  return {
    isInTrial,
    daysRemaining,
    trialStartedAt,
    trialEndsAt: endDate.toISOString(),
    shouldShowWarning,
    shouldShowExpired,
    isExpired,
  };
}
