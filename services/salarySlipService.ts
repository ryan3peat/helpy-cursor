// services/salarySlipService.ts
// ============================================================================
// Salary Slip Service - CRUD operations for helper contracts and salary slips
// ============================================================================

import { supabase as defaultSupabase, diagnoseJwtToken } from './supabase';
import { getAuthenticatedSupabaseClient, refreshSupabaseToken } from '../contexts/SupabaseContext';
import { getCachedSupabaseUuid, getSupabaseUserId } from './supabaseService';
import { logger } from '../utils/logger';
import type { 
  HelperContract, 
  CreateHelperContract,
  SalarySlip, 
  CreateSalarySlip,
  SalarySlipWithHelper 
} from '@src/types/helperManagement';

/**
 * Get the best available Supabase client.
 * Prefers authenticated client with JWT (for RLS), falls back to default.
 */
function getSupabase() {
  const authClient = getAuthenticatedSupabaseClient();
  if (!authClient) {
    logger.warn('[salarySlipService] No authenticated client available, using default (may fail RLS)');
  }
  return authClient || defaultSupabase;
}

/**
 * Check if an error is JWT/auth related and should trigger a retry.
 * 
 * IMPORTANT: Be AGGRESSIVE in detecting auth errors. The cost of retrying
 * unnecessarily is low, but the cost of NOT retrying an auth error (user
 * sees "Failed to save" and has to logout/login) is high.
 */
function isJwtError(error: any): boolean {
  if (!error) return false;
  
  // Check HTTP status codes
  if (error.status === 401 || error.status === 403) return true;
  
  // Check Supabase/PostgREST error codes
  if (error.code === 'PGRST303') return true; // JWT expired
  if (error.code === 'PGRST301') return true; // JWT required
  if (error.code === '42501') return true; // RLS/permission error - often auth related
  if (error.code === '28000') return true; // Invalid authorization
  if (error.code === '28P01') return true; // Invalid password (auth failure)
  
  // Check error message for auth-related keywords
  const message = (error.message || '').toLowerCase();
  const hint = (error.hint || '').toLowerCase();
  const details = (error.details || '').toLowerCase();
  const combined = `${message} ${hint} ${details}`;
  
  // JWT-related
  if (combined.includes('jwt')) return true;
  if (combined.includes('token')) return true;
  
  // Auth-related
  if (combined.includes('auth')) return true;
  if (combined.includes('unauthorized')) return true;
  if (combined.includes('forbidden')) return true;
  if (combined.includes('permission')) return true;
  if (combined.includes('not allowed')) return true;
  if (combined.includes('access denied')) return true;
  
  // Session-related
  if (combined.includes('session')) return true;
  if (combined.includes('expired')) return true;
  
  // RLS policy errors
  if (combined.includes('policy')) return true;
  if (combined.includes('rls')) return true;
  if (combined.includes('row-level security')) return true;
  
  return false;
}

// Wrapper that uses authenticated client for all operations
const supabase = {
  from: (table: string) => {
    const client = getSupabase();
    logger.log('[salarySlipService] Using Supabase client for table:', table);
    return client.from(table);
  },
};

/**
 * Convert a user ID (Clerk ID or UUID) to Supabase UUID
 * All database operations require UUIDs, not Clerk IDs
 * 
 * FIXED: Now uses database lookup as fallback if cache is not populated yet.
 * Returns null if resolution fails (caller should handle gracefully).
 */
async function toSupabaseUuid(userId: string, householdId: string): Promise<string | null> {
  // First try cache (fast path)
  const cached = getCachedSupabaseUuid(userId);
  
  // If cache returned a valid UUID, use it
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cached);
  if (isValidUuid) {
    return cached;
  }
  
  // If cache didn't have it (or returned Clerk ID), query database
  logger.warn(`[salarySlipService] Cache miss for ${userId}, attempting database lookup...`);
  
  try {
    const uuid = await getSupabaseUserId(userId, householdId);
    
    if (!uuid) {
      logger.warn(`[salarySlipService] Database lookup returned null for ${userId}. Cache may not be populated yet.`);
      return null;
    }
    
    logger.warn(`[salarySlipService] Successfully resolved ${userId} to UUID ${uuid}`);
    return uuid;
  } catch (err) {
    logger.error(`[salarySlipService] Database lookup error for ${userId}:`, err);
    return null;
  }
}

// ============================================================================
// HELPER CONTRACTS
// ============================================================================

/**
 * Get helper contract for a specific helper
 * Returns null if helper UUID cannot be resolved (cache not populated yet)
 */
export async function getHelperContract(
  helperId: string,
  householdId: string
): Promise<HelperContract | null> {
  const helperUuid = await toSupabaseUuid(helperId, householdId);
  
  // If UUID resolution failed, return null (cache not ready yet)
  if (!helperUuid) {
    logger.log('[salarySlipService] getHelperContract: UUID resolution failed, returning null');
    return null;
  }
  
  const { data, error } = await supabase
    .from('helper_contracts')
    .select('*')
    .eq('user_id', helperUuid)
    .eq('household_id', householdId)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  if (!data) return null;
  
  return mapContractFromDb(data);
}

/**
 * Get all helper contracts for a household
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function getHelperContracts(
  householdId: string
): Promise<HelperContract[]> {
  let { data, error } = await supabase
    .from('helper_contracts')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on getHelperContracts, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('helper_contracts')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ getHelperContracts retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ getHelperContracts retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  const contracts = (data || []).map(mapContractFromDb);
  
  // DIAGNOSTIC: If no contracts returned, check if this is a token issue
  if (contracts.length === 0) {
    logger.warn(`[salarySlipService] ⚠️ getHelperContracts returned 0 results for household ${householdId}`);
    logger.warn(`[salarySlipService] This could be normal (no helpers) or a JWT/RLS issue.`);
    
    // Run JWT diagnostic to capture token state
    const jwtDiag = await diagnoseJwtToken('getHelperContracts - Empty Result');
    
    if (!jwtDiag.clerkId) {
      logger.error(`[salarySlipService] 🚨 EMPTY HELPER CONTRACTS WITH MISSING clerk_id - USER NEEDS TO RE-LOGIN!`);
    }
  }
  
  return contracts;
}

/**
 * Create a new helper contract
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function createHelperContract(
  contract: CreateHelperContract
): Promise<HelperContract> {
  const helperUuid = await toSupabaseUuid(contract.userId, contract.householdId);
  
  if (!helperUuid) {
    throw new Error('Could not resolve helper user ID. Please try again.');
  }
  
  const insertData = {
    user_id: helperUuid,
    household_id: contract.householdId,
    status: contract.status || 'active',
    employment_start_date: contract.employmentStartDate,
    base_salary: contract.baseSalary,
    food_allowance: contract.foodAllowance || 0,
  };
  
  let { data, error } = await supabase
    .from('helper_contracts')
    .insert(insertData)
    .select()
    .single();

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on createHelperContract, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('helper_contracts')
        .insert(insertData)
        .select()
        .single();
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ createHelperContract retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ createHelperContract retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Helper contract created:', data.id);
  return mapContractFromDb(data);
}

/**
 * Update a helper contract
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function updateHelperContract(
  contractId: string,
  updates: Partial<CreateHelperContract>
): Promise<HelperContract> {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.employmentStartDate !== undefined) updateData.employment_start_date = updates.employmentStartDate;
  if (updates.baseSalary !== undefined) updateData.base_salary = updates.baseSalary;
  if (updates.foodAllowance !== undefined) updateData.food_allowance = updates.foodAllowance;
  
  let { data, error } = await supabase
    .from('helper_contracts')
    .update(updateData)
    .eq('id', contractId)
    .select()
    .single();

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on updateHelperContract, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('helper_contracts')
        .update(updateData)
        .eq('id', contractId)
        .select()
        .single();
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ updateHelperContract retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ updateHelperContract retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Helper contract updated:', contractId);
  return mapContractFromDb(data);
}

/**
 * Delete a helper contract
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function deleteHelperContract(contractId: string): Promise<void> {
  let { error } = await supabase
    .from('helper_contracts')
    .delete()
    .eq('id', contractId);

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on deleteHelperContract, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('helper_contracts')
        .delete()
        .eq('id', contractId);
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ deleteHelperContract retry successful after token refresh');
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ deleteHelperContract retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Helper contract deleted:', contractId);
}

// ============================================================================
// SALARY SLIPS
// ============================================================================

/**
 * Get all salary slips for a helper
 * Returns empty array if helper UUID cannot be resolved (cache not populated yet)
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function getSalarySlips(
  helperId: string,
  householdId: string
): Promise<SalarySlip[]> {
  const helperUuid = await toSupabaseUuid(helperId, householdId);
  
  // If UUID resolution failed, return empty (cache not ready yet)
  if (!helperUuid) {
    logger.log('[salarySlipService] getSalarySlips: UUID resolution failed, returning empty');
    return [];
  }
  
  let { data, error } = await supabase
    .from('salary_slips')
    .select('*')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .order('payment_period_start', { ascending: false });

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on getSalarySlips, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('salary_slips')
        .select('*')
        .eq('helper_id', helperUuid)
        .eq('household_id', householdId)
        .order('payment_period_start', { ascending: false });
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ getSalarySlips retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ getSalarySlips retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  return (data || []).map(mapSlipFromDb);
}

/**
 * Get all salary slips for a household (for admin view)
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function getAllSalarySlips(
  householdId: string
): Promise<SalarySlip[]> {
  let { data, error } = await supabase
    .from('salary_slips')
    .select('*')
    .eq('household_id', householdId)
    .order('payment_period_start', { ascending: false });

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on getAllSalarySlips, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('salary_slips')
        .select('*')
        .eq('household_id', householdId)
        .order('payment_period_start', { ascending: false });
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ getAllSalarySlips retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ getAllSalarySlips retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  const slips = (data || []).map(mapSlipFromDb);
  
  // DIAGNOSTIC: If no salary slips returned, check if this is a token issue
  if (slips.length === 0) {
    logger.warn(`[salarySlipService] ⚠️ getAllSalarySlips returned 0 results for household ${householdId}`);
    logger.warn(`[salarySlipService] This could be normal (no slips exist) or a JWT/RLS issue.`);
    
    // Run JWT diagnostic to capture token state
    const jwtDiag = await diagnoseJwtToken('getAllSalarySlips - Empty Result');
    
    if (!jwtDiag.clerkId) {
      logger.error(`[salarySlipService] 🚨 EMPTY SALARY SLIPS WITH MISSING clerk_id - USER NEEDS TO RE-LOGIN!`);
    }
  }
  
  return slips;
}

/**
 * Get a single salary slip by ID
 */
export async function getSalarySlip(slipId: string): Promise<SalarySlip | null> {
  const { data, error } = await supabase
    .from('salary_slips')
    .select('*')
    .eq('id', slipId)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  
  return mapSlipFromDb(data);
}

/**
 * Create a new salary slip
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function createSalarySlip(
  slip: CreateSalarySlip
): Promise<SalarySlip> {
  const helperUuid = await toSupabaseUuid(slip.helperId, slip.householdId);
  
  if (!helperUuid) {
    throw new Error('Could not resolve helper user ID. Please try again.');
  }
  
  // Resolve creator UUID if provided
  let creatorUuid: string | null = null;
  if (slip.createdBy) {
    creatorUuid = await toSupabaseUuid(slip.createdBy, slip.householdId);
    if (!creatorUuid) {
      throw new Error('Could not resolve creator user ID. Please try again.');
    }
  }
  
  // Resolve signer UUID if provided
  let signerUuid: string | null = null;
  if (slip.employerSignerId) {
    signerUuid = await toSupabaseUuid(slip.employerSignerId, slip.householdId);
    if (!signerUuid) {
      throw new Error('Could not resolve signer user ID. Please try again.');
    }
  }
  
  const insertData = {
    household_id: slip.householdId,
    helper_id: helperUuid,
    contract_id: slip.contractId || null,
    payment_period_start: slip.paymentPeriodStart,
    payment_period_end: slip.paymentPeriodEnd,
    base_salary: slip.baseSalary,
    food_allowance: slip.foodAllowance,
    extra_salary: slip.extraSalary,
    salary_deduction: slip.salaryDeduction,
    total_payout: slip.totalPayout,
    note: slip.note || null,
    employer_signer_id: signerUuid,
    employer_signer_name: slip.employerSignerName || null,
    created_by: creatorUuid,
  };
  
  let { data, error } = await supabase
    .from('salary_slips')
    .insert(insertData)
    .select()
    .single();

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on createSalarySlip, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('salary_slips')
        .insert(insertData)
        .select()
        .single();
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ createSalarySlip retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ createSalarySlip retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Salary slip created:', data.id);
  return mapSlipFromDb(data);
}

/**
 * Update a salary slip (for editing before signing)
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function updateSalarySlip(
  slipId: string,
  updates: Partial<CreateSalarySlip>
): Promise<SalarySlip> {
  // Fetch the slip first to get householdId for UUID conversion
  const { data: existingSlip, error: fetchError } = await supabase
    .from('salary_slips')
    .select('household_id')
    .eq('id', slipId)
    .single();
  
  if (fetchError) throw fetchError;
  if (!existingSlip) throw new Error(`Salary slip ${slipId} not found`);
  
  const updateData: Record<string, any> = {};
  
  if (updates.paymentPeriodStart !== undefined) updateData.payment_period_start = updates.paymentPeriodStart;
  if (updates.paymentPeriodEnd !== undefined) updateData.payment_period_end = updates.paymentPeriodEnd;
  if (updates.baseSalary !== undefined) updateData.base_salary = updates.baseSalary;
  if (updates.foodAllowance !== undefined) updateData.food_allowance = updates.foodAllowance;
  if (updates.extraSalary !== undefined) updateData.extra_salary = updates.extraSalary;
  if (updates.salaryDeduction !== undefined) updateData.salary_deduction = updates.salaryDeduction;
  if (updates.totalPayout !== undefined) updateData.total_payout = updates.totalPayout;
  if (updates.note !== undefined) updateData.note = updates.note;
  if (updates.employerSignerId !== undefined) {
    if (updates.employerSignerId) {
      const signerUuid = await toSupabaseUuid(updates.employerSignerId, existingSlip.household_id);
      if (!signerUuid) {
        throw new Error('Could not resolve signer user ID. Please try again.');
      }
      updateData.employer_signer_id = signerUuid;
    } else {
      updateData.employer_signer_id = null;
    }
  }
  if (updates.employerSignerName !== undefined) updateData.employer_signer_name = updates.employerSignerName;
  
  let { data, error } = await supabase
    .from('salary_slips')
    .update(updateData)
    .eq('id', slipId)
    .select()
    .single();

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on updateSalarySlip, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('salary_slips')
        .update(updateData)
        .eq('id', slipId)
        .select()
        .single();
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ updateSalarySlip retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ updateSalarySlip retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Salary slip updated:', slipId);
  return mapSlipFromDb(data);
}

/**
 * Delete a salary slip
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function deleteSalarySlip(slipId: string): Promise<void> {
  let { error } = await supabase
    .from('salary_slips')
    .delete()
    .eq('id', slipId);

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on deleteSalarySlip, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('salary_slips')
        .delete()
        .eq('id', slipId);
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ deleteSalarySlip retry successful after token refresh');
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ deleteSalarySlip retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Salary slip deleted:', slipId);
}

/**
 * Sign a salary slip as employer
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function signAsEmployer(
  slipId: string,
  signerId: string,
  signerName: string
): Promise<SalarySlip> {
  // First check if already signed and get householdId
  const { data: existing, error: fetchError } = await supabase
    .from('salary_slips')
    .select('employer_signed_at, household_id')
    .eq('id', slipId)
    .single();
  
  if (fetchError) throw fetchError;
    
  if (existing?.employer_signed_at) {
    throw new Error('Salary slip already signed by employer');
  }
  
  const signerUuid = await toSupabaseUuid(signerId, existing.household_id);
  
  if (!signerUuid) {
    throw new Error('Could not resolve signer user ID. Please try again.');
  }
  
  const updateData = {
    employer_signer_id: signerUuid,
    employer_signer_name: signerName,
    employer_signed_at: new Date().toISOString(),
  };
  
  let { data, error } = await supabase
    .from('salary_slips')
    .update(updateData)
    .eq('id', slipId)
    .select()
    .single();

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on signAsEmployer, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('salary_slips')
        .update(updateData)
        .eq('id', slipId)
        .select()
        .single();
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ signAsEmployer retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ signAsEmployer retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Salary slip signed by employer:', slipId);
  return mapSlipFromDb(data);
}

/**
 * Sign a salary slip as helper
 * @param slipId - The salary slip ID
 * @param currentUserId - The current user's ID (Clerk ID or Supabase UUID)
 * Includes JWT retry logic for self-healing on token expiration
 */
export async function signAsHelper(slipId: string, currentUserId: string): Promise<SalarySlip> {
  // First check if already signed AND verify the current user is the helper for this slip
  const { data: existing, error: fetchError } = await supabase
    .from('salary_slips')
    .select('helper_signed_at, helper_id, household_id')
    .eq('id', slipId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const currentUserUuid = await toSupabaseUuid(currentUserId, existing.household_id);
  
  if (!currentUserUuid) {
    throw new Error('Could not resolve user ID. Please try again.');
  }
  
  // SECURITY: Verify the current user IS the helper for this salary slip
  if (existing?.helper_id !== currentUserUuid) {
    throw new Error('Only the assigned helper can sign their own salary slip');
  }
    
  if (existing?.helper_signed_at) {
    throw new Error('Salary slip already signed by helper');
  }
  
  const updateData = {
    helper_signed_at: new Date().toISOString(),
  };
  
  let { data, error } = await supabase
    .from('salary_slips')
    .update(updateData)
    .eq('id', slipId)
    .select()
    .single();

  // SELF-HEALING: If JWT error, refresh token and retry ONCE
  if (error && isJwtError(error)) {
    logger.warn('[salarySlipService] ⚠️ JWT error on signAsHelper, refreshing token and retrying...');
    try {
      await refreshSupabaseToken();
      
      const retryResult = await getSupabase()
        .from('salary_slips')
        .update(updateData)
        .eq('id', slipId)
        .select()
        .single();
      
      if (!retryResult.error) {
        logger.log('[salarySlipService] ✅ signAsHelper retry successful after token refresh');
        data = retryResult.data;
        error = null;
      } else {
        logger.error('[salarySlipService] ❌ signAsHelper retry also failed:', retryResult.error);
        error = retryResult.error;
      }
    } catch (refreshError) {
      logger.error('[salarySlipService] ❌ Token refresh failed:', refreshError);
    }
  }
    
  if (error) throw error;
  
  logger.log('[salarySlipService] ✅ Salary slip signed by helper:', slipId);
  return mapSlipFromDb(data);
}

/**
 * Check if user has permission to create/manage salary slips
 * Only SuperAdmin, Admin, and Spouse can manage
 */
export function canManageSalarySlips(userRole: string): boolean {
  return ['SuperAdmin', 'Admin', 'Spouse'].includes(userRole);
}

/**
 * Check if a contract exists for a helper
 */
export async function hasContract(
  helperId: string,
  householdId: string
): Promise<boolean> {
  const contract = await getHelperContract(helperId, householdId);
  return contract !== null;
}

// ============================================================================
// REALTIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to real-time changes for helper contracts
 * This ensures all household members see updates to employment details immediately
 * Includes retry logic for initial fetch and proper status handling
 */
export function subscribeToHelperContracts(
  householdId: string,
  callback: (data: HelperContract[]) => void
): () => void {
  logger.log(`🔔 [salarySlipService] Subscribing to helper_contracts for household ${householdId}`);
  
  // Initial fetch with retry
  const fetchWithRetry = async (retryCount = 0) => {
    try {
      const data = await getHelperContracts(householdId);
      callback(data);
      logger.log('[salarySlipService] ✅ Initial helper_contracts fetch successful');
    } catch (err) {
      logger.error('[salarySlipService] Initial helper_contracts fetch failed:', err);
      // Retry once after 1 second if this was the first attempt
      if (retryCount === 0) {
        logger.log('[salarySlipService] 🔄 Retrying initial helper_contracts fetch in 1s...');
        setTimeout(() => fetchWithRetry(1), 1000);
      }
    }
  };
  
  fetchWithRetry();

  // Subscribe to changes via realtime
  const channelName = `helper-contracts-${householdId}`;
  
  const subscription = getSupabase()
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'helper_contracts',
        filter: `household_id=eq.${householdId}`,
      },
      (payload: any) => {
        logger.log(`🔄 [salarySlipService] Real-time ${payload.eventType} on helper_contracts`);
        // Refetch on any change to get complete data with proper RLS
        getHelperContracts(householdId)
          .then(callback)
          .catch(err => logger.error('[salarySlipService] helper_contracts refetch failed:', err));
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        logger.log(`📡 [salarySlipService] ✅ helper_contracts subscription active`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logger.warn(`📡 [salarySlipService] ⚠️ helper_contracts subscription ${status}:`, err);
        // The App.tsx useEffect watches tokenRefreshCount and will re-create subscriptions
      } else {
        logger.log(`📡 [salarySlipService] helper_contracts subscription status: ${status}`);
      }
    });

  // Return unsubscribe function
  return () => {
    logger.log(`🔕 [salarySlipService] Unsubscribing from helper_contracts`);
    subscription.unsubscribe();
  };
}

/**
 * Subscribe to real-time changes for salary slips
 * This ensures all household members see new salary slips immediately
 * Includes retry logic for initial fetch and proper status handling
 */
export function subscribeToSalarySlips(
  householdId: string,
  callback: (data: SalarySlip[]) => void
): () => void {
  logger.log(`🔔 [salarySlipService] Subscribing to salary_slips for household ${householdId}`);
  
  // Initial fetch with retry
  const fetchWithRetry = async (retryCount = 0) => {
    try {
      const data = await getAllSalarySlips(householdId);
      callback(data);
      logger.log('[salarySlipService] ✅ Initial salary_slips fetch successful');
    } catch (err) {
      logger.error('[salarySlipService] Initial salary_slips fetch failed:', err);
      // Retry once after 1 second if this was the first attempt
      if (retryCount === 0) {
        logger.log('[salarySlipService] 🔄 Retrying initial salary_slips fetch in 1s...');
        setTimeout(() => fetchWithRetry(1), 1000);
      }
    }
  };
  
  fetchWithRetry();

  // Subscribe to changes via realtime
  const channelName = `salary-slips-${householdId}`;
  
  const subscription = getSupabase()
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'salary_slips',
        filter: `household_id=eq.${householdId}`,
      },
      (payload: any) => {
        logger.log(`🔄 [salarySlipService] Real-time ${payload.eventType} on salary_slips`);
        // Refetch on any change to get complete data with proper RLS
        getAllSalarySlips(householdId)
          .then(callback)
          .catch(err => logger.error('[salarySlipService] salary_slips refetch failed:', err));
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        logger.log(`📡 [salarySlipService] ✅ salary_slips subscription active`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logger.warn(`📡 [salarySlipService] ⚠️ salary_slips subscription ${status}:`, err);
        // The App.tsx useEffect watches tokenRefreshCount and will re-create subscriptions
      } else {
        logger.log(`📡 [salarySlipService] salary_slips subscription status: ${status}`);
      }
    });

  // Return unsubscribe function
  return () => {
    logger.log(`🔕 [salarySlipService] Unsubscribing from salary_slips`);
    subscription.unsubscribe();
  };
}

// ============================================================================
// DATA MAPPING HELPERS
// ============================================================================

function mapContractFromDb(row: any): HelperContract {
  return {
    id: row.id,
    userId: row.user_id,
    householdId: row.household_id,
    status: row.status,
    employmentStartDate: row.employment_start_date,
    baseSalary: row.base_salary,
    foodAllowance: row.food_allowance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSlipFromDb(row: any): SalarySlip {
  return {
    id: row.id,
    householdId: row.household_id,
    helperId: row.helper_id,
    contractId: row.contract_id,
    paymentPeriodStart: row.payment_period_start,
    paymentPeriodEnd: row.payment_period_end,
    baseSalary: row.base_salary,
    foodAllowance: row.food_allowance || 0,
    extraSalary: row.extra_salary,
    salaryDeduction: row.salary_deduction,
    totalPayout: row.total_payout,
    note: row.note,
    employerSignerId: row.employer_signer_id,
    employerSignerName: row.employer_signer_name,
    employerSignedAt: row.employer_signed_at,
    helperSignedAt: row.helper_signed_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

