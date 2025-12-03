// hooks/useTranslatedContent.ts
// Hook for managing translated user-generated content

import { useState, useEffect, useCallback } from 'react';
import { translateUserContent } from '../services/geminiService';

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
  const [translatedText, setTranslatedText] = useState<string>(content);
  const [isTranslating, setIsTranslating] = useState(false);

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
        console.error('Translation error:', error);
        setTranslatedText(content); // Fallback to original
      } finally {
        setIsTranslating(false);
      }
    };

    performTranslation();
  }, [content, contentLang, currentLang, translations, isTranslating, onTranslationUpdate]);

  return translatedText;
};

