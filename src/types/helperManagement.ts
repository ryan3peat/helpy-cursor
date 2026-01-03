// src/types/helperManagement.ts

export interface HelperSalaryInfo {
  helperStartDate?: string | null;       // ISO date string
  helperBaseSalary: number;              // Default: 5100
  helperFoodAllowance: number;           // Default: 1236
  helperOtherAllowances: OtherAllowance[];
}

export interface OtherAllowance {
  name: string;
  amount: number;
}

export interface HKStatutoryHoliday {
  id: string;
  year: number;
  holidayName: string;
  holidayDate: string;  // ISO date string
  isActive: boolean;
}

export interface HelperHolidayRecord {
  id: string;
  householdId: string;
  helperId: string;
  holidayDate: string;
  holidayName: string;
  isWorking: boolean;
  compensationType: 'lieu' | 'overtime' | null;
  overtimeAmount?: number;           // Amount in HKD for overtime pay
  addOvertimeToPayslip?: boolean;    // Whether to add overtime to that month's payslip
  createdAt?: string;
  updatedAt?: string;
}

export interface HelperPayslipConfirmation {
  id: string;
  householdId: string;
  helperId: string;
  month: number;        // 1-12
  year: number;
  salaryAmount: number;
  baseSalary?: number;           // Base salary component
  otherAllowancesTotal?: number; // Other allowances component
  overtimeTotal?: number;        // Total overtime added to this payslip
  employerSignedAt?: string | null;
  employerUserId?: string | null;
  helperSignedAt?: string | null;
  createdAt?: string;
}

export type CompensationType = 'lieu' | 'overtime';

