// api/ocr-process.ts
// Server-side proxy for DashScope Qwen-VL API to avoid CORS issues

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline logger to avoid module resolution issues in Vercel serverless
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

// Use international endpoint for international edition accounts
const DASHSCOPE_API_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_MODEL = 'qwen-vl-ocr';

interface QwenVLRequest {
  base64Image: string;
  prompt?: string; // Optional custom prompt for retry/specialized passes
}

interface QwenVLResponse {
  output?: {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  code?: string;
  message?: string;
  request_id?: string;
}

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost') || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logger.log('[OCR API] Received OCR request');
    
    const apiKey = process.env.ALIBABA_CLOUD_API_KEY?.trim();
    
    if (!apiKey) {
      logger.error('[OCR API] API key not configured');
      return res.status(500).json({ 
        error: 'Alibaba Cloud API key not configured on server' 
      });
    }

    // Validate API key format (should start with 'sk-')
    if (!apiKey.startsWith('sk-')) {
      logger.error('[OCR API] Invalid API key format');
      return res.status(500).json({ 
        error: 'Invalid API key format. Alibaba Cloud API keys should start with "sk-"' 
      });
    }

    logger.log('[OCR API] API key validated, length:', apiKey.length);

    const { base64Image, prompt: customPrompt }: QwenVLRequest = req.body;

    if (!base64Image) {
      logger.error('[OCR API] Missing base64Image in request');
      return res.status(400).json({ error: 'base64Image is required' });
    }

    logger.log('[OCR API] Image received, base64 length:', base64Image.length);
    if (customPrompt) {
      logger.log('[OCR API] Using custom prompt (retry/handwriting pass)');
    }

    // Qwen-VL expects base64 image in data URI format
    const imageDataUri = `data:image/jpeg;base64,${base64Image}`;

    const defaultPrompt = `You are a receipt OCR specialist for Hong Kong.
Extract the following fields from this receipt as JSON:
{
  "merchant": "store name",
  "date": "YYYY-MM-DD",
  "currency": "HKD",
  "total": 0.00,
  "category": "one of: Food & Daily Needs, Transport & Travel, Housing & Utilities, Health & Personal Care, Fun & Lifestyle, Other",
  "line_items": [{"name": "item", "price": 0.00}],
  "language": "detected language of receipt"
}

IMPORTANT: This receipt may contain Chinese (繁體中文/简体中文) characters.
Preserve all Chinese text exactly as written. Do NOT transliterate Chinese
characters into numbers or ASCII. If a merchant name is "大家樂", return
"大家樂", not a number sequence.

If the receipt contains both Chinese and English text, return both.
Format: "Chinese Name (English Name)" e.g. "百佳超級市場 (PARKnSHOP)"

This receipt may be from a wet market / street vendor with HANDWRITTEN amounts:
- MERCHANT: The shop name is often on a PRE-PRINTED label (sometimes RED) at the top — read that label
- HANDWRITTEN TOTAL: Look for BLUE or BLACK ink pen/ballpoint/marker strokes on the receipt.
  The handwritten amount is typically 2-3 large digits written in cursive/casual handwriting,
  noticeably bigger than any printed text (roughly 30-50pt equivalent size).
  This handwritten number IS the total amount in HKD (e.g. "35", "68", "120").
  Decipher these ink strokes carefully — they are the most important part of this receipt.
- Dates are often in DD/MM format
- If text is illegible, return your best guess

Rules:
- For Chinese characters, preserve them accurately, do NOT convert to numbers
- Preserve original merchant name including Chinese characters
- Dates: use YYYY-MM-DD format
- Currency: default HKD for Hong Kong receipts
- Return ONLY valid JSON, no markdown fences`;

    const requestBody = {
      model: QWEN_MODEL,
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                image: imageDataUri,
              },
              {
                text: customPrompt || defaultPrompt,
              },
            ],
          },
        ],
      },
      parameters: {
        temperature: 0.1, // Low temperature for more deterministic OCR results
      },
    };

    logger.log('[OCR API] Calling DashScope API:', DASHSCOPE_API_URL);
    logger.log('[OCR API] Model:', QWEN_MODEL);

    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    logger.log('[OCR API] DashScope API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[OCR API] DashScope API error:', response.status);
      logger.error('[OCR API] Error response:', errorText);
      
      let errorMessage = `Qwen-VL API error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error?.message || errorMessage;
        
        // Provide more helpful error messages for common issues
        if (response.status === 401) {
          if (errorMessage.includes('Invalid API-key') || errorMessage.includes('invalid') || errorMessage.includes('unauthorized')) {
            errorMessage = 'Invalid API key. Please verify your Alibaba Cloud API key is correct and has access to DashScope services.';
          }
        }
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      
      return res.status(response.status).json({ error: errorMessage });
    }

    const data: QwenVLResponse = await response.json();

    // Log API response for debugging
    logger.log('[OCR API] DashScope API call successful');
    logger.log('[OCR API] Response structure:', {
      hasOutput: !!data.output,
      hasChoices: !!data.output?.choices,
      choicesLength: data.output?.choices?.length || 0,
      hasContent: !!data.output?.choices?.[0]?.message?.content,
      contentType: typeof data.output?.choices?.[0]?.message?.content,
      code: data.code,
      message: data.message,
    });

    // Check for API-level errors
    if (data.code && data.code !== 'Success') {
      logger.error('[OCR API] DashScope API error:', data.code, data.message);
      return res.status(500).json({ 
        error: `Qwen-VL API error: ${data.message || data.code}` 
      });
    }

    // Extract text from response — content may be string, object, or array at runtime
    // despite the interface typing, so we handle all cases defensively.
    let fullText: string;
    const rawContent: unknown = data.output?.choices?.[0]?.message?.content;

    if (typeof rawContent === 'string') {
      fullText = rawContent;
    } else if (Array.isArray(rawContent)) {
      logger.log('[OCR API] Content is an array, joining elements');
      fullText = rawContent.map((item: unknown) =>
        typeof item === 'string' ? item : JSON.stringify(item)
      ).join('\n');
    } else if (rawContent && typeof rawContent === 'object') {
      logger.log('[OCR API] Content is an object, extracting text');
      const obj = rawContent as Record<string, unknown>;
      fullText = String(obj.text || obj.content || JSON.stringify(rawContent));
    } else {
      fullText = String(rawContent || '');
    }

    if (!fullText || fullText.trim().length === 0) {
      logger.error('[OCR API] No text content extracted from response');
      return res.status(500).json({ 
        error: 'No text detected in image. The Qwen-VL model did not return any text content.' 
      });
    }

    logger.log('[OCR API] Successfully extracted text, length:', fullText.length);
    logger.log('[OCR API] Text preview (first 200 chars):', fullText.substring(0, 200));

    // Return the extracted text
    return res.status(200).json({ text: fullText });

  } catch (error) {
    logger.error('[OCR API] Unexpected error during OCR processing:', error);
    logger.error('[OCR API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

