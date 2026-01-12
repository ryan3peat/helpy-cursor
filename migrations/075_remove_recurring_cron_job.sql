-- ============================================================================
-- Migration: 075_remove_recurring_cron_job
-- Description: Remove the pg_cron job that pre-creates recurring task instances
-- 
-- WHY THIS CHANGE:
-- 1. The calendar view feature was sunset - no longer need instances 7 days ahead
-- 2. Pre-created instances trigger unwanted notifications (notifying about future tasks)
-- 3. The database trigger (create_next_recurring_instance) already handles
--    creating the next instance when a task is completed
-- 4. Having multiple systems create instances caused duplicate entries
--
-- WHAT THIS DOES:
-- - Removes the pg_cron job 'create_recurring_task_instances'
-- - Keeps the trigger-based creation (single source of truth)
-- - Optionally cleans up the helper function (kept for reference)
-- ============================================================================

-- ============================================================================
-- 1. REMOVE THE CRON JOB
-- ============================================================================
-- Unschedule the daily job that was creating instances 7 days ahead

DO $$
BEGIN
  -- Check if pg_cron extension exists before trying to unschedule
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove the scheduled job
    PERFORM cron.unschedule('create_recurring_task_instances');
    RAISE NOTICE 'Successfully unscheduled create_recurring_task_instances cron job';
  ELSE
    RAISE NOTICE 'pg_cron extension not found - job may not have been scheduled';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Job might not exist, that's okay
    RAISE NOTICE 'Could not unschedule job (may not exist): %', SQLERRM;
END $$;

-- ============================================================================
-- 2. OPTIONAL: CLEAN UP DUPLICATE RECURRING INSTANCES
-- ============================================================================
-- If you have duplicate instances from past double-creation, this query can help
-- identify them. Run SELECT first to review before DELETE.

-- To find potential duplicates (instances with same series_id and due_date):
-- SELECT series_id, due_date, COUNT(*) as instance_count
-- FROM todo_items
-- WHERE series_id IS NOT NULL AND deleted_at IS NULL
-- GROUP BY series_id, due_date
-- HAVING COUNT(*) > 1;

-- To delete duplicates (keeps the oldest one per series_id + due_date):
-- DELETE FROM todo_items a
-- USING todo_items b
-- WHERE a.series_id = b.series_id
--   AND a.due_date = b.due_date
--   AND a.id > b.id
--   AND a.deleted_at IS NULL
--   AND b.deleted_at IS NULL;

-- ============================================================================
-- 3. KEEP THE FUNCTION (for manual use if needed)
-- ============================================================================
-- We're keeping create_upcoming_recurring_instances() in case it's needed
-- for manual operations, but it won't run automatically anymore.

-- If you want to completely remove it, uncomment this:
-- DROP FUNCTION IF EXISTS create_upcoming_recurring_instances(INTEGER);

-- ============================================================================
-- SUMMARY:
-- - Cron job removed: No more automatic 7-day-ahead instance creation
-- - Trigger kept: Next instance created when current one is completed
-- - Single source of truth: Only database trigger creates recurring instances
-- ============================================================================

