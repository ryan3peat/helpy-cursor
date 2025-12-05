// services/visionService.ts
// Handles OCR processing via server-side API proxy (which uses Alibaba Cloud Qwen-VL)

export interface ParsedReceipt {
  rawText: string;
  total: number;
  merchant: string;
  date: string;
  category: string;
  confidence: number;
  lineItems: Array<{ name: string; price: number }>;
}

// API endpoint for OCR processing (server-side proxy to avoid CORS)
const OCR_API_URL = '/api/ocr-process';

interface OCRApiResponse {
  text?: string;
  error?: string;
}

/**
 * Send image to server-side OCR API proxy (which calls Alibaba Cloud Qwen-VL API)
 * Why: Uses server-side proxy to avoid CORS issues and keep API key secure
 */
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const response = await fetch(OCR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ base64Image }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `OCR API error: ${response.status}`;
    
    try {
      const errorData: OCRApiResponse = JSON.parse(errorText);
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = `${errorMessage} - ${errorText}`;
    }
    
    throw new Error(errorMessage);
  }
  
  const data: OCRApiResponse = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  if (!data.text) {
    throw new Error('No text detected in image. The OCR service did not return any text content.');
  }
  
  return data.text;
}
  
  /**
   * Parse raw OCR text into structured receipt data
   * Why: OCR API returns raw text, we need structured data for the expense
   */
  export function parseReceiptText(rawText: string): ParsedReceipt {
    // Ensure rawText is a string
    if (typeof rawText !== 'string') {
      console.warn('[VisionService] parseReceiptText received non-string input:', typeof rawText, rawText);
      rawText = String(rawText || '');
    }
    
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Initialize with defaults
    let total = 0;
    let merchant = 'Unknown';
    let date = new Date().toISOString().split('T')[0];
    let category = 'Miscellaneous';
    let confidence = 0.5;
    const lineItems: Array<{ name: string; price: number }> = [];
  
    // --- Extract Merchant (first meaningful phrase) ---
    // First, check if rawText contains JSON and extract the actual text
    let actualText = rawText;
    try {
      // Check if rawText is a JSON string like {"text":"..."}
      if (rawText.trim().startsWith('{') && rawText.includes('"text"')) {
        const parsed = JSON.parse(rawText);
        if (parsed.text && typeof parsed.text === 'string') {
          actualText = parsed.text;
        }
      }
    } catch {
      // Not JSON, use as-is
    }
    
    // Split into lines and get the first meaningful phrase
    const textLines = actualText.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Skip code-like patterns, URLs, dates, and numbers-only lines
    const codePatterns = [
      /^[A-Z0-9]{10,}$/, // All caps alphanumeric codes
      /^https?:\/\//, // URLs
      /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/, // Dates at start
      /^[#*]\s*/, // Code markers
      /^[A-Z]{2,}\s*\d+/, // Codes like "ABC 123"
      /^\$\d+/, // Prices
      /^\{.*"text"/, // JSON objects
    ];
    
    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      // Skip if it looks like code, is too short, or is mostly numbers/symbols
      const isCodeLike = codePatterns.some(pattern => pattern.test(line));
      const isTooShort = line.length < 3;
      const isMostlyNumbers = /^\d+[\s\d]*$/.test(line);
      const hasTooManySpecialChars = (line.match(/[^a-zA-Z0-9\s\u4e00-\u9fff]/g) || []).length > line.length * 0.5;
      
      if (!isCodeLike && !isTooShort && !isMostlyNumbers && !hasTooManySpecialChars) {
        // Extract first phrase (before first newline, comma, or special separator)
        const firstPhrase = line.split(/[\n,，。\-\s]{2,}/)[0].trim();
        merchant = firstPhrase.substring(0, 50); // Cap length
        break;
      }
    }
    
    // Fallback to first line if no good merchant found
    if (merchant === 'Unknown' && textLines.length > 0) {
      const firstLine = textLines[0];
      // Extract first phrase from first line
      const firstPhrase = firstLine.split(/[\n,，。\-\s]{2,}/)[0].trim();
      merchant = firstPhrase.substring(0, 50);
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
    // Try multiple date formats and ensure we always return YYYY-MM-DD
    const datePatterns = [
      // YYYY-MM-DD (ISO format - preferred)
      { pattern: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, handler: (m: RegExpMatchArray) => {
          const year = parseInt(m[1], 10);
          const month = parseInt(m[2], 10);
          const day = parseInt(m[3], 10);
          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
          return null;
        }
      },
      // DD-MM-YYYY or MM/DD/YYYY (ambiguous - try both)
      { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, handler: (m: RegExpMatchArray) => {
          const part1 = parseInt(m[1], 10);
          const part2 = parseInt(m[2], 10);
          const year = parseInt(m[3], 10);
          // Heuristic: if part1 > 12, it's likely DD-MM-YYYY (day-month-year)
          // Otherwise, assume MM/DD/YYYY (month-day-year)
          if (part1 > 12 && part1 <= 31 && part2 >= 1 && part2 <= 12) {
            // DD-MM-YYYY format
            return `${year}-${String(part2).padStart(2, '0')}-${String(part1).padStart(2, '0')}`;
          } else if (part1 >= 1 && part1 <= 12 && part2 >= 1 && part2 <= 31) {
            // MM/DD/YYYY format
            return `${year}-${String(part1).padStart(2, '0')}-${String(part2).padStart(2, '0')}`;
          }
          return null;
        }
      },
      // Month name format: "Jan 15, 2024" or "January 15, 2024"
      { pattern: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i, handler: (m: RegExpMatchArray) => {
          try {
            const parsed = new Date(m[1]);
            if (!isNaN(parsed.getTime())) {
              return parsed.toISOString().split('T')[0];
            }
          } catch {
            // Continue to next pattern
          }
          return null;
        }
      },
    ];
  
    for (const { pattern, handler } of datePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        const formattedDate = handler(match);
        if (formattedDate && /^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
          // Validate the date is reasonable
          const parsed = new Date(formattedDate);
          if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
            date = formattedDate;
            break;
          }
        }
      }
    }
    
    // Final validation: ensure date is in YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // If date extraction failed, use today's date as fallback
      date = new Date().toISOString().split('T')[0];
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