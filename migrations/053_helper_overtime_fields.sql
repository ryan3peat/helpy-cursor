-- ============================================================================
-- Migration: 053_helper_overtime_fields
-- Description: Add overtime_amount and add_to_payslip to holiday records
-- ============================================================================

-- Add overtime tracking columns to helper_holiday_records
ALTER TABLE helper_holiday_records 
ADD COLUMN IF NOT EXISTS overtime_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS add_overtime_to_payslip BOOLEAN DEFAULT false;

-- Add overtime_total column to payslip confirmations
ALTER TABLE helper_payslip_confirmations
ADD COLUMN IF NOT EXISTS overtime_total INTEGER DEFAULT 0;

