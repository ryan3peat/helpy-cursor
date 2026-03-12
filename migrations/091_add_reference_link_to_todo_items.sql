-- Add reference_link column to todo_items for shopping items
-- Allows users to attach a URL (e.g. product page, reference image) to a shopping item
ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS reference_link TEXT;
