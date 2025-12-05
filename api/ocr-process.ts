// api/ocr-process.ts
// Server-side proxy for DashScope Qwen-VL API to avoid CORS issues

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_MODEL = 'qwen-vl-plus';

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
    const apiKey = process.env.ALIBABA_CLOUD_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Alibaba Cloud API key not configured on server' 
      });
    }

    const { base64Image }: QwenVLRequest = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }

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

    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Qwen-VL API error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error?.message || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      
      return res.status(response.status).json({ error: errorMessage });
    }

    const data: QwenVLResponse = await response.json();

    // Check for API-level errors
    if (data.code && data.code !== 'Success') {
      return res.status(500).json({ 
        error: `Qwen-VL API error: ${data.message || data.code}` 
      });
    }

    // Extract text from response
    const fullText = data.output?.choices?.[0]?.message?.content || '';

    if (!fullText) {
      return res.status(500).json({ 
        error: 'No text detected in image. The Qwen-VL model did not return any text content.' 
      });
    }

    // Return the extracted text
    return res.status(200).json({ text: fullText });

  } catch (error) {
    console.error('OCR processing error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

