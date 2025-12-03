-- ============================================================================
-- Migration: 006_add_content_translations
-- Description: Add language detection and translation support for user-generated content
-- ============================================================================

-- ============================================================================
-- TODO_ITEMS TABLE
-- ============================================================================
-- Add translation columns for 'name' field
ALTER TABLE todo_items 
ADD COLUMN IF NOT EXISTS name_lang TEXT,
ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb;

-- Backfill existing records with default language (assume English)
UPDATE todo_items 
SET name_lang = 'en' 
WHERE name_lang IS NULL;

-- Create index for language queries
CREATE INDEX IF NOT EXISTS idx_todo_items_name_lang ON todo_items(name_lang) WHERE name_lang IS NOT NULL;

-- ============================================================================
-- MEALS TABLE (if exists)
-- ============================================================================
-- Add translation columns for 'description' field
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meals') THEN
    ALTER TABLE meals 
    ADD COLUMN IF NOT EXISTS description_lang TEXT,
    ADD COLUMN IF NOT EXISTS description_translations JSONB DEFAULT '{}'::jsonb;
    
    -- Backfill existing records
    UPDATE meals 
    SET description_lang = 'en' 
    WHERE description_lang IS NULL;
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_meals_description_lang ON meals(description_lang) WHERE description_lang IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- EXPENSES TABLE (if exists)
-- ============================================================================
-- Add translation columns for 'merchant' field
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expenses') THEN
    ALTER TABLE expenses 
    ADD COLUMN IF NOT EXISTS merchant_lang TEXT,
    ADD COLUMN IF NOT EXISTS merchant_translations JSONB DEFAULT '{}'::jsonb;
    
    -- Backfill existing records
    UPDATE expenses 
    SET merchant_lang = 'en' 
    WHERE merchant_lang IS NULL;
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_expenses_merchant_lang ON expenses(merchant_lang) WHERE merchant_lang IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- ESSENTIAL_INFO TABLE
-- ============================================================================
-- Add translation columns for 'name' and 'note' fields
ALTER TABLE essential_info 
ADD COLUMN IF NOT EXISTS name_lang TEXT,
ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS note_lang TEXT,
ADD COLUMN IF NOT EXISTS note_translations JSONB DEFAULT '{}'::jsonb;

-- Backfill existing records
UPDATE essential_info 
SET name_lang = 'en' 
WHERE name_lang IS NULL AND name IS NOT NULL;

UPDATE essential_info 
SET note_lang = 'en' 
WHERE note_lang IS NULL AND note IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_essential_info_name_lang ON essential_info(name_lang) WHERE name_lang IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_essential_info_note_lang ON essential_info(note_lang) WHERE note_lang IS NOT NULL;

-- ============================================================================
-- TRAINING_MODULES TABLE
-- ============================================================================
-- Add translation columns for 'name' and 'content' fields
ALTER TABLE training_modules 
ADD COLUMN IF NOT EXISTS name_lang TEXT,
ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS content_lang TEXT,
ADD COLUMN IF NOT EXISTS content_translations JSONB DEFAULT '{}'::jsonb;

-- Backfill existing records
UPDATE training_modules 
SET name_lang = 'en' 
WHERE name_lang IS NULL AND name IS NOT NULL;

UPDATE training_modules 
SET content_lang = 'en' 
WHERE content_lang IS NULL AND content IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_training_modules_name_lang ON training_modules(name_lang) WHERE name_lang IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_modules_content_lang ON training_modules(content_lang) WHERE content_lang IS NOT NULL;

-- ============================================================================
-- NOTES
-- ============================================================================
-- Translation JSONB structure: { "en": "original", "zh-CN": "translated", ... }
-- Language codes follow ISO 639-1/ISO 3166-1 format (e.g., 'en', 'zh-CN', 'zh-TW')
-- NULL language means language could not be detected - always display original
-- Empty translations object means no translations have been generated yet

