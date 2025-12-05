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

export interface ProcessReceiptOptions {
  /**
   * Known merchant names for the household (user-corrected history).
   * Used to snap OCR guesses to a previously confirmed merchant.
   */
  knownMerchants?: string[];
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
  
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

function findBestMerchantMatch(candidate: string, knownMerchants: string[]): { value: string; score: number } | null {
  let best: { value: string; score: number } | null = null;
  for (const merchant of knownMerchants) {
    const score = similarity(candidate, merchant);
    if (!best || score > best.score) {
      best = { value: merchant, score };
    }
  }
  return best;
}

/**
 * Parse raw OCR text into structured receipt data
 * Why: OCR API returns raw text, we need structured data for the expense
 */
export function parseReceiptText(rawText: string, options?: ProcessReceiptOptions): ParsedReceipt {
    // Ensure rawText is a string
    if (typeof rawText !== 'string') {
      console.warn('[VisionService] parseReceiptText received non-string input:', typeof rawText, rawText);
      rawText = String(rawText || '');
    }
    
    // Initialize with defaults
    let total = 0;
    let merchant = 'Unknown';
    let date = new Date().toISOString().split('T')[0];
    let category = 'Miscellaneous';
    let confidence = 0.5;
    const lineItems: Array<{ name: string; price: number }> = [];
  
    // --- Extract actual text content from various response formats ---
    let actualText = rawText;
    
    // Handle JSON-wrapped responses
    try {
      const trimmed = rawText.trim();
      
      // Check if it's a JSON object with "text" field: {"text":"..."}
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.text && typeof parsed.text === 'string') {
          actualText = parsed.text;
        } else if (parsed.content && typeof parsed.content === 'string') {
          actualText = parsed.content;
        } else if (parsed.message && typeof parsed.message === 'string') {
          actualText = parsed.message;
        }
      }
      
      // Check if it's a JSON array: [{"text":"..."}]
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Extract text from each element and join
          actualText = parsed.map(item => {
            if (typeof item === 'string') return item;
            if (item.text) return item.text;
            if (item.content) return item.content;
            return JSON.stringify(item);
          }).join('\n');
        }
      }
    } catch {
      // Not JSON, use as-is
    }
    
    // Remove any remaining JSON artifacts (like markdown code blocks from AI response)
    actualText = actualText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^\s*\{[\s\S]*?"text"\s*:\s*"/, '') // Remove JSON wrapper start
      .replace(/"\s*\}\s*$/, '') // Remove JSON wrapper end
      .trim();
    
    const lines = actualText.split('\n').map(l => l.trim()).filter(Boolean);
    
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

    // Snap merchant to a known value (user-corrected history) when the match is strong
    const knownMerchants = options?.knownMerchants?.filter(Boolean) || [];
    if (knownMerchants.length > 0) {
      const candidatePhrases = [
        merchant,
        ...textLines.slice(0, 3), // top lines often contain the merchant
      ].filter(Boolean);

      let best: { value: string; score: number } | null = null;
      for (const phrase of candidatePhrases) {
        const match = findBestMerchantMatch(phrase, knownMerchants);
        if (match && (!best || match.score > best.score)) {
          best = match;
        }
      }

      // Require a reasonably high similarity to avoid false positives.
      // If OCR found something (not "Unknown"), use a higher bar; otherwise allow a slightly lower bar.
      const threshold = merchant !== 'Unknown' ? 0.78 : 0.7;
      if (best && best.score >= threshold) {
        merchant = best.value.substring(0, 50);
      }
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
  export async function processReceipt(base64Image: string, options?: ProcessReceiptOptions): Promise<ParsedReceipt> {
    const rawText = await extractTextFromImage(base64Image);
    return parseReceiptText(rawText, options);
  }