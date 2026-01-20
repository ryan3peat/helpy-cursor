/**
 * seed-translations.ts
 * 
 * Script to generate and sync translations for all supported languages.
 * 
 * FEATURES:
 *   - Imports BASE_TRANSLATIONS from constants.ts (single source of truth)
 *   - Incremental mode (default): translates NEW + CHANGED + SUSPICIOUS keys
 *   - Force mode: re-translates everything (--force flag)
 *   - Suspicious detection: Finds translations identical to English (failed API calls)
 *   - Pagination: Properly handles >1000 translations (CRITICAL - see getExistingKeys/getEnglishTranslations)
 * 
 * IMPORTANT: The pagination logic in getExistingKeys() and getEnglishTranslations() is CRITICAL.
 * Without it, Supabase's 1000-row default limit causes the script to miss existing translations,
 * resulting in unnecessary re-translations. DO NOT remove or simplify these functions!
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
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env files (try multiple locations)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

// Import BASE_TRANSLATIONS from constants.ts (single source of truth!)
import { BASE_TRANSLATIONS, SUPPORTED_LANGUAGES } from '../constants';

// ============================================
// Configuration
// ============================================

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GOOGLE_CLOUD_VISION_API_KEY;

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

// Key prefixes that should ALWAYS remain in English (intentionally not translated)
// These are legal/official content or auth screens that must stay in English
const ENGLISH_ONLY_PREFIXES = [
  'auth.',        // Auth screens
  'signIn.',      // Sign in flow
  'signUp.',      // Sign up flow  
  'invite.',      // Invite flow
  'pdf.',         // PDF content (legal/official documents)
];

/**
 * Check if a key should remain in English (not translated)
 */
function shouldRemainEnglish(key: string): boolean {
  return ENGLISH_ONLY_PREFIXES.some(prefix => key.startsWith(prefix));
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get existing translation keys for a language from Supabase
 * 
 * CRITICAL: This function MUST use pagination to fetch ALL keys.
 * 
 * Without pagination, Supabase queries default to a 1000-row limit.
 * If we have more than 1000 translations (we currently have 1123+),
 * the script would only see the first 1000 and incorrectly think
 * the remaining keys are missing, causing unnecessary re-translations.
 * 
 * This pagination logic MUST be preserved - do not remove it!
 * 
 * @param langCode - Language code to fetch keys for
 * @returns Set of all existing translation keys for the language
 */
async function getExistingKeys(langCode: string): Promise<Set<string>> {
  const allKeys: string[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ui_translations')
      .select('key')
      .eq('lang_code', langCode)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`Error fetching existing keys for ${langCode}:`, error);
      return new Set();
    }

    if (data && data.length > 0) {
      allKeys.push(...data.map(row => row.key));
      hasMore = data.length === pageSize;
      from += pageSize;
    } else {
      hasMore = false;
    }
  }

  return new Set(allKeys);
}

/**
 * Get existing English translations with their values
 * 
 * CRITICAL: This function MUST use pagination to fetch ALL translations.
 * 
 * Without pagination, Supabase queries default to a 1000-row limit.
 * If we have more than 1000 English translations, the script would only
 * see the first 1000 and incorrectly think the remaining keys are missing,
 * causing unnecessary re-translations.
 * 
 * This pagination logic MUST be preserved - do not remove it!
 * 
 * @returns Map of all existing English translation keys and values
 */
async function getEnglishTranslations(): Promise<Map<string, string>> {
  const translations = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ui_translations')
      .select('key, value')
      .eq('lang_code', 'en')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching English translations:', error);
      return new Map();
    }

    if (data && data.length > 0) {
      data.forEach(row => {
        translations.set(row.key, row.value);
      });
      hasMore = data.length === pageSize;
      from += pageSize;
    } else {
      hasMore = false;
    }
  }

  return translations;
}

/**
 * Find keys where the English value has changed in BASE_TRANSLATIONS
 */
async function getChangedEnglishKeys(): Promise<string[]> {
  const existingEnglish = await getEnglishTranslations();
  const changedKeys: string[] = [];
  
  for (const [key, newValue] of Object.entries(BASE_TRANSLATIONS)) {
    const existingValue = existingEnglish.get(key);
    if (existingValue !== undefined && existingValue !== newValue) {
      changedKeys.push(key);
      console.log(`  Changed: "${key}": "${existingValue}" -> "${newValue}"`);
    }
  }
  
  return changedKeys;
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
 * Get all existing translations for a language (key + value)
 * 
 * CRITICAL: Uses pagination to fetch ALL translations (>1000 rows)
 * 
 * @param langCode - Language code to fetch translations for
 * @returns Map of translation keys to their values
 */
async function getExistingTranslations(langCode: string): Promise<Map<string, string>> {
  const translations = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ui_translations')
      .select('key, value')
      .eq('lang_code', langCode)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`Error fetching translations for ${langCode}:`, error);
      return new Map();
    }

    if (data && data.length > 0) {
      data.forEach(row => {
        translations.set(row.key, row.value);
      });
      hasMore = data.length === pageSize;
      from += pageSize;
    } else {
      hasMore = false;
    }
  }

  return translations;
}

/**
 * Find "suspicious" translations where the translated value is IDENTICAL to the English source.
 * This indicates a failed translation (API returned English instead of translating).
 * 
 * Excludes keys that are legitimately the same in both languages:
 * - Single characters (day abbreviations like "M", "T", etc.)
 * - Technical terms (HK$, URLs, etc.)
 * - Placeholders that contain only {variables}
 * - Keys that should ALWAYS remain in English (auth, sign in/up, invite, PDF content)
 * 
 * @param langCode - Language code to check
 * @returns Array of keys that need re-translation
 */
async function getSuspiciousTranslations(langCode: string): Promise<string[]> {
  const existingTranslations = await getExistingTranslations(langCode);
  const suspiciousKeys: string[] = [];
  
  for (const [key, englishValue] of Object.entries(BASE_TRANSLATIONS)) {
    const translatedValue = existingTranslations.get(key);
    
    // Skip if no translation exists (will be caught by getMissingKeys)
    if (translatedValue === undefined) continue;
    
    // Skip if the translation is different from English (it's fine)
    if (translatedValue !== englishValue) continue;
    
    // At this point, translation === English. Check if it's legitimately the same:
    
    // 0. Skip keys that should ALWAYS remain in English
    if (shouldRemainEnglish(key)) continue;
    
    // 1. Skip single characters (day abbreviations, etc.)
    if (englishValue.length <= 2) continue;
    
    // 2. Skip purely numeric or symbolic values (HK$, %, etc.)
    if (/^[0-9$%HK\s.,]+$/.test(englishValue)) continue;
    
    // 3. Skip values that are only placeholders like {name} or {count}
    if (/^\{[^}]+\}$/.test(englishValue)) continue;
    
    // 4. Skip URLs and technical strings
    if (englishValue.startsWith('http') || englishValue.includes('://')) continue;
    
    // 5. Skip common words that might legitimately be the same
    const commonSameWords = ['OK', 'Email', 'ID', 'PDF', 'URL', 'PIN', 'SMS', 'WiFi', 'App'];
    if (commonSameWords.includes(englishValue)) continue;
    
    // This translation is suspicious - English string stored as "translation"
    suspiciousKeys.push(key);
  }
  
  return suspiciousKeys;
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

  let response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (fetchError) {
    const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`Network error connecting to Gemini API: ${errorMsg}`);
  }

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
  console.log(`  Mode: ${forceOverwrite ? 'FORCE (re-translate all)' : 'INCREMENTAL (new + changed + suspicious)'}`);
  console.log(`  Dry run: ${dryRun}`);
  if (!forceOverwrite) {
    console.log(`  Note: Suspicious = translations identical to English (failed API calls)`);
  }
  console.log('========================================\n');

  let totalNewKeys = 0;
  let totalTranslated = 0;
  let errorCount = 0;

  // Step 1: Check for changed English source values
  console.log('[en] Checking for changed English source values...');
  console.log('─'.repeat(40));
  const changedKeys = await getChangedEnglishKeys();
  
  if (changedKeys.length > 0) {
    console.log(`  Found ${changedKeys.length} keys with changed English values`);
    
    if (!dryRun) {
      // Update English translations first
      const englishUpdates: Record<string, string> = {};
      for (const key of changedKeys) {
        englishUpdates[key] = BASE_TRANSLATIONS[key];
      }
      console.log(`  Updating English translations...`);
      await saveTranslations('en', englishUpdates);
      console.log(`  Updated ${changedKeys.length} English keys`);
    } else {
      console.log(`  Would update ${changedKeys.length} English keys`);
    }
  } else {
    console.log(`  No changed English values detected`);
  }

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
        // Incremental mode: translate missing keys + changed keys + suspicious keys
        const missingKeys = await getMissingKeys(code);
        const suspiciousKeys = await getSuspiciousTranslations(code);
        
        // Combine all keys that need translation (deduplicated)
        const keysSet = new Set([...missingKeys, ...changedKeys, ...suspiciousKeys]);
        keysToTranslate = Array.from(keysSet);
        
        if (keysToTranslate.length === 0) {
          console.log(`  All ${Object.keys(BASE_TRANSLATIONS).length} keys already translated and up to date`);
          continue;
        }
        
        if (missingKeys.length > 0) {
          console.log(`  Found ${missingKeys.length} new keys to translate`);
        }
        if (changedKeys.length > 0) {
          console.log(`  Found ${changedKeys.length} changed keys to re-translate`);
        }
        if (suspiciousKeys.length > 0) {
          console.log(`  Found ${suspiciousKeys.length} suspicious keys (English stored as translation)`);
          // Show a few examples
          suspiciousKeys.slice(0, 3).forEach(key => {
            console.log(`    - ${key}: "${BASE_TRANSLATIONS[key]}"`);
          });
          if (suspiciousKeys.length > 3) {
            console.log(`    ... and ${suspiciousKeys.length - 3} more`);
          }
        }
        totalNewKeys += keysToTranslate.length;
      }

      // Filter out keys that should remain in English (auth, sign in/up, invite, PDF)
      const keysToActuallyTranslate = keysToTranslate.filter(key => !shouldRemainEnglish(key));
      const skippedEnglishOnly = keysToTranslate.length - keysToActuallyTranslate.length;
      
      if (skippedEnglishOnly > 0) {
        console.log(`  Skipping ${skippedEnglishOnly} keys that must remain in English`);
      }
      
      if (keysToActuallyTranslate.length === 0) {
        console.log(`  No keys need translation after filtering`);
        continue;
      }
      
      // Build dictionary of only the keys we need to translate
      const dictionaryToTranslate: Record<string, string> = {};
      for (const key of keysToActuallyTranslate) {
        dictionaryToTranslate[key] = BASE_TRANSLATIONS[key];
      }

      // Show preview in dry-run mode
      if (dryRun) {
        console.log(`  Would translate these keys:`);
        keysToActuallyTranslate.slice(0, 5).forEach(key => {
          console.log(`    - ${key}: "${BASE_TRANSLATIONS[key]}"`);
        });
        if (keysToActuallyTranslate.length > 5) {
          console.log(`    ... and ${keysToActuallyTranslate.length - 5} more`);
        }
        continue;
      }

      // Translate with Gemini
      console.log(`  Translating ${keysToActuallyTranslate.length} strings...`);
      const startTime = Date.now();
      const translations = await translateWithGemini(code, name, dictionaryToTranslate);
      const translateTime = Date.now() - startTime;
      console.log(`  Translation completed in ${(translateTime / 1000).toFixed(1)}s`);

      // Verify we got all keys
      const translatedKeys = Object.keys(translations).length;
      if (translatedKeys < keysToActuallyTranslate.length * 0.9) {
        console.warn(`  Warning: Only got ${translatedKeys}/${keysToActuallyTranslate.length} keys`);
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
