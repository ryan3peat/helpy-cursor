// services/helperManagementService.ts

import { supabase as defaultSupabase } from './supabase';
import { getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';
import { getCachedSupabaseUuid } from './supabaseService';
import type { 
  HKStatutoryHoliday, 
  HelperHolidayRecord, 
  HelperPayslipConfirmation,
  CompensationType 
} from '@src/types/helperManagement';

/**
 * Get the best available Supabase client.
 * Prefers authenticated client with JWT (for RLS), falls back to default.
 */
function getSupabase() {
  const authClient = getAuthenticatedSupabaseClient();
  if (!authClient) {
    console.warn('[helperManagementService] ⚠️ No authenticated client available, using default (may fail RLS)');
  }
  return authClient || defaultSupabase;
}

// Wrapper that uses authenticated client for all operations
const supabase = {
  from: (table: string) => {
    const client = getSupabase();
    console.log('[helperManagementService] Using Supabase client for table:', table);
    return client.from(table);
  },
  channel: (name: string) => getSupabase().channel(name),
};

/**
 * Convert a user ID (Clerk ID or UUID) to Supabase UUID
 * The helper_id columns in helper tables require UUIDs
 */
function toSupabaseUuid(userId: string): string {
  return getCachedSupabaseUuid(userId);
}

// ============================================================================
// HK Statutory Holidays
// ============================================================================

export async function getUpcomingHolidays(limit: number = 3): Promise<HKStatutoryHoliday[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('hk_statutory_holidays')
    .select('*')
    .gte('holiday_date', today)
    .eq('is_active', true)
    .order('holiday_date', { ascending: true })
    .limit(limit);
    
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    year: row.year,
    holidayName: row.holiday_name,
    holidayDate: row.holiday_date,
    isActive: row.is_active,
  }));
}

export async function getPastHolidays(helperId: string, householdId: string): Promise<HelperHolidayRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const helperUuid = toSupabaseUuid(helperId);
  
  const { data, error } = await supabase
    .from('helper_holiday_records')
    .select('*')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .lt('holiday_date', today)
    .order('holiday_date', { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    householdId: row.household_id,
    helperId: row.helper_id,
    holidayDate: row.holiday_date,
    holidayName: row.holiday_name,
    isWorking: row.is_working,
    compensationType: row.compensation_type,
    overtimeAmount: row.overtime_amount,
    addOvertimeToPayslip: row.add_overtime_to_payslip,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================================================
// Helper Holiday Records
// ============================================================================

export async function getHelperHolidayRecord(
  helperId: string, 
  householdId: string, 
  holidayDate: string
): Promise<HelperHolidayRecord | null> {
  const helperUuid = toSupabaseUuid(helperId);
  
  const { data, error } = await supabase
    .from('helper_holiday_records')
    .select('*')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .eq('holiday_date', holidayDate)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  if (!data) return null;
  
  return {
    id: data.id,
    householdId: data.household_id,
    helperId: data.helper_id,
    holidayDate: data.holiday_date,
    holidayName: data.holiday_name,
    isWorking: data.is_working,
    compensationType: data.compensation_type,
    overtimeAmount: data.overtime_amount,
    addOvertimeToPayslip: data.add_overtime_to_payslip,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function upsertHelperHolidayRecord(
  householdId: string,
  helperId: string,
  holidayDate: string,
  holidayName: string,
  isWorking: boolean,
  compensationType: CompensationType | null,
  overtimeAmount?: number,
  addOvertimeToPayslip?: boolean
): Promise<HelperHolidayRecord> {
  const helperUuid = toSupabaseUuid(helperId);
  
  const { data, error } = await supabase
    .from('helper_holiday_records')
    .upsert({
      household_id: householdId,
      helper_id: helperUuid,
      holiday_date: holidayDate,
      holiday_name: holidayName,
      is_working: isWorking,
      compensation_type: compensationType,
      overtime_amount: overtimeAmount || 0,
      add_overtime_to_payslip: addOvertimeToPayslip || false,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'household_id,helper_id,holiday_date',
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    householdId: data.household_id,
    helperId: data.helper_id,
    holidayDate: data.holiday_date,
    holidayName: data.holiday_name,
    isWorking: data.is_working,
    compensationType: data.compensation_type,
    overtimeAmount: data.overtime_amount,
    addOvertimeToPayslip: data.add_overtime_to_payslip,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================================
// Payslip Confirmations
// ============================================================================

export async function getCurrentPayslip(
  helperId: string,
  householdId: string
): Promise<HelperPayslipConfirmation | null> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const helperUuid = toSupabaseUuid(helperId);
  
  const { data, error } = await supabase
    .from('helper_payslip_confirmations')
    .select('*')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .eq('month', month)
    .eq('year', year)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  
  return {
    id: data.id,
    householdId: data.household_id,
    helperId: data.helper_id,
    month: data.month,
    year: data.year,
    salaryAmount: data.salary_amount,
    overtimeTotal: data.overtime_total || 0,
    employerSignedAt: data.employer_signed_at,
    employerUserId: data.employer_user_id,
    helperSignedAt: data.helper_signed_at,
    createdAt: data.created_at,
  };
}

export async function createOrGetCurrentPayslip(
  helperId: string,
  householdId: string,
  salaryAmount: number
): Promise<HelperPayslipConfirmation> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const helperUuid = toSupabaseUuid(helperId);
  
  // Try to get existing
  const existing = await getCurrentPayslip(helperId, householdId);
  if (existing) return existing;
  
  // Create new
  const { data, error } = await supabase
    .from('helper_payslip_confirmations')
    .insert({
      household_id: householdId,
      helper_id: helperUuid,
      month,
      year,
      salary_amount: salaryAmount,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    householdId: data.household_id,
    helperId: data.helper_id,
    month: data.month,
    year: data.year,
    salaryAmount: data.salary_amount,
    overtimeTotal: data.overtime_total || 0,
    employerSignedAt: data.employer_signed_at,
    employerUserId: data.employer_user_id,
    helperSignedAt: data.helper_signed_at,
    createdAt: data.created_at,
  };
}

export async function signPayslip(
  payslipId: string,
  signerType: 'employer' | 'helper',
  signerId?: string
): Promise<void> {
  // First check if already signed - prevent modification
  const { data: existing } = await supabase
    .from('helper_payslip_confirmations')
    .select('employer_signed_at, helper_signed_at')
    .eq('id', payslipId)
    .single();
    
  if (existing) {
    if (signerType === 'employer' && existing.employer_signed_at) {
      throw new Error('Payslip already signed by employer');
    }
    if (signerType === 'helper' && existing.helper_signed_at) {
      throw new Error('Payslip already signed by helper');
    }
  }
  
  const updates: Record<string, any> = {};
  
  if (signerType === 'employer') {
    updates.employer_signed_at = new Date().toISOString();
    updates.employer_user_id = signerId;
  } else {
    updates.helper_signed_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('helper_payslip_confirmations')
    .update(updates)
    .eq('id', payslipId);
    
  if (error) throw error;
}

export async function addOvertimeToPayslip(
  helperId: string,
  householdId: string,
  month: number,
  year: number,
  overtimeAmount: number
): Promise<void> {
  const helperUuid = toSupabaseUuid(helperId);
  
  // Get or create payslip for that month
  const { data: existing } = await supabase
    .from('helper_payslip_confirmations')
    .select('*')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .eq('month', month)
    .eq('year', year)
    .single();
    
  if (existing) {
    // Update overtime total
    const newTotal = (existing.overtime_total || 0) + overtimeAmount;
    await supabase
      .from('helper_payslip_confirmations')
      .update({ overtime_total: newTotal })
      .eq('id', existing.id);
  } else {
    // Create new payslip with overtime
    await supabase
      .from('helper_payslip_confirmations')
      .insert({
        household_id: householdId,
        helper_id: helperUuid,
        month,
        year,
        salary_amount: 0, // Will be set when payslip is viewed
        overtime_total: overtimeAmount,
      });
  }
}

export async function getOvertimeTotalForMonth(
  helperId: string,
  householdId: string,
  month: number,
  year: number
): Promise<number> {
  const helperUuid = toSupabaseUuid(helperId);
  
  // Get all holiday records for this month that have overtime added to payslip
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('helper_holiday_records')
    .select('overtime_amount')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .eq('add_overtime_to_payslip', true)
    .gte('holiday_date', startDate)
    .lte('holiday_date', endDate);
    
  return (data || []).reduce((sum, r) => sum + (r.overtime_amount || 0), 0);
}

export async function updatePayslipAmount(
  payslipId: string,
  newAmount: number
): Promise<void> {
  // First check if any signature exists - if so, cannot change
  const { data: existing } = await supabase
    .from('helper_payslip_confirmations')
    .select('employer_signed_at, helper_signed_at')
    .eq('id', payslipId)
    .single();
    
  if (existing?.employer_signed_at || existing?.helper_signed_at) {
    throw new Error('Cannot change amount after signing has started');
  }
  
  const { error } = await supabase
    .from('helper_payslip_confirmations')
    .update({ salary_amount: newAmount })
    .eq('id', payslipId);
    
  if (error) throw error;
}

export async function getPastPayslips(
  helperId: string,
  householdId: string
): Promise<HelperPayslipConfirmation[]> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const helperUuid = toSupabaseUuid(helperId);
  
  const { data, error } = await supabase
    .from('helper_payslip_confirmations')
    .select('*')
    .eq('helper_id', helperUuid)
    .eq('household_id', householdId)
    .or(`year.lt.${currentYear},and(year.eq.${currentYear},month.lt.${currentMonth})`)
    .order('year', { ascending: false })
    .order('month', { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    householdId: row.household_id,
    helperId: row.helper_id,
    month: row.month,
    year: row.year,
    salaryAmount: row.salary_amount,
    overtimeTotal: row.overtime_total || 0,
    employerSignedAt: row.employer_signed_at,
    employerUserId: row.employer_user_id,
    helperSignedAt: row.helper_signed_at,
    createdAt: row.created_at,
  }));
}

// ============================================================================
// Helper Salary Calculation
// ============================================================================

export function calculateTotalSalary(
  baseSalary: number,
  foodAllowance: number,
  otherAllowances: Array<{ name: string; amount: number }>
): number {
  const othersTotal = otherAllowances.reduce((sum, a) => sum + a.amount, 0);
  return baseSalary + foodAllowance + othersTotal;
}

export function isHelperSalaryConfigured(user: {
  helperStartDate?: string | null;
  helperBaseSalary?: number;
}): boolean {
  // Consider configured if start date is set
  return !!user.helperStartDate;
}

