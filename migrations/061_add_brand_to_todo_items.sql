-- Add brand column to todo_items table for shopping items
-- Brand is optional and NOT translated (stored as-is)

ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS brand TEXT;

-- Add comment for documentation
COMMENT ON COLUMN todo_items.brand IS 'Brand name for shopping items (optional, not translated)';

