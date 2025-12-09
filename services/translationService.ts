// services/translationService.ts
// Loads pre-translated UI strings from Supabase instead of live AI translation
// This is much faster and costs nothing after initial seed

import { supabase } from './supabase';
import { BASE_TRANSLATIONS, SUPPORTED_LANGUAGES } from '../constants';
import { TranslationDictionary } from '../types';

// In-memory cache for translations (survives within session)
const translationCache: Record<string, TranslationDictionary> = {};

// Cache version - increment this when BASE_TRANSLATIONS changes significantly
// This will invalidate old localStorage caches
const CACHE_VERSION = 'v1';

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
    console.warn(`Language "${lang}" is not supported, falling back to English`);
    return BASE_TRANSLATIONS;
  }

  // Check memory cache first (instant)
  if (translationCache[lang]) {
    return translationCache[lang];
  }

  // Check localStorage cache (fast, survives page refresh)
  const cacheKey = `helpy_i18n_${CACHE_VERSION}_${lang}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as TranslationDictionary;
      // Verify cache has reasonable number of keys
      if (Object.keys(parsed).length >= Object.keys(BASE_TRANSLATIONS).length * 0.8) {
        translationCache[lang] = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn('Invalid translation cache, fetching from database');
    }
  }

  // Fetch from Supabase
  try {
    const { data, error } = await supabase
      .from('ui_translations')
      .select('key, value')
      .eq('lang_code', lang);

    if (error) {
      console.error('Error fetching translations:', error);
      return BASE_TRANSLATIONS;
    }

    // If no translations found, return base (maybe seed hasn't run yet)
    if (!data || data.length === 0) {
      console.warn(`No translations found for "${lang}", using English`);
      return BASE_TRANSLATIONS;
    }

    // Convert array to dictionary, merging with base for any missing keys
    const translations: TranslationDictionary = { ...BASE_TRANSLATIONS };
    data.forEach(row => {
      translations[row.key] = row.value;
    });

    // Save to localStorage cache
    localStorage.setItem(cacheKey, JSON.stringify(translations));

    // Save to memory cache
    translationCache[lang] = translations;

    return translations;
  } catch (error) {
    console.error('Failed to load translations:', error);
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
      console.warn(`Failed to preload translations for ${lang}:`, err);
    });
  }
}

