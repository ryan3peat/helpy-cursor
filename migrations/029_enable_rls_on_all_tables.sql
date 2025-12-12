-- ============================================================================
-- Migration: 029_enable_rls_on_all_tables
-- Description: Explicitly enable RLS on all tables (in case it wasn't enabled)
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- Enable RLS on all user tables
ALTER TABLE IF EXISTS essential_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS households ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS house_routine ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ui_translations ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
