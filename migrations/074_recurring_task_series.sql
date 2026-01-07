-- ============================================================================
-- RECURRING TASK SERIES - Instance-Based Model
-- ============================================================================
-- This migration adds support for recurring tasks with individual instances
-- that can be edited/deleted independently (Google Calendar style)
--
-- Architecture:
-- - recurring_series: Template for recurring tasks (rules, defaults)
-- - todo_items.series_id: Links instances to their series
-- - List View: Shows only NEXT upcoming instance per series
-- - Calendar View: Shows ALL instances (generated from rules)
-- ============================================================================

-- ============================================================================
-- 1. CREATE RECURRING SERIES TABLE
-- ============================================================================
-- Stores the "template" for recurring tasks - the rules and default values
-- Each series can have many instances in todo_items

CREATE TABLE IF NOT EXISTS recurring_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  
  -- Task template (copied to each instance)
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Others',
  assignee_id TEXT,  -- Default assignee (can be overridden per instance)
  due_time TEXT,     -- Default time (e.g., '15:30')
  
  -- Recurrence rules
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sun, 6=Sat (for WEEKLY)
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),  -- (for MONTHLY)
  
  -- Series bounds
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL = repeats forever
  
  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete (ending a series)
  deleted_at TIMESTAMPTZ
);

-- Index for querying series by household
CREATE INDEX IF NOT EXISTS idx_recurring_series_household 
  ON recurring_series(household_id) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. ADD SERIES_ID TO TODO_ITEMS
-- ============================================================================
-- Links task instances to their recurring series
-- NULL = one-off task (not recurring)

ALTER TABLE todo_items 
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES recurring_series(id) ON DELETE SET NULL;

-- Is this instance an exception (modified from the series template)?
ALTER TABLE todo_items 
  ADD COLUMN IF NOT EXISTS is_exception BOOLEAN DEFAULT FALSE;

-- Original date (for tracking if instance was moved to different date)
ALTER TABLE todo_items 
  ADD COLUMN IF NOT EXISTS original_due_date DATE;

-- Index for finding instances of a series
CREATE INDEX IF NOT EXISTS idx_todo_items_series 
  ON todo_items(series_id) 
  WHERE series_id IS NOT NULL;

-- ============================================================================
-- 3. ENABLE RLS ON RECURRING_SERIES
-- ============================================================================

ALTER TABLE recurring_series ENABLE ROW LEVEL SECURITY;

-- Users can view series in their household
CREATE POLICY "Users can view recurring series in their household"
  ON recurring_series FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt()->>'sub'
    )
  );

-- Users can insert series in their household
CREATE POLICY "Users can insert recurring series in their household"
  ON recurring_series FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt()->>'sub'
    )
  );

-- Users can update series in their household
CREATE POLICY "Users can update recurring series in their household"
  ON recurring_series FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt()->>'sub'
    )
  );

-- Users can delete series in their household
CREATE POLICY "Users can delete recurring series in their household"
  ON recurring_series FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt()->>'sub'
    )
  );

-- ============================================================================
-- 4. HELPER FUNCTION: Generate next occurrence date
-- ============================================================================

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

-- ============================================================================
-- 5. TRIGGER: Auto-create next instance when recurring task is completed
-- ============================================================================

CREATE OR REPLACE FUNCTION create_next_recurring_instance()
RETURNS TRIGGER AS $$
DECLARE
  v_series recurring_series%ROWTYPE;
  v_next_date DATE;
  v_new_instance_id UUID;
BEGIN
  -- Only trigger when task is marked as completed
  IF NEW.completed = TRUE AND OLD.completed = FALSE AND NEW.series_id IS NOT NULL THEN
    -- Get the series
    SELECT * INTO v_series FROM recurring_series WHERE id = NEW.series_id AND deleted_at IS NULL;
    
    IF v_series IS NOT NULL THEN
      -- Calculate next occurrence date
      v_next_date := get_next_occurrence_date(
        v_series.frequency,
        v_series.day_of_week,
        v_series.day_of_month,
        COALESCE(NEW.due_date, CURRENT_DATE)
      );
      
      -- Check if next date is within series bounds (if end_date is set)
      IF v_series.end_date IS NULL OR v_next_date <= v_series.end_date THEN
        -- Check if instance already exists for this date
        IF NOT EXISTS (
          SELECT 1 FROM todo_items 
          WHERE series_id = NEW.series_id 
            AND due_date = v_next_date 
            AND deleted_at IS NULL
        ) THEN
          -- Create next instance
          INSERT INTO todo_items (
            household_id,
            type,
            name,
            category,
            completed,
            assignee_id,
            due_date,
            due_time,
            series_id,
            is_exception,
            original_due_date,
            created_at,
            created_by,
            name_lang,
            name_translations
          ) VALUES (
            NEW.household_id,
            'task',
            v_series.name,
            v_series.category,
            FALSE,
            COALESCE(v_series.assignee_id, NEW.assignee_id),
            v_next_date,
            v_series.due_time,
            NEW.series_id,
            FALSE,
            v_next_date,
            NOW(),
            v_series.created_by,
            NEW.name_lang,
            NEW.name_translations
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_create_next_recurring_instance ON todo_items;
CREATE TRIGGER trigger_create_next_recurring_instance
  AFTER UPDATE ON todo_items
  FOR EACH ROW
  EXECUTE FUNCTION create_next_recurring_instance();

-- ============================================================================
-- 6. MIGRATE EXISTING RECURRING TASKS
-- ============================================================================
-- Convert existing tasks with recurrence JSONB to the new series model

DO $$
DECLARE
  v_task RECORD;
  v_series_id UUID;
  v_frequency TEXT;
  v_day_of_week INTEGER;
  v_day_of_month INTEGER;
BEGIN
  -- Find all tasks with recurrence that don't have a series_id yet
  FOR v_task IN 
    SELECT * FROM todo_items 
    WHERE recurrence IS NOT NULL 
      AND recurrence->>'frequency' != 'NONE'
      AND series_id IS NULL
      AND type = 'task'
  LOOP
    -- Extract recurrence info
    v_frequency := v_task.recurrence->>'frequency';
    v_day_of_week := (v_task.recurrence->>'dayOfWeek')::INTEGER;
    v_day_of_month := (v_task.recurrence->>'dayOfMonth')::INTEGER;
    
    -- Create a series for this task
    INSERT INTO recurring_series (
      household_id,
      name,
      category,
      assignee_id,
      due_time,
      frequency,
      day_of_week,
      day_of_month,
      start_date,
      created_by,
      created_at
    ) VALUES (
      v_task.household_id,
      v_task.name,
      v_task.category,
      v_task.assignee_id,
      v_task.due_time,
      v_frequency,
      v_day_of_week,
      v_day_of_month,
      COALESCE(v_task.due_date, CURRENT_DATE),
      v_task.created_by,
      v_task.created_at
    ) RETURNING id INTO v_series_id;
    
    -- Link the existing task to the series
    UPDATE todo_items 
    SET series_id = v_series_id,
        original_due_date = due_date
    WHERE id = v_task.id;
    
  END LOOP;
END $$;

-- ============================================================================
-- 7. TIME-BASED INSTANCE CREATION (PG_CRON)
-- ============================================================================
-- Creates future instances automatically, even if user doesn't complete tasks
-- This ensures notifications work for recurring tasks

-- Function to create upcoming instances for all recurring series
CREATE OR REPLACE FUNCTION create_upcoming_recurring_instances(p_days_ahead INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  v_series RECORD;
  v_current_date DATE;
  v_target_date DATE;
  v_next_date DATE;
  v_instances_created INTEGER := 0;
BEGIN
  v_current_date := CURRENT_DATE;
  v_target_date := v_current_date + p_days_ahead;
  
  -- Loop through all active recurring series
  FOR v_series IN 
    SELECT * FROM recurring_series 
    WHERE deleted_at IS NULL
      AND (end_date IS NULL OR end_date >= v_current_date)
  LOOP
    -- Find the latest instance for this series
    SELECT MAX(due_date) INTO v_next_date
    FROM todo_items 
    WHERE series_id = v_series.id 
      AND deleted_at IS NULL;
    
    -- If no instances exist, start from series start_date
    IF v_next_date IS NULL THEN
      v_next_date := v_series.start_date - INTERVAL '1 day';
    END IF;
    
    -- Create instances up to target date
    LOOP
      -- Calculate next occurrence
      v_next_date := get_next_occurrence_date(
        v_series.frequency,
        v_series.day_of_week,
        v_series.day_of_month,
        v_next_date
      );
      
      -- Exit if beyond target date or end_date
      EXIT WHEN v_next_date IS NULL 
             OR v_next_date > v_target_date 
             OR (v_series.end_date IS NOT NULL AND v_next_date > v_series.end_date);
      
      -- Skip dates in the past
      IF v_next_date < v_current_date THEN
        CONTINUE;
      END IF;
      
      -- Check if instance already exists (don't overwrite user edits!)
      IF NOT EXISTS (
        SELECT 1 FROM todo_items 
        WHERE series_id = v_series.id 
          AND due_date = v_next_date 
          AND deleted_at IS NULL
      ) THEN
        -- Create the instance
        INSERT INTO todo_items (
          household_id,
          type,
          name,
          category,
          completed,
          assignee_id,
          due_date,
          due_time,
          series_id,
          is_exception,
          original_due_date,
          created_at,
          created_by
        ) VALUES (
          v_series.household_id,
          'task',
          v_series.name,
          v_series.category,
          FALSE,
          v_series.assignee_id,
          v_next_date,
          v_series.due_time,
          v_series.id,
          FALSE,
          v_next_date,
          NOW(),
          'system'  -- Mark as system-created
        );
        
        v_instances_created := v_instances_created + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN v_instances_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. SCHEDULE THE CRON JOB (Runs daily at midnight UTC)
-- ============================================================================
-- NOTE: pg_cron extension must be enabled in your Supabase project
-- Go to Database > Extensions > Enable pg_cron

-- First, ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing job with same name
SELECT cron.unschedule('create_recurring_task_instances')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'create_recurring_task_instances'
);

-- Schedule the job to run daily at 00:05 UTC (5 mins past midnight)
-- Creates instances 7 days ahead to ensure notifications work
SELECT cron.schedule(
  'create_recurring_task_instances',  -- job name
  '5 0 * * *',                        -- cron expression: 00:05 UTC daily
  $$SELECT create_upcoming_recurring_instances(7)$$  -- 7 days ahead
);

-- ============================================================================
-- 9. FUNCTION TO CREATE INITIAL INSTANCES WHEN SERIES IS CREATED
-- ============================================================================
-- When a new recurring series is created, immediately create current + next instance

CREATE OR REPLACE FUNCTION create_initial_series_instances()
RETURNS TRIGGER AS $$
DECLARE
  v_next_date DATE;
BEGIN
  -- Create first instance (on start_date)
  INSERT INTO todo_items (
    household_id,
    type,
    name,
    category,
    completed,
    assignee_id,
    due_date,
    due_time,
    series_id,
    is_exception,
    original_due_date,
    created_at,
    created_by
  ) VALUES (
    NEW.household_id,
    'task',
    NEW.name,
    NEW.category,
    FALSE,
    NEW.assignee_id,
    NEW.start_date,
    NEW.due_time,
    NEW.id,
    FALSE,
    NEW.start_date,
    NOW(),
    NEW.created_by
  );
  
  -- Calculate and create next instance (for notifications to work)
  v_next_date := get_next_occurrence_date(
    NEW.frequency,
    NEW.day_of_week,
    NEW.day_of_month,
    NEW.start_date
  );
  
  -- Create next instance if within bounds
  IF v_next_date IS NOT NULL AND (NEW.end_date IS NULL OR v_next_date <= NEW.end_date) THEN
    INSERT INTO todo_items (
      household_id,
      type,
      name,
      category,
      completed,
      assignee_id,
      due_date,
      due_time,
      series_id,
      is_exception,
      original_due_date,
      created_at,
      created_by
    ) VALUES (
      NEW.household_id,
      'task',
      NEW.name,
      NEW.category,
      FALSE,
      NEW.assignee_id,
      v_next_date,
      NEW.due_time,
      NEW.id,
      FALSE,
      v_next_date,
      NOW(),
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new series
DROP TRIGGER IF EXISTS trigger_create_initial_series_instances ON recurring_series;
CREATE TRIGGER trigger_create_initial_series_instances
  AFTER INSERT ON recurring_series
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_series_instances();

-- ============================================================================
-- Done! Summary:
-- - recurring_series table created
-- - todo_items has series_id, is_exception, original_due_date columns
-- - Trigger auto-creates next instance when recurring task completed
-- - Trigger auto-creates current + next instance when series created
-- - pg_cron job runs daily to create instances 7 days ahead
-- - Existing recurring tasks migrated to new model
-- ============================================================================

