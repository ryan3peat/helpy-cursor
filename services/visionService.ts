// services/visionService.ts
// Handles Alibaba Cloud Qwen-VL API calls for receipt OCR

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

export interface ParsedReceipt {
  rawText: string;
  total: number;
  merchant: string;
  date: string;
  category: string;
  confidence: number;
  lineItems: Array<{ name: string; price: number }>;
}

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_MODEL = 'qwen-vl-plus'; // Using qwen-vl-plus as specified

/**
 * Send image to Alibaba Cloud Qwen-VL API for OCR
 * Why: Extracts text from receipt images with high accuracy using Qwen-VL model
 */
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const apiKey = import.meta.env.VITE_ALIBABA_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error('Alibaba Cloud API key not configured. Please set VITE_ALIBABA_CLOUD_API_KEY in your environment variables.');
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
    
    throw new Error(errorMessage);
  }
  
  const data: QwenVLResponse = await response.json();
  
  // Check for API-level errors
  if (data.code && data.code !== 'Success') {
    throw new Error(`Qwen-VL API error: ${data.message || data.code}`);
  }
  
  // Extract text from response
  const fullText = data.output?.choices?.[0]?.message?.content || '';
  
  if (!fullText) {
    throw new Error('No text detected in image. The Qwen-VL model did not return any text content.');
  }
  
  return fullText;
}
  
  /**
   * Parse raw OCR text into structured receipt data
   * Why: OCR API returns raw text, we need structured data for the expense
   */
  export function parseReceiptText(rawText: string): ParsedReceipt {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Initialize with defaults
    let total = 0;
    let merchant = 'Unknown';
    let date = new Date().toISOString().split('T')[0];
    let category = 'Miscellaneous';
    let confidence = 0.5;
    const lineItems: Array<{ name: string; price: number }> = [];
  
    // --- Extract Merchant (usually first non-empty line) ---
    if (lines.length > 0) {
      // First meaningful line is often the store name
      merchant = lines[0].substring(0, 50); // Cap length
    }
  
    // --- Extract Total ---
    // Common patterns: "Total: $XX.XX", "TOTAL $XX.XX", "Grand Total XX.XX"
    const totalPatterns = [
      /(?:grand\s*)?total[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /(?:amount\s*due|balance\s*due)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.\d{2})\s*$/m, // Last price on a line
    ];
  
    for (const pattern of totalPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        total = parseFloat(match[1].replace(',', ''));
        confidence = 0.8;
        break;
      }
    }
  
    // If no total found, try to find the largest number (likely the total)
    if (total === 0) {
      const priceMatches = rawText.match(/\$?\s*(\d+\.\d{2})/g) || [];
      const prices = priceMatches.map(p => parseFloat(p.replace(/[$\s]/g, '')));
      if (prices.length > 0) {
        total = Math.max(...prices);
        confidence = 0.5; // Lower confidence for guessed total
      }
    }
  
    // --- Extract Date ---
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,  // MM/DD/YYYY or DD-MM-YYYY
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,     // YYYY-MM-DD
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i, // Month DD, YYYY
    ];
  
    for (const pattern of datePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        try {
          const parsed = new Date(match[1]);
          if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString().split('T')[0];
            break;
          }
        } catch {
          // Continue to next pattern
        }
      }
    }
  
    // --- Detect Category ---
    const categoryKeywords: Record<string, string[]> = {
      'Food & Daily Needs': ['grocery', 'supermarket', 'market', 'food', 'restaurant', 'cafe', 'deli', 'bakery'],
      'Transport & Travel': ['gas', 'fuel', 'petrol', 'uber', 'grab', 'taxi', 'parking', 'transit'],
      'Housing & Utilities': ['electric', 'water', 'internet', 'phone', 'rent', 'maintenance'],
      'Health & Personal Care': ['pharmacy', 'clinic', 'hospital', 'doctor', 'dental', 'medical'],
      'Fun & Lifestyle': ['cinema', 'movie', 'entertainment', 'gym', 'spa', 'hobby'],
    };
  
    const lowerText = rawText.toLowerCase();
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        category = cat;
        break;
      }
    }
  
    // --- Extract Line Items (best effort) ---
    // Pattern: "Item name    $XX.XX" or "Item name XX.XX"
    const itemPattern = /^(.+?)\s+\$?\s*(\d+\.\d{2})\s*$/gm;
    let itemMatch;
    while ((itemMatch = itemPattern.exec(rawText)) !== null) {
      const itemName = itemMatch[1].trim();
      const itemPrice = parseFloat(itemMatch[2]);
      
      // Filter out likely non-items
      if (itemName.length > 2 && itemName.length < 50 && itemPrice < total) {
        lineItems.push({ name: itemName, price: itemPrice });
      }
    }
  
    return {
      rawText,
      total,
      merchant,
      date,
      category,
      confidence,
      lineItems,
    };
  }
  
  /**
   * Main function: Process receipt image end-to-end
   */
  export async function processReceipt(base64Image: string): Promise<ParsedReceipt> {
    const rawText = await extractTextFromImage(base64Image);
    return parseReceiptText(rawText);
  }