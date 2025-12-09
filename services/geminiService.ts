
import { Type } from "@google/genai";
import { MealType, TranslationDictionary } from "../types";

// Regex patterns for content that should NOT be translated based on ISO/industry standards
const NON_TRANSLATABLE_PATTERNS = [
  /^[A-Z]{2,3}$/,              // Country codes (HK, US, USA)
  /^\+\d+[\d\s-]*$/,           // Phone numbers with country code
  /^https?:\/\//,              // URLs
  /^[\w.-]+@[\w.-]+\.\w+$/,    // Email addresses
  /^HK\$[\d,.]+$/,             // Currency amounts (HK$)
  /^\d{4}-\d{2}-\d{2}$/,       // ISO Dates
];

/**
 * Checks if text matches any non-translatable pattern
 */
const isNonTranslatable = (text: string): boolean => {
  const trimmed = text.trim();
  return NON_TRANSLATABLE_PATTERNS.some(pattern => pattern.test(trimmed));
};

// Helper function to call Gemini API through server proxy
const callGeminiProxy = async (contents: string | any, config?: { responseMimeType?: string; responseSchema?: any }) => {
  try {
    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents, config }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract text from Gemini response format
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content;
      if (content.parts && content.parts[0]) {
        return {
          text: content.parts[0].text || '',
          data: data,
        };
      }
    }
    
    // Fallback: try to extract text directly
    return {
      text: data.text || '',
      data: data,
    };
  } catch (error) {
    console.error('Gemini proxy error:', error);
    throw error;
  }
};

export const suggestMeal = async (mealType: MealType, cuisinePreference: string = "healthy"): Promise<string> => {
  try {
    const response = await callGeminiProxy(
      `Suggest a single, concise meal name for ${mealType}. Preference: ${cuisinePreference}. Keep it under 10 words. No preamble.`
    );
    return response.text || "Oatmeal with Berries";
  } catch (error) {
    console.error("Error suggesting meal:", error);
    return "Toast and Eggs (Fallback)";
  }
};

export const parseReceipt = async (base64Image: string): Promise<{ total: number; merchant: string; date: string; category: string }> => {
  try {
    const response = await callGeminiProxy(
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: "Analyze this receipt. Return a JSON object with 'total' (number), 'merchant' (string), 'date' (YYYY-MM-DD string), and 'category' (one of: Housing & Utilities, Food & Daily Needs, Transport & Travel, Health & Personal Care, Fun & Lifestyle, Miscellaneous).",
          },
        ],
      },
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.NUMBER },
            merchant: { type: Type.STRING },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ["total", "merchant", "date", "category"]
        }
      }
    );

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("Receipt parsing failed:", error);
    return { total: 0, merchant: "Unknown", date: "", category: "Miscellaneous" };
  }
};

// --- Translation Service ---

export const getAppTranslations = async (targetLangCode: string, baseDictionary: TranslationDictionary): Promise<TranslationDictionary> => {
  // 1. Check Cache
  const cacheKey = `helpy_i18n_${targetLangCode}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Check if cache has enough keys (simple heuristic)
      if (Object.keys(parsed).length >= Object.keys(baseDictionary).length * 0.8) {
        return { ...baseDictionary, ...parsed }; // Merge with base to ensure no missing keys
      }
    } catch (e) {
      console.warn("Invalid cache, refetching.");
    }
  }

  // 2. Fetch from AI
  try {
    // Chunking logic could be added here if dictionary is huge, but ~50-100 keys is fine for one prompt.
    const response = await callGeminiProxy(
      `Translate the values of this JSON object into language code "${targetLangCode}". 
      IMPORTANT: 
      1. Return ONLY the JSON object.
      2. Maintain the exact same keys.
      3. Keep it natural for a mobile app interface.
      
      JSON to translate:
      ${JSON.stringify(baseDictionary)}`,
      {
        responseMimeType: "application/json"
      }
    );

    const text = response.text;
    if (!text) throw new Error("Empty response from translation");
    
    const translatedDict = JSON.parse(text);
    
    // 3. Save to Cache
    localStorage.setItem(cacheKey, JSON.stringify(translatedDict));
    
    return { ...baseDictionary, ...translatedDict };
  } catch (error) {
    console.error("Translation failed:", error);
    return baseDictionary; // Fallback to English
  }
};

// --- User Content Translation Service ---

/**
 * Translates a single piece of user-generated content
 * @param text - The text to translate
 * @param sourceLang - Source language code (e.g., 'en', 'zh-CN')
 * @param targetLang - Target language code (e.g., 'zh-CN', 'en')
 * @returns Translated text, or original text if translation fails
 */
export const translateUserContent = async (
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> => {
  // If languages are the same, return original
  if (sourceLang === targetLang) {
    return text;
  }
  
  // If source language is null/empty, return original (undetectable)
  if (!sourceLang) {
    return text;
  }
  
  // Check for non-translatable content first
  if (isNonTranslatable(text)) {
    return text;
  }
  
  try {
    const response = await callGeminiProxy(
      `Translate the following text from language code "${sourceLang}" to language code "${targetLang}".
      
      IMPORTANT RULES:
      1. Return ONLY the translated text, no explanations or additional text.
      2. Preserve any formatting, numbers, or special characters.
      3. Keep the translation natural and contextually appropriate.
      4. DO NOT translate:
         - Proper names (people, specific places)
         - Addresses (keep street names/numbers as is)
         - Business names / Brands
         - URLs, Emails, Phone numbers
      
      Text to translate:
      ${text}`
    );
    
    const translated = response.text?.trim();
    return translated || text; // Return original if empty response
  } catch (error) {
    console.error("User content translation failed:", error);
    return text; // Fallback to original
  }
};

/**
 * Batch translates multiple pieces of user-generated content
 * More efficient than calling translateUserContent multiple times
 * @param items - Array of items with text and sourceLang
 * @param targetLang - Target language code
 * @returns Array of translated texts (or originals if translation fails)
 */
export const batchTranslateUserContent = async (
  items: Array<{ text: string; sourceLang: string }>,
  targetLang: string
): Promise<string[]> => {
  // Filter out items that don't need translation
  const itemsToTranslate = items.filter(item => 
    item.sourceLang && 
    item.sourceLang !== targetLang && 
    item.text.trim().length > 0 &&
    !isNonTranslatable(item.text)
  );
  
  // If nothing to translate, return originals
  if (itemsToTranslate.length === 0) {
    return items.map(item => item.text);
  }
  
  try {
    // Build prompt with all items
    const itemsList = itemsToTranslate.map((item, index) => 
      `${index + 1}. [${item.sourceLang}] ${item.text}`
    ).join('\n');
    
    const response = await callGeminiProxy(
      `Translate the following items from their source languages to language code "${targetLang}".
      
      IMPORTANT RULES:
      1. Return ONLY a JSON array of translated strings in the same order.
      2. Preserve any formatting, numbers, or special characters.
      3. Keep translations natural and contextually appropriate.
      4. If an item is already in the target language, return it unchanged.
      5. DO NOT translate:
         - Proper names (people, specific places)
         - Addresses (keep street names/numbers as is)
         - Business names / Brands
         - URLs, Emails, Phone numbers
      
      Items to translate:
      ${itemsList}
      
      Return format: ["translated text 1", "translated text 2", ...]`,
      {
        responseMimeType: "application/json"
      }
    );
    
    const text = response.text;
    if (!text) throw new Error("Empty response from batch translation");
    
    const translatedArray = JSON.parse(text);
    
    // Map translations back to original order
    let translationIndex = 0;
    return items.map(item => {
      if (item.sourceLang && item.sourceLang !== targetLang && item.text.trim().length > 0) {
        const translated = translatedArray[translationIndex++];
        return translated || item.text; // Fallback to original if missing
      }
      return item.text; // Return original if no translation needed
    });
  } catch (error) {
    console.error("Batch translation failed:", error);
    return items.map(item => item.text); // Fallback to originals
  }
};
