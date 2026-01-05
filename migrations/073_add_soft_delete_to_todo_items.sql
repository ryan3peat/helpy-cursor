-- ============================================================================
-- Migration: 073_add_soft_delete_to_todo_items
-- Description: Add soft delete support to todo_items table
-- Why: Preserve shopping/task history instead of permanently deleting
-- ============================================================================

-- Add deleted_at column for soft delete
ALTER TABLE todo_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of non-deleted items
CREATE INDEX IF NOT EXISTS idx_todo_items_deleted_at 
ON todo_items(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN todo_items.deleted_at IS 'Soft delete timestamp. NULL means active, non-NULL means deleted.';

-- ============================================================================
-- Note: The application code needs to be updated to:
-- 1. Set deleted_at = NOW() instead of DELETE
-- 2. Filter WHERE deleted_at IS NULL in all SELECT queries
-- ============================================================================

