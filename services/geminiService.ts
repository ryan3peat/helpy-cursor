
import { GoogleGenAI, Type } from "@google/genai";
import { MealType, TranslationDictionary } from "../types";

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found. AI features will return mock data.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const suggestMeal = async (mealType: MealType, cuisinePreference: string = "healthy"): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Grilled Chicken Salad with Quinoa (Mock Suggestion - No API Key)";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Suggest a single, concise meal name for ${mealType}. Preference: ${cuisinePreference}. Keep it under 10 words. No preamble.`,
    });
    return response.text || "Oatmeal with Berries";
  } catch (error) {
    console.error("Error suggesting meal:", error);
    return "Toast and Eggs (Fallback)";
  }
};

export const parseReceipt = async (base64Image: string): Promise<{ total: number; merchant: string; date: string; category: string }> => {
  const ai = getAiClient();
  if (!ai) {
    return {
      total: 45.50,
      merchant: "Mock Supermarket",
      date: new Date().toISOString().split('T')[0],
      category: "Food & Daily Needs"
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
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
      config: {
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
    });

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

  const ai = getAiClient();
  if (!ai) return baseDictionary; // Fallback

  // 2. Fetch from AI
  try {
    // Chunking logic could be added here if dictionary is huge, but ~50-100 keys is fine for one prompt.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the values of this JSON object into language code "${targetLangCode}". 
      IMPORTANT: 
      1. Return ONLY the JSON object.
      2. Maintain the exact same keys.
      3. Keep it natural for a mobile app interface.
      
      JSON to translate:
      ${JSON.stringify(baseDictionary)}`,
      config: {
        responseMimeType: "application/json"
      }
    });

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
  
  const ai = getAiClient();
  if (!ai) return text; // Fallback to original
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following text from language code "${sourceLang}" to language code "${targetLang}".
      
      IMPORTANT:
      1. Return ONLY the translated text, no explanations or additional text.
      2. Preserve any formatting, numbers, or special characters.
      3. Keep the translation natural and contextually appropriate.
      
      Text to translate:
      ${text}`,
    });
    
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
    item.text.trim().length > 0
  );
  
  // If nothing to translate, return originals
  if (itemsToTranslate.length === 0) {
    return items.map(item => item.text);
  }
  
  const ai = getAiClient();
  if (!ai) {
    return items.map(item => item.text); // Fallback to originals
  }
  
  try {
    // Build prompt with all items
    const itemsList = itemsToTranslate.map((item, index) => 
      `${index + 1}. [${item.sourceLang}] ${item.text}`
    ).join('\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following items from their source languages to language code "${targetLang}".
      
      IMPORTANT:
      1. Return ONLY a JSON array of translated strings in the same order.
      2. Preserve any formatting, numbers, or special characters.
      3. Keep translations natural and contextually appropriate.
      4. If an item is already in the target language, return it unchanged.
      
      Items to translate:
      ${itemsList}
      
      Return format: ["translated text 1", "translated text 2", ...]`,
      config: {
        responseMimeType: "application/json"
      }
    });
    
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
