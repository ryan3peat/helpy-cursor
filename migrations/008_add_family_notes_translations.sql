-- ============================================================================
-- Migration: 008_add_family_notes_translations
-- Description: Add language detection and translation support for family notes
-- ============================================================================

-- ============================================================================
-- HOUSEHOLDS TABLE
-- ============================================================================
-- Add translation columns for 'family_notes' field
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS family_notes_lang TEXT,
ADD COLUMN IF NOT EXISTS family_notes_translations JSONB DEFAULT '{}'::jsonb;

-- Backfill existing records with default language (assume English if notes exist)
UPDATE households 
SET family_notes_lang = 'en' 
WHERE family_notes_lang IS NULL 
  AND family_notes IS NOT NULL 
  AND family_notes != '';

-- Create index for language queries
CREATE INDEX IF NOT EXISTS idx_households_family_notes_lang ON households(family_notes_lang) WHERE family_notes_lang IS NOT NULL;
