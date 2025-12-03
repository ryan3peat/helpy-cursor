// services/languageDetectionService.ts
// Browser-based language detection for user-generated content

import { SUPPORTED_LANGUAGES } from '../constants';

/**
 * Detects the input language based on browser settings
 * Falls back to current UI language if detection fails
 * Returns null if language cannot be determined
 * 
 * @param currentUILang - The current UI language code (e.g., 'en', 'zh-CN')
 * @returns Detected language code or null if undetectable
 */
export const detectInputLanguage = (currentUILang: string): string | null => {
  // Get supported language codes
  const supportedCodes = SUPPORTED_LANGUAGES.map(lang => lang.code);
  
  // Try to detect from browser language
  if (typeof navigator !== 'undefined') {
    // Check primary language
    if (navigator.language) {
      const detected = mapBrowserLanguageToSupported(navigator.language, supportedCodes);
      if (detected) return detected;
    }
    
    // Check all browser languages
    if (navigator.languages && navigator.languages.length > 0) {
      for (const browserLang of navigator.languages) {
        const detected = mapBrowserLanguageToSupported(browserLang, supportedCodes);
        if (detected) return detected;
      }
    }
  }
  
  // Fallback to current UI language if it's supported
  if (supportedCodes.includes(currentUILang)) {
    return currentUILang;
  }
  
  // If all else fails, return null (will display original)
  return null;
};

/**
 * Maps browser language code to supported app language code
 * Handles variations like 'zh' -> 'zh-CN', 'zh-TW'
 */
const mapBrowserLanguageToSupported = (
  browserLang: string,
  supportedCodes: string[]
): string | null => {
  // Normalize browser language (lowercase, handle region codes)
  const normalized = browserLang.toLowerCase();
  
  // Direct match
  if (supportedCodes.includes(normalized)) {
    return normalized;
  }
  
  // Handle language without region (e.g., 'zh' -> prefer 'zh-CN')
  const langBase = normalized.split('-')[0];
  
  // Special mappings
  const languageMappings: Record<string, string> = {
    'zh': 'zh-CN', // Default Chinese to Simplified
    'zh-hans': 'zh-CN',
    'zh-hant': 'zh-TW',
    'fil': 'tl', // Filipino -> Tagalog
    'in': 'id', // Indonesian (old code)
  };
  
  // Check if we have a mapping
  if (languageMappings[normalized] && supportedCodes.includes(languageMappings[normalized])) {
    return languageMappings[normalized];
  }
  
  // Try to find any supported language that starts with the base
  const match = supportedCodes.find(code => code.toLowerCase().startsWith(langBase));
  if (match) {
    return match;
  }
  
  return null;
};

