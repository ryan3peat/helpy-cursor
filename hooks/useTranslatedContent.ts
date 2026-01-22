// hooks/useTranslatedContent.ts
// Hook for managing translated user-generated content
// Registers with TranslationContext to track global translation state

import { useState, useEffect, useRef } from 'react';
import { translateUserContent } from '../services/geminiService';
import { useTranslationContextOptional } from '../contexts/TranslationContext';
import { logger } from '../utils/logger';

interface UseTranslatedContentOptions {
  content: string;
  contentLang: string | null | undefined;
  currentLang: string;
  translations?: Record<string, string>;
  onTranslationUpdate?: (translation: string) => void;
}

/**
 * Hook to get translated content with automatic translation when needed
 * @returns The translated text (or original if translation not needed/available)
 */
export const useTranslatedContent = ({
  content,
  contentLang,
  currentLang,
  translations = {},
  onTranslationUpdate,
}: UseTranslatedContentOptions): string => {
  // Initialize with cached translation if available (prevents flash from original to translated)
  const [translatedText, setTranslatedText] = useState<string>(() => {
    // If languages match or no contentLang, use original
    if (!contentLang || contentLang === currentLang) {
      return content;
    }
    // If we have a cached translation, use it immediately
    if (translations[currentLang]) {
      return translations[currentLang];
    }
    // Fallback to original (will be translated by useEffect)
    return content;
  });
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Get translation context (optional - may be null if not wrapped in provider)
  const translationContext = useTranslationContextOptional();
  
  // Track the current translation ID for cleanup
  const translationIdRef = useRef<string | null>(null);

  // Cleanup function to unregister translation on unmount or when done
  useEffect(() => {
    return () => {
      if (translationIdRef.current && translationContext) {
        translationContext.unregisterTranslation(translationIdRef.current);
        translationIdRef.current = null;
      }
    };
  }, [translationContext]);

  useEffect(() => {
    // If contentLang is null/empty, always display original (undetectable)
    if (!contentLang) {
      setTranslatedText(content);
      return;
    }

    // If languages match, display original (no translation needed)
    if (contentLang === currentLang) {
      setTranslatedText(content);
      return;
    }

    // Check if translation already exists in translations object
    if (translations[currentLang]) {
      setTranslatedText(translations[currentLang]);
      return;
    }

    // Need to translate - check if already translating to avoid duplicate calls
    if (isTranslating) return;

    // Translate the content
    const performTranslation = async () => {
      setIsTranslating(true);
      
      // Register with global context
      if (translationContext) {
        translationIdRef.current = translationContext.registerTranslation();
      }
      
      try {
        const translated = await translateUserContent(content, contentLang, currentLang);
        if (translated && translated !== content) {
          setTranslatedText(translated);
          // Notify parent component to update translations in database
          if (onTranslationUpdate) {
            onTranslationUpdate(translated);
          }
        } else {
          // Translation failed or returned original, use original
          setTranslatedText(content);
        }
      } catch (error) {
        logger.error('Translation error:', error);
        setTranslatedText(content); // Fallback to original
      } finally {
        setIsTranslating(false);
        
        // Unregister from global context
        if (translationIdRef.current && translationContext) {
          translationContext.unregisterTranslation(translationIdRef.current);
          translationIdRef.current = null;
        }
      }
    };

    performTranslation();
  }, [content, contentLang, currentLang, translations, isTranslating, onTranslationUpdate, translationContext]);

  return translatedText;
};
