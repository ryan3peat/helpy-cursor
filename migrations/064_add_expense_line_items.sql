-- Migration: Add line_items column to expenses table
-- This stores the individual items extracted from receipt OCR

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;

-- Add a comment for documentation
COMMENT ON COLUMN expenses.line_items IS 'Array of line items extracted from receipt OCR: [{name: string, price: number}]';

-- Create an index for potential future queries on line items
CREATE INDEX IF NOT EXISTS idx_expenses_line_items ON expenses USING GIN (line_items);

