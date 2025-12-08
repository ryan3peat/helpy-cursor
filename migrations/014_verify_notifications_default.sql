-- ============================================================================
-- Verify Notifications Default and Fix if Needed
-- Description: Ensures notifications_enabled defaults to TRUE for new users
-- ============================================================================

-- Check current default
SELECT 
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'notifications_enabled';

-- Update default if it's not TRUE
ALTER TABLE users 
ALTER COLUMN notifications_enabled SET DEFAULT TRUE;

-- Update existing users who have NULL to TRUE (if desired)
-- Uncomment the line below if you want to set all NULL values to TRUE
-- UPDATE users SET notifications_enabled = TRUE WHERE notifications_enabled IS NULL;

-- Verify the change
SELECT 
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'notifications_enabled';

-- Show current state of users
SELECT 
  id,
  name,
  notifications_enabled,
  CASE 
    WHEN notifications_enabled IS NULL THEN 'NULL (will default to TRUE)'
    WHEN notifications_enabled = TRUE THEN 'TRUE ✅'
    ELSE 'FALSE'
  END as status
FROM users
ORDER BY name;
