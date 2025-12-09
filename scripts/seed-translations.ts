/**
 * seed-translations.ts
 * 
 * Script to generate and sync translations for all supported languages.
 * 
 * FEATURES:
 *   - Imports BASE_TRANSLATIONS from constants.ts (single source of truth)
 *   - Incremental mode: only translates NEW keys (default behavior)
 *   - Force mode: re-translates everything (--force flag)
 * 
 * USAGE:
 *   1. Make sure you have run the migration (021_ui_translations.sql) first
 *   2. Set environment variables:
 *      - VITE_SUPABASE_URL (or SUPABASE_URL)
 *      - SUPABASE_SERVICE_ROLE_KEY (from Supabase Dashboard > Settings > API)
 *      - GEMINI_API_KEY (from Google AI Studio)
 *   3. Run: npx ts-node scripts/seed-translations.ts
 * 
 * FLAGS:
 *   --force    Re-translate ALL strings (ignores existing translations)
 *   --dry-run  Show what would be translated without actually doing it
 * 
 * EXAMPLES:
 *   npx ts-node scripts/seed-translations.ts           # Incremental (only new keys)
 *   npx ts-node scripts/seed-translations.ts --force   # Re-translate everything
 *   npx ts-node scripts/seed-translations.ts --dry-run # Preview changes
 */

import { createClient } from '@supabase/supabase-js';

// Import BASE_TRANSLATIONS from constants.ts (single source of truth!)
import { BASE_TRANSLATIONS, SUPPORTED_LANGUAGES } from '../constants.ts';

// ============================================
// Configuration
// ============================================

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

// Validate environment
if (!SUPABASE_URL) {
  console.error('Error: SUPABASE_URL or VITE_SUPABASE_URL environment variable is required');
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Get it from: Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is required');
  console.error('Get it from: https://aistudio.google.com/app/apikey');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Gemini API endpoint
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Languages to translate (filter out English which is the base)
const LANGUAGES_TO_TRANSLATE = SUPPORTED_LANGUAGES.filter(l => l.code !== 'en');

// ============================================
// Helper Functions
// ============================================

/**
 * Get existing translation keys for a language from Supabase
 */
async function getExistingKeys(langCode: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('ui_translations')
    .select('key')
    .eq('lang_code', langCode);

  if (error) {
    console.error(`Error fetching existing keys for ${langCode}:`, error);
    return new Set();
  }

  return new Set(data?.map(row => row.key) || []);
}

/**
 * Find keys that are in BASE_TRANSLATIONS but not in Supabase
 */
async function getMissingKeys(langCode: string): Promise<string[]> {
  const existingKeys = await getExistingKeys(langCode);
  const allKeys = Object.keys(BASE_TRANSLATIONS);
  
  return allKeys.filter(key => !existingKeys.has(key));
}

/**
 * Call Gemini API to translate text
 */
async function translateWithGemini(
  targetLang: string, 
  targetLangName: string,
  dictionary: Record<string, string>
): Promise<Record<string, string>> {
  const prompt = `Translate the values of this JSON object into ${targetLangName} (language code: "${targetLang}").

IMPORTANT:
1. Return ONLY the JSON object, no explanations or markdown.
2. Maintain the exact same keys.
3. Keep translations natural for a mobile app interface.
4. For single letters (like day abbreviations), use appropriate single characters.
5. Keep placeholder patterns like {name} unchanged.
6. Keep abbreviations like "e.g." in their localized form.

JSON to translate:
${JSON.stringify(dictionary, null, 2)}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  return JSON.parse(text);
}

/**
 * Save translations to Supabase
 */
async function saveTranslations(
  langCode: string, 
  translations: Record<string, string>
): Promise<void> {
  const rows = Object.entries(translations).map(([key, value]) => ({
    lang_code: langCode,
    key,
    value,
    is_reviewed: false,
  }));

  // Upsert in batches of 100 to avoid payload limits
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('ui_translations')
      .upsert(batch, { 
        onConflict: 'lang_code,key',
        ignoreDuplicates: false 
      });

    if (error) {
      throw new Error(`Error saving translations: ${error.message}`);
    }
  }
}

// ============================================
// Main Script
// ============================================

async function main() {
  const forceOverwrite = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('========================================');
  console.log('  Helpy Translation Seeder');
  console.log('========================================');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Languages: ${LANGUAGES_TO_TRANSLATE.map(l => l.code).join(', ')}`);
  console.log(`  Total strings in BASE_TRANSLATIONS: ${Object.keys(BASE_TRANSLATIONS).length}`);
  console.log(`  Mode: ${forceOverwrite ? 'FORCE (re-translate all)' : 'INCREMENTAL (new keys only)'}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log('========================================\n');

  let totalNewKeys = 0;
  let totalTranslated = 0;
  let errorCount = 0;

  for (const { code, name } of LANGUAGES_TO_TRANSLATE) {
    console.log(`\n[${code}] ${name}`);
    console.log('─'.repeat(40));

    try {
      // Determine which keys need translation
      let keysToTranslate: string[];
      
      if (forceOverwrite) {
        // Force mode: translate everything
        keysToTranslate = Object.keys(BASE_TRANSLATIONS);
        console.log(`  Force mode: will translate all ${keysToTranslate.length} keys`);
      } else {
        // Incremental mode: only translate missing keys
        keysToTranslate = await getMissingKeys(code);
        
        if (keysToTranslate.length === 0) {
          console.log(`  All ${Object.keys(BASE_TRANSLATIONS).length} keys already translated`);
          continue;
        }
        
        console.log(`  Found ${keysToTranslate.length} new keys to translate`);
        totalNewKeys += keysToTranslate.length;
      }

      // Build dictionary of only the keys we need to translate
      const dictionaryToTranslate: Record<string, string> = {};
      for (const key of keysToTranslate) {
        dictionaryToTranslate[key] = BASE_TRANSLATIONS[key];
      }

      // Show preview in dry-run mode
      if (dryRun) {
        console.log(`  Would translate these keys:`);
        keysToTranslate.slice(0, 5).forEach(key => {
          console.log(`    - ${key}: "${BASE_TRANSLATIONS[key]}"`);
        });
        if (keysToTranslate.length > 5) {
          console.log(`    ... and ${keysToTranslate.length - 5} more`);
        }
        continue;
      }

      // Translate with Gemini
      console.log(`  Translating ${keysToTranslate.length} strings...`);
      const startTime = Date.now();
      const translations = await translateWithGemini(code, name, dictionaryToTranslate);
      const translateTime = Date.now() - startTime;
      console.log(`  Translation completed in ${(translateTime / 1000).toFixed(1)}s`);

      // Verify we got all keys
      const translatedKeys = Object.keys(translations).length;
      if (translatedKeys < keysToTranslate.length * 0.9) {
        console.warn(`  Warning: Only got ${translatedKeys}/${keysToTranslate.length} keys`);
      }

      // Save to Supabase
      console.log(`  Saving to database...`);
      await saveTranslations(code, translations);
      console.log(`  Saved ${translatedKeys} translations`);
      totalTranslated += translatedKeys;

    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : error}`);
      errorCount++;
    }

    // Add delay between languages to avoid rate limiting
    if (!dryRun) {
      console.log(`  Waiting 2 seconds before next language...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n========================================');
  console.log('  Summary');
  console.log('========================================');
  if (dryRun) {
    console.log(`  Dry run - no changes made`);
    console.log(`  Would translate: ${totalNewKeys} new keys across ${LANGUAGES_TO_TRANSLATE.length} languages`);
  } else {
    console.log(`  Total translated: ${totalTranslated} strings`);
    console.log(`  Errors: ${errorCount}`);
  }
  console.log('========================================\n');

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
