-- ============================================================================
-- Migration: 076_fix_biweekly_recurrence
-- Description: Add BIWEEKLY support to get_next_occurrence_date function
-- 
-- BUG: The get_next_occurrence_date function only handled DAILY, WEEKLY, MONTHLY
--      but the UI allows BIWEEKLY selection. This caused biweekly tasks to not
--      create the next instance when completed.
-- ============================================================================

-- Update the function to handle BIWEEKLY (preserving original WEEKLY/MONTHLY logic)
CREATE OR REPLACE FUNCTION get_next_occurrence_date(
  p_frequency TEXT,
  p_day_of_week INTEGER,
  p_day_of_month INTEGER,
  p_from_date DATE
) RETURNS DATE AS $$
DECLARE
  v_next_date DATE;
BEGIN
  CASE p_frequency
    WHEN 'DAILY' THEN
      v_next_date := p_from_date + INTERVAL '1 day';
      
    WHEN 'WEEKLY' THEN
      -- Find next occurrence of the specified day of week
      v_next_date := p_from_date + INTERVAL '1 day';
      WHILE EXTRACT(DOW FROM v_next_date) != p_day_of_week LOOP
        v_next_date := v_next_date + INTERVAL '1 day';
      END LOOP;
      
    WHEN 'BIWEEKLY' THEN
      -- Every 2 weeks: same day of week, 14 days later
      v_next_date := p_from_date + INTERVAL '14 days';
      
    WHEN 'MONTHLY' THEN
      -- Find next occurrence of the specified day of month
      IF EXTRACT(DAY FROM p_from_date) < p_day_of_month THEN
        -- Still this month
        v_next_date := DATE_TRUNC('month', p_from_date) + (p_day_of_month - 1) * INTERVAL '1 day';
      ELSE
        -- Next month
        v_next_date := DATE_TRUNC('month', p_from_date) + INTERVAL '1 month' + (p_day_of_month - 1) * INTERVAL '1 day';
      END IF;
      -- Handle months with fewer days (e.g., day 31 in February)
      IF EXTRACT(DAY FROM v_next_date) != p_day_of_month THEN
        v_next_date := DATE_TRUNC('month', v_next_date + INTERVAL '1 month') - INTERVAL '1 day';
      END IF;
      
    ELSE
      v_next_date := NULL;
  END CASE;
  
  RETURN v_next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Also update recurring_series table constraint to allow BIWEEKLY
-- (in case it wasn't included before)
ALTER TABLE recurring_series 
  DROP CONSTRAINT IF EXISTS recurring_series_frequency_check;

ALTER TABLE recurring_series 
  ADD CONSTRAINT recurring_series_frequency_check 
  CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'));

-- ============================================================================
-- Done! BIWEEKLY recurring tasks now work correctly.
-- ============================================================================

