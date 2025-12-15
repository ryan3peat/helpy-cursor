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
  employerSignedAt?: string | null;
  employerUserId?: string | null;
  helperSignedAt?: string | null;
  createdAt?: string;
}

export type CompensationType = 'lieu' | 'overtime';

