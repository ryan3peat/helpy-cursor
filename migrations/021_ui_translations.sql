-- Migration: 021_ui_translations.sql
-- Purpose: Create table to store pre-translated UI strings for instant loading
-- This replaces live AI translation with pre-generated static translations

-- Create the ui_translations table
CREATE TABLE IF NOT EXISTS ui_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lang_code TEXT NOT NULL,           -- Language code: 'zh-CN', 'zh-TW', 'tl', 'id', 'ko', 'ja'
  key TEXT NOT NULL,                 -- Translation key: 'dashboard.greeting.morning', 'common.save', etc.
  value TEXT NOT NULL,               -- Translated text in target language
  is_reviewed BOOLEAN DEFAULT FALSE, -- Has a human verified this translation?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each key can only exist once per language
  UNIQUE(lang_code, key)
);

-- Index for fast lookups by language code
CREATE INDEX IF NOT EXISTS idx_ui_translations_lang ON ui_translations(lang_code);

-- Enable Row Level Security
ALTER TABLE ui_translations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read translations (no auth required)
-- This is public data, no sensitive information
CREATE POLICY "Translations are publicly readable"
  ON ui_translations
  FOR SELECT
  USING (true);

-- RLS Policy: Only service role can insert/update/delete
-- Translations are managed via seed script or admin, not by regular users
CREATE POLICY "Only service role can modify translations"
  ON ui_translations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ui_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ui_translations_updated_at
  BEFORE UPDATE ON ui_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_ui_translations_updated_at();

-- Add helpful comment to table
COMMENT ON TABLE ui_translations IS 'Pre-translated UI strings for instant loading. Replaces live AI translation.';
COMMENT ON COLUMN ui_translations.lang_code IS 'Target language code (e.g., zh-CN, tl, ja). English is base and not stored here.';
COMMENT ON COLUMN ui_translations.key IS 'Translation key matching BASE_TRANSLATIONS in constants.ts';
COMMENT ON COLUMN ui_translations.value IS 'Translated text in the target language';
COMMENT ON COLUMN ui_translations.is_reviewed IS 'True if a human has verified this translation is correct';

