// services/translationService.ts
// Loads pre-translated UI strings from Supabase instead of live AI translation
// This is much faster and costs nothing after initial seed

import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { BASE_TRANSLATIONS, SUPPORTED_LANGUAGES } from '../constants';
import { TranslationDictionary } from '../types';

// In-memory cache for translations (survives within session)
const translationCache: Record<string, TranslationDictionary> = {};

// Cache version - AUTO-INVALIDATES when new keys are added to BASE_TRANSLATIONS
// No more manual version bumping needed!
const BASE_KEY_COUNT = Object.keys(BASE_TRANSLATIONS).length;
const CACHE_VERSION = `v6-${BASE_KEY_COUNT}`;

/**
 * Get static translations from Supabase
 * 
 * Loading order:
 * 1. English: Return BASE_TRANSLATIONS directly (no database needed)
 * 2. Other languages: Check memory cache → localStorage cache → Supabase
 * 
 * @param lang - Language code (e.g., 'zh-CN', 'tl', 'ja')
 * @returns TranslationDictionary with all translated strings
 */
export async function getStaticTranslations(lang: string): Promise<TranslationDictionary> {
  // English is the base - no translation needed
  if (lang === 'en') {
    return BASE_TRANSLATIONS;
  }

  // Check if this is a supported language
  const isSupported = SUPPORTED_LANGUAGES.some(l => l.code === lang);
  if (!isSupported) {
    logger.warn(`Language "${lang}" is not supported, falling back to English`);
    return BASE_TRANSLATIONS;
  }

  // Check memory cache first (instant) - but validate it has all keys
  // This prevents using incomplete cached data from earlier in the session
  if (translationCache[lang] && Object.keys(translationCache[lang]).length >= BASE_KEY_COUNT) {
    return translationCache[lang];
  }

  // Check localStorage cache (fast, survives page refresh)
  const cacheKey = `helpy_i18n_${CACHE_VERSION}_${lang}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as TranslationDictionary;
      // Verify cache has ALL keys (strict check - cache version already handles invalidation)
      if (Object.keys(parsed).length >= BASE_KEY_COUNT) {
        translationCache[lang] = parsed;
        return parsed;
      }
    } catch (e) {
      logger.warn('Invalid translation cache, fetching from database');
    }
  }

  // Fetch from Supabase WITH PAGINATION
  // CRITICAL: Supabase defaults to 1000 row limit. We have 1100+ translations,
  // so we MUST paginate to fetch all of them. Without this, ~147 translations
  // would be missing (including salary.* keys).
  try {
    const allTranslations: { key: string; value: string }[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('ui_translations')
        .select('key, value')
        .eq('lang_code', lang)
        .range(from, from + pageSize - 1);

      if (error) {
        logger.error('Error fetching translations:', error);
        return BASE_TRANSLATIONS;
      }

      if (data && data.length > 0) {
        allTranslations.push(...data);
        hasMore = data.length === pageSize;
        from += pageSize;
      } else {
        hasMore = false;
      }
    }

    // If no translations found, return base (maybe seed hasn't run yet)
    if (allTranslations.length === 0) {
      logger.warn(`No translations found for "${lang}", using English`);
      return BASE_TRANSLATIONS;
    }

    // Convert array to dictionary, merging with base for any missing keys
    const translations: TranslationDictionary = { ...BASE_TRANSLATIONS };
    allTranslations.forEach(row => {
      translations[row.key] = row.value;
    });

    // Save to localStorage cache
    localStorage.setItem(cacheKey, JSON.stringify(translations));

    // Save to memory cache
    translationCache[lang] = translations;

    return translations;
  } catch (error) {
    logger.error('Failed to load translations:', error);
    return BASE_TRANSLATIONS;
  }
}

/**
 * Clear translation cache for a specific language or all languages
 * Useful for admin/testing or after updating translations
 * 
 * @param lang - Optional language code. If not provided, clears all caches.
 */
export function clearTranslationCache(lang?: string): void {
  if (lang) {
    // Clear specific language
    delete translationCache[lang];
    localStorage.removeItem(`helpy_i18n_${CACHE_VERSION}_${lang}`);
  } else {
    // Clear all languages
    Object.keys(translationCache).forEach(key => delete translationCache[key]);
    
    // Clear all translation keys from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('helpy_i18n_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}

/**
 * Check if translations are loaded for a language
 * @param lang - Language code
 * @returns true if translations are in memory cache
 */
export function isTranslationCached(lang: string): boolean {
  return lang === 'en' || !!translationCache[lang];
}

/**
 * Preload translations for a language (non-blocking)
 * Useful for preloading common languages on app start
 * 
 * @param lang - Language code to preload
 */
export function preloadTranslations(lang: string): void {
  if (lang !== 'en' && !translationCache[lang]) {
    getStaticTranslations(lang).catch(err => {
      logger.warn(`Failed to preload translations for ${lang}:`, err);
    });
  }
}

