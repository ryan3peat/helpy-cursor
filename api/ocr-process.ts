// api/ocr-process.ts
// Server-side proxy for DashScope Qwen-VL API to avoid CORS issues

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Use international endpoint for international edition accounts
const DASHSCOPE_API_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_MODEL = 'qwen3-vl-flash-2025-10-15';

interface QwenVLRequest {
  base64Image: string;
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[OCR API] Received OCR request');
    
    const apiKey = process.env.ALIBABA_CLOUD_API_KEY?.trim();
    
    if (!apiKey) {
      console.error('[OCR API] API key not configured');
      return res.status(500).json({ 
        error: 'Alibaba Cloud API key not configured on server' 
      });
    }

    // Validate API key format (should start with 'sk-')
    if (!apiKey.startsWith('sk-')) {
      console.error('[OCR API] Invalid API key format');
      return res.status(500).json({ 
        error: 'Invalid API key format. Alibaba Cloud API keys should start with "sk-"' 
      });
    }

    console.log('[OCR API] API key validated, length:', apiKey.length);

    const { base64Image }: QwenVLRequest = req.body;

    if (!base64Image) {
      console.error('[OCR API] Missing base64Image in request');
      return res.status(400).json({ error: 'base64Image is required' });
    }

    console.log('[OCR API] Image received, base64 length:', base64Image.length);

    // Qwen-VL expects base64 image in data URI format
    const imageDataUri = `data:image/jpeg;base64,${base64Image}`;

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
                text: 'Extract all text from this receipt image. Return only the raw text content exactly as it appears, preserving line breaks and formatting.',
              },
            ],
          },
        ],
      },
      parameters: {
        temperature: 0.1, // Low temperature for more deterministic OCR results
      },
    };

    console.log('[OCR API] Calling DashScope API:', DASHSCOPE_API_URL);
    console.log('[OCR API] Model:', QWEN_MODEL);

    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[OCR API] DashScope API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OCR API] DashScope API error:', response.status);
      console.error('[OCR API] Error response:', errorText);
      
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
    console.log('[OCR API] DashScope API call successful');
    console.log('[OCR API] Response structure:', {
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
      console.error('[OCR API] DashScope API error:', data.code, data.message);
      return res.status(500).json({ 
        error: `Qwen-VL API error: ${data.message || data.code}` 
      });
    }

    // Extract text from response
    let fullText = data.output?.choices?.[0]?.message?.content || '';

    // Handle case where content might be an object or array
    if (typeof fullText !== 'string') {
      console.log('[OCR API] Content is not a string, converting. Type:', typeof fullText);
      if (Array.isArray(fullText)) {
        // If it's an array, join the elements
        fullText = fullText.map(item => 
          typeof item === 'string' ? item : JSON.stringify(item)
        ).join('\n');
      } else if (typeof fullText === 'object') {
        // If it's an object, try to extract text or stringify
        fullText = fullText.text || fullText.content || JSON.stringify(fullText);
      } else {
        // Fallback: convert to string
        fullText = String(fullText);
      }
    }

    // Ensure it's a string
    fullText = String(fullText || '');

    if (!fullText || fullText.trim().length === 0) {
      console.error('[OCR API] No text content extracted from response');
      return res.status(500).json({ 
        error: 'No text detected in image. The Qwen-VL model did not return any text content.' 
      });
    }

    console.log('[OCR API] Successfully extracted text, length:', fullText.length);
    console.log('[OCR API] Text preview (first 200 chars):', fullText.substring(0, 200));

    // Return the extracted text
    return res.status(200).json({ text: fullText });

  } catch (error) {
    console.error('[OCR API] Unexpected error during OCR processing:', error);
    console.error('[OCR API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

