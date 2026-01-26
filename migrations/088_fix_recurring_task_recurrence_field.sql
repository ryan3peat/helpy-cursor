-- ============================================================================
-- Migration: 088_fix_recurring_task_recurrence_field
-- Description: Fix recurring tasks to properly populate recurrence JSONB field
--              and sync with recurring_series template
-- 
-- FIXES:
-- 1. Trigger now includes recurrence JSONB when creating instances
-- 2. Added function to sync recurrence from series to instances
-- ============================================================================

-- ============================================================================
-- 1. UPDATE TRIGGER: Include recurrence field when creating instances
-- ============================================================================
-- The original trigger didn't copy the recurrence JSONB, causing the repeat
-- icon to disappear until page refresh.

CREATE OR REPLACE FUNCTION create_next_recurring_instance()
RETURNS TRIGGER AS $$
DECLARE
  v_series recurring_series%ROWTYPE;
  v_next_date DATE;
  v_recurrence JSONB;
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
      
      -- Build recurrence JSONB from series template
      v_recurrence := jsonb_build_object(
        'frequency', v_series.frequency,
        'dayOfWeek', v_series.day_of_week,
        'dayOfMonth', v_series.day_of_month
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
          -- Create next instance WITH recurrence field
          INSERT INTO todo_items (
            household_id,
            type,
            name,
            category,
            completed,
            assignee_id,
            due_date,
            due_time,
            recurrence,  -- NOW INCLUDED!
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
            v_recurrence,  -- Include recurrence from series
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

-- ============================================================================
-- 2. UPDATE INITIAL INSTANCE TRIGGER: Include recurrence field
-- ============================================================================
-- When a new series is created, also include recurrence in the initial instances

CREATE OR REPLACE FUNCTION create_initial_series_instances()
RETURNS TRIGGER AS $$
DECLARE
  v_next_date DATE;
  v_recurrence JSONB;
BEGIN
  -- Build recurrence JSONB from series
  v_recurrence := jsonb_build_object(
    'frequency', NEW.frequency,
    'dayOfWeek', NEW.day_of_week,
    'dayOfMonth', NEW.day_of_month
  );

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
    recurrence,  -- NOW INCLUDED!
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
    v_recurrence,  -- Include recurrence from series
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
      recurrence,  -- NOW INCLUDED!
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
      v_recurrence,  -- Include recurrence from series
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

-- ============================================================================
-- 3. BACKFILL: Add recurrence to existing instances missing it
-- ============================================================================
-- Fix existing todo_items that have series_id but no recurrence JSONB

UPDATE todo_items ti
SET recurrence = jsonb_build_object(
  'frequency', rs.frequency,
  'dayOfWeek', rs.day_of_week,
  'dayOfMonth', rs.day_of_month
)
FROM recurring_series rs
WHERE ti.series_id = rs.id
  AND ti.series_id IS NOT NULL
  AND (ti.recurrence IS NULL OR ti.recurrence = '{}'::jsonb)
  AND rs.deleted_at IS NULL;

-- ============================================================================
-- 4. FUNCTION: Update series and propagate to future instances
-- ============================================================================
-- Called when user chooses "Edit all future" - updates the series template
-- and all non-completed, non-exception future instances

CREATE OR REPLACE FUNCTION update_recurring_series_and_future_instances(
  p_series_id UUID,
  p_name TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_assignee_id UUID DEFAULT NULL,
  p_due_time TEXT DEFAULT NULL,
  p_frequency TEXT DEFAULT NULL,
  p_day_of_week INTEGER DEFAULT NULL,
  p_day_of_month INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_recurrence JSONB;
  v_series recurring_series%ROWTYPE;
BEGIN
  -- Get current series to fill in unchanged values
  SELECT * INTO v_series FROM recurring_series WHERE id = p_series_id AND deleted_at IS NULL;
  
  IF v_series IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Update the series template
  UPDATE recurring_series
  SET 
    name = COALESCE(p_name, name),
    category = COALESCE(p_category, category),
    assignee_id = COALESCE(p_assignee_id, assignee_id),
    due_time = COALESCE(p_due_time, due_time),
    frequency = COALESCE(p_frequency, frequency),
    day_of_week = COALESCE(p_day_of_week, day_of_week),
    day_of_month = COALESCE(p_day_of_month, day_of_month),
    updated_at = NOW()
  WHERE id = p_series_id;
  
  -- Build new recurrence JSONB
  v_recurrence := jsonb_build_object(
    'frequency', COALESCE(p_frequency, v_series.frequency),
    'dayOfWeek', COALESCE(p_day_of_week, v_series.day_of_week),
    'dayOfMonth', COALESCE(p_day_of_month, v_series.day_of_month)
  );
  
  -- Update all future non-completed, non-exception instances
  UPDATE todo_items
  SET 
    name = COALESCE(p_name, name),
    category = COALESCE(p_category, category),
    assignee_id = COALESCE(p_assignee_id, assignee_id),
    due_time = COALESCE(p_due_time, due_time),
    recurrence = v_recurrence
  WHERE series_id = p_series_id
    AND completed = FALSE
    AND (is_exception IS NULL OR is_exception = FALSE)
    AND deleted_at IS NULL
    AND due_date >= CURRENT_DATE;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Done! Summary:
-- 1. Trigger now includes recurrence JSONB when creating new instances
-- 2. Initial series trigger now includes recurrence JSONB
-- 3. Backfilled existing instances missing recurrence
-- 4. Added function to update series and propagate to future instances
-- ============================================================================
