
import { GoogleGenAI, Type } from "@google/genai";
import { MealType, TranslationDictionary } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
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
      3. If target is 'zh-HK' or Cantonese, use colloquial Hong Kong phrasing where appropriate.
      4. Keep it natural for a mobile app interface.
      
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
