// src/types/helperManagement.ts
// ============================================================================
// Salary Slip System Types
// ============================================================================

/**
 * Helper Contract - Employment agreement terms
 * One contract per helper in a household
 */
export interface HelperContract {
  id: string;
  userId: string;           // Supabase UUID of the helper user
  householdId: string;
  status: 'active' | 'terminated';
  employmentStartDate: string;  // ISO date string (YYYY-MM-DD)
  baseSalary: number;           // Monthly base salary in HKD
  foodAllowance: number;        // Food allowance in HKD
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Create/Update contract payload
 */
export interface CreateHelperContract {
  userId: string;
  householdId: string;
  status?: 'active' | 'terminated';
  employmentStartDate: string;
  baseSalary: number;
  foodAllowance?: number;
}

/**
 * Salary Slip - Individual payment record
 * Created for each payment period, signed by employer and helper
 */
export interface SalarySlip {
  id: string;
  householdId: string;
  helperId: string;             // Supabase UUID of the helper user
  contractId?: string | null;   // Reference to helper_contracts
  paymentPeriodStart: string;   // ISO date string (YYYY-MM-DD)
  paymentPeriodEnd: string;     // ISO date string (YYYY-MM-DD)
  baseSalary: number;           // Base salary from contract at time of slip
  extraSalary: number;          // One-time additions
  salaryDeduction: number;      // One-time deductions (stored as negative)
  totalPayout: number;          // Calculated: base + extra + deduction
  note?: string | null;
  employerSignerId?: string | null;   // UUID of employer who will sign
  employerSignerName?: string | null; // Name snapshot for display/PDF
  employerSignedAt?: string | null;   // ISO timestamp
  helperSignedAt?: string | null;     // ISO timestamp
  createdAt?: string;
  createdBy?: string | null;    // UUID of user who created the slip
}

/**
 * Create salary slip payload
 */
export interface CreateSalarySlip {
  householdId: string;
  helperId: string;             // Can be Clerk ID - service will convert
  contractId?: string;
  paymentPeriodStart: string;
  paymentPeriodEnd: string;
  baseSalary: number;
  extraSalary: number;
  salaryDeduction: number;      // Should be negative or zero
  totalPayout: number;
  note?: string;
  employerSignerId?: string;    // Can be Clerk ID - service will convert
  employerSignerName?: string;
  createdBy?: string;           // Can be Clerk ID - service will convert
}

/**
 * Salary slip with helper name for display
 */
export interface SalarySlipWithHelper extends SalarySlip {
  helperName?: string;
  helperStartDate?: string;
}
