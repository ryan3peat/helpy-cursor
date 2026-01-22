// api/gemini-proxy.ts
// Server-side proxy for Google Gemini API to avoid CSP issues and keep API key secure

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from './_logger';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface GeminiProxyRequest {
  contents: string | any;
  config?: {
    responseMimeType?: string;
    responseSchema?: any;
  };
}

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.endsWith('.vercel.app'))) {
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
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey) {
      logger.error('[Gemini Proxy] API key not configured');
      return res.status(500).json({ 
        error: 'Gemini API key not configured on server' 
      });
    }

    const { contents, config }: GeminiProxyRequest = req.body;

    if (!contents) {
      return res.status(400).json({ error: 'contents is required' });
    }

    // Format contents for Gemini API
    // Gemini expects: contents: [{ parts: [...] }]
    let formattedContents: any;
    if (typeof contents === 'string') {
      // String content: wrap in parts array
      formattedContents = [{
        parts: [{ text: contents }]
      }];
    } else if (contents.parts && Array.isArray(contents.parts)) {
      // Object with parts array: wrap in contents array
      formattedContents = [contents];
    } else if (Array.isArray(contents)) {
      // Already an array of content objects
      formattedContents = contents;
    } else {
      // Fallback: try to use as-is
      formattedContents = [contents];
    }

    const requestBody: any = {
      contents: formattedContents,
    };

    if (config) {
      requestBody.generationConfig = {};
      if (config.responseMimeType) {
        requestBody.generationConfig.responseMimeType = config.responseMimeType;
      }
      if (config.responseSchema) {
        requestBody.generationConfig.responseSchema = config.responseSchema;
      }
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Gemini Proxy] API error:', response.status, errorText);
      
      let errorMessage = `Gemini API error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      
      return res.status(response.status).json({ error: errorMessage });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    logger.error('[Gemini Proxy] Unexpected error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}
