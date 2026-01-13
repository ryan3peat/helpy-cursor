// services/salarySlipService.ts
// ============================================================================
// Salary Slip Service - CRUD operations for helper contracts and salary slips
// ============================================================================

import { supabase as defaultSupabase } from './supabase';
import { getAuthenticatedSupabaseClient, refreshSupabaseToken } from '../contexts/SupabaseContext';
import { getCachedSupabaseUuid } from './supabaseService';
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
    console.warn('[salarySlipService] No authenticated client available, using default (may fail RLS)');
  }
  return authClient || defaultSupabase;
}

/**
 * Check if an error is JWT/auth related and should trigger a retry
 */
function isJwtError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'PGRST303') return true;
  const message = error.message?.toLowerCase() || '';
  if (message.includes('jwt expired')) return true;
  if (message.includes('jwt') && message.includes('expired')) return true;
  if (message.includes('invalid jwt')) return true;
  if (error.code === '42501' && message.includes('policy')) return true;
  return false;
}

// Wrapper that uses authenticated client for all operations
const supabase = {
  from: (table: string) => {
    const client = getSupabase();
    console.log('[salarySlipService] Using Supabase client for table:', table);
    return client.from(table);
  },
};

/**
 * Convert a user ID (Clerk ID or UUID) to Supabase UUID
 * All database operations require UUIDs, not Clerk IDs
 */
function toSupabaseUuid(userId: string): string {
  return getCachedSupabaseUuid(userId);
}

// ============================================================================
// HELPER CONTRACTS
// ============================================================================

/**
 * Get helper contract for a specific helper
 */
export async function getHelperContract(
  helperId: string,
  householdId: string
): Promise<HelperContract | null> {
  const helperUuid = toSupabaseUuid(helperId);
  
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
 */
export async function getHelperContracts(
  householdId: string
): Promise<HelperContract[]> {
  const { data, error } = await supabase
    .from('helper_contracts')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(mapContractFromDb);
}

/**
 * Create a new helper contract
 */
export async function createHelperContract(
  contract: CreateHelperContract
): Promise<HelperContract> {
  const helperUuid = toSupabaseUuid(contract.userId);
  
  const { data, error } = await supabase
    .from('helper_contracts')
    .insert({
      user_id: helperUuid,
      household_id: contract.householdId,
      status: contract.status || 'active',
      employment_start_date: contract.employmentStartDate,
      base_salary: contract.baseSalary,
      food_allowance: contract.foodAllowance || 0,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return mapContractFromDb(data);
}

/**
 * Update a helper contract
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
  
  const { data, error } = await supabase
    .from('helper_contracts')
    .update(updateData)
    .eq('id', contractId)
    .select()
    .single();
    
  if (error) throw error;
  
  return mapContractFromDb(data);
}

/**
 * Delete a helper contract
 */
export async function deleteHelperContract(contractId: string): Promise<void> {
  const { error } = await supabase
    .from('helper_contracts')
    .delete()
    .eq('id', contractId);
    
  if (error) throw error;
}

// ============================================================================
// SALARY SLIPS
// ============================================================================

/**
 * Get all salary slips for a helper
 */
export async function getSalarySlips(
  helperId: string,
  householdId: string
): Promise<SalarySlip[]> {
  const helperUuid = toSupabaseUuid(helperId);
  
  const { data, error } = await supabase
    .from('salary_slips')
    .select('*')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .order('payment_period_start', { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(mapSlipFromDb);
}

/**
 * Get all salary slips for a household (for admin view)
 */
export async function getAllSalarySlips(
  householdId: string
): Promise<SalarySlip[]> {
  const { data, error } = await supabase
    .from('salary_slips')
    .select('*')
    .eq('household_id', householdId)
    .order('payment_period_start', { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(mapSlipFromDb);
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
 */
export async function createSalarySlip(
  slip: CreateSalarySlip
): Promise<SalarySlip> {
  const helperUuid = toSupabaseUuid(slip.helperId);
  const creatorUuid = slip.createdBy ? toSupabaseUuid(slip.createdBy) : null;
  const signerUuid = slip.employerSignerId ? toSupabaseUuid(slip.employerSignerId) : null;
  
  const { data, error } = await supabase
    .from('salary_slips')
    .insert({
      household_id: slip.householdId,
      helper_id: helperUuid,
      contract_id: slip.contractId || null,
      payment_period_start: slip.paymentPeriodStart,
      payment_period_end: slip.paymentPeriodEnd,
      base_salary: slip.baseSalary,
      extra_salary: slip.extraSalary,
      salary_deduction: slip.salaryDeduction,
      total_payout: slip.totalPayout,
      note: slip.note || null,
      employer_signer_id: signerUuid,
      employer_signer_name: slip.employerSignerName || null,
      created_by: creatorUuid,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return mapSlipFromDb(data);
}

/**
 * Update a salary slip (for editing before signing)
 */
export async function updateSalarySlip(
  slipId: string,
  updates: Partial<CreateSalarySlip>
): Promise<SalarySlip> {
  const updateData: Record<string, any> = {};
  
  if (updates.paymentPeriodStart !== undefined) updateData.payment_period_start = updates.paymentPeriodStart;
  if (updates.paymentPeriodEnd !== undefined) updateData.payment_period_end = updates.paymentPeriodEnd;
  if (updates.baseSalary !== undefined) updateData.base_salary = updates.baseSalary;
  if (updates.extraSalary !== undefined) updateData.extra_salary = updates.extraSalary;
  if (updates.salaryDeduction !== undefined) updateData.salary_deduction = updates.salaryDeduction;
  if (updates.totalPayout !== undefined) updateData.total_payout = updates.totalPayout;
  if (updates.note !== undefined) updateData.note = updates.note;
  if (updates.employerSignerId !== undefined) {
    updateData.employer_signer_id = updates.employerSignerId ? toSupabaseUuid(updates.employerSignerId) : null;
  }
  if (updates.employerSignerName !== undefined) updateData.employer_signer_name = updates.employerSignerName;
  
  const { data, error } = await supabase
    .from('salary_slips')
    .update(updateData)
    .eq('id', slipId)
    .select()
    .single();
    
  if (error) throw error;
  
  return mapSlipFromDb(data);
}

/**
 * Delete a salary slip
 */
export async function deleteSalarySlip(slipId: string): Promise<void> {
  const { error } = await supabase
    .from('salary_slips')
    .delete()
    .eq('id', slipId);
    
  if (error) throw error;
}

/**
 * Sign a salary slip as employer
 */
export async function signAsEmployer(
  slipId: string,
  signerId: string,
  signerName: string
): Promise<SalarySlip> {
  const signerUuid = toSupabaseUuid(signerId);
  
  // First check if already signed
  const { data: existing } = await supabase
    .from('salary_slips')
    .select('employer_signed_at')
    .eq('id', slipId)
    .single();
    
  if (existing?.employer_signed_at) {
    throw new Error('Salary slip already signed by employer');
  }
  
  const { data, error } = await supabase
    .from('salary_slips')
    .update({
      employer_signer_id: signerUuid,
      employer_signer_name: signerName,
      employer_signed_at: new Date().toISOString(),
    })
    .eq('id', slipId)
    .select()
    .single();
    
  if (error) throw error;
  
  return mapSlipFromDb(data);
}

/**
 * Sign a salary slip as helper
 */
export async function signAsHelper(slipId: string): Promise<SalarySlip> {
  // First check if already signed
  const { data: existing } = await supabase
    .from('salary_slips')
    .select('helper_signed_at')
    .eq('id', slipId)
    .single();
    
  if (existing?.helper_signed_at) {
    throw new Error('Salary slip already signed by helper');
  }
  
  const { data, error } = await supabase
    .from('salary_slips')
    .update({
      helper_signed_at: new Date().toISOString(),
    })
    .eq('id', slipId)
    .select()
    .single();
    
  if (error) throw error;
  
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

