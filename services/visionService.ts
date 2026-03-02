// services/visionService.ts
// Handles OCR processing via server-side API proxy (which uses Alibaba Cloud Qwen-VL-OCR)
import { logger } from '../utils/logger';
import { getHKDateString } from '../utils/dateUtils';

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
 * Why: Uses server-side proxy to avoid CORS issues and keep API key secure.
 * Model: Qwen-VL-OCR (purpose-built for receipt/document OCR)
 * @param base64Image - Base64 encoded image (do NOT compress for OCR — send full resolution up to 1280px)
 * @param customPrompt - Optional custom prompt for retry/handwriting-specific passes
 */
export async function extractTextFromImage(base64Image: string, customPrompt?: string): Promise<string> {
  const body: Record<string, string> = { base64Image };
  if (customPrompt) {
    body.prompt = customPrompt;
  }

  const response = await fetch(OCR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

// ─── Merchant matching helpers (CJK-aware) ─────────────────────────────

/**
 * Normalize a string for fuzzy comparison.
 * Preserves CJK characters alongside ASCII alphanumerics so that
 * Chinese merchant names like "華潤萬家" are not stripped to empty.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    // Keep ASCII alphanumerics AND CJK Unified Ideographs + extensions
    .replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g, ' ')
    .trim();
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
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  // For pure CJK, exact match is the most reliable signal
  if (na === nb) return 1;
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

// ─── Structured JSON response from Qwen ─────────────────────────────────

/** Shape returned by the structured JSON prompt */
interface QwenReceiptJSON {
  merchant?: string;
  date?: string;
  currency?: string;
  total?: number;
  category?: string;
  line_items?: Array<{ name: string; price: number }>;
  language?: string;
}

/** Valid categories the app supports */
const VALID_CATEGORIES = [
  'Food & Daily Needs',
  'Transport & Travel',
  'Housing & Utilities',
  'Health & Personal Care',
  'Fun & Lifestyle',
  'Misc',
  'Other',
];

/**
 * Try to parse the Qwen response as structured JSON (new prompt format).
 * Handles strict JSON, markdown-fenced JSON, and loose key: value formats.
 * Returns null if nothing recognisable can be extracted.
 */
function tryParseStructuredJSON(text: string): QwenReceiptJSON | null {
  let cleaned = text.trim();

  // Strip markdown code fences if the model wrapped them anyway
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // ── Attempt 1: strict JSON parse ──
  if (cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.merchant || parsed.total !== undefined || parsed.date) {
        return parsed as QwenReceiptJSON;
      }
    } catch {
      // May be malformed — try loose extraction below
    }
  }

  // ── Attempt 2: loose key-value format ──
  // Qwen sometimes returns "merchant: 大家樂\ntotal: 50.00" instead of JSON.
  // Detect this by looking for multiple "key: value" lines.
  const kvPattern = /^"?(\w+)"?\s*[:：]\s*"?(.+?)"?\s*$/;
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const kvPairs: Record<string, string> = {};
  let kvHits = 0;
  for (const line of lines) {
    // Strip trailing commas (from almost-JSON)
    const stripped = line.replace(/,\s*$/, '');
    const m = stripped.match(kvPattern);
    if (m) {
      kvPairs[m[1].toLowerCase()] = m[2];
      kvHits++;
    }
  }

  // Need at least 2 recognised fields to treat it as structured output
  if (kvHits >= 2 && (kvPairs.merchant || kvPairs.total || kvPairs.date)) {
    logger.log('[VisionService] Parsed loose key-value format from Qwen response');
    const result: QwenReceiptJSON = {};
    if (kvPairs.merchant) result.merchant = kvPairs.merchant;
    if (kvPairs.date) result.date = kvPairs.date;
    if (kvPairs.currency) result.currency = kvPairs.currency;
    if (kvPairs.total) {
      const num = parseFloat(kvPairs.total.replace(/[^0-9.]/g, ''));
      if (isFinite(num)) result.total = num;
    }
    if (kvPairs.category) result.category = kvPairs.category;
    if (kvPairs.language) result.language = kvPairs.language;
    // line_items are unlikely in loose KV, skip
    return result;
  }

  return null;
}

/**
 * Validate and normalise a YYYY-MM-DD date string.
 * Returns the validated date or today's date as fallback.
 */
function validateDate(dateStr: string | undefined): string {
  const today = getHKDateString();
  if (!dateStr) return today;

  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
      return dateStr;
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    if (p1 > 12 && p1 <= 31 && p2 >= 1 && p2 <= 12) {
      return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
    if (p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
      return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
  }

  return today;
}

/**
 * Map the category string from the model to one the app uses.
 * "Other" maps to "Misc" for backward compat.
 */
function normalizeCategory(cat: string | undefined): string {
  if (!cat) return 'Misc';
  const trimmed = cat.trim();
  if (VALID_CATEGORIES.includes(trimmed)) {
    return trimmed === 'Other' ? 'Misc' : trimmed;
  }
  // Fuzzy match — find the closest valid category
  const lower = trimmed.toLowerCase();
  for (const valid of VALID_CATEGORIES) {
    if (valid.toLowerCase().includes(lower) || lower.includes(valid.toLowerCase())) {
      return valid === 'Other' ? 'Misc' : valid;
    }
  }
  return 'Misc';
}

// ─── Parse receipt text (supports both JSON and raw-text fallback) ───────

/**
 * Parse OCR response into structured receipt data.
 * Primary path: parse as structured JSON (from the new Qwen prompt).
 * Fallback path: regex extraction for raw text (backward compatibility).
 */
export function parseReceiptText(rawText: string, options?: ProcessReceiptOptions): ParsedReceipt {
  if (typeof rawText !== 'string') {
    logger.warn('[VisionService] parseReceiptText received non-string input:', typeof rawText, rawText);
    rawText = String(rawText || '');
  }

  const knownMerchants = options?.knownMerchants?.filter(Boolean) || [];

  // ── Try structured JSON path first ──────────────────────────────────
  const structured = tryParseStructuredJSON(rawText);
  if (structured) {
    logger.log('[VisionService] Parsed structured JSON response from Qwen');

    let merchant = (structured.merchant || 'Unknown')
      // Safety: strip any leaked JSON key prefix like "merchant: " or "merchant " from the value
      .replace(/^"?merchant"?\s*[:：]\s*/i, '')
      .trim()
      .substring(0, 80);
    const total = typeof structured.total === 'number' && isFinite(structured.total) ? structured.total : 0;
    const date = validateDate(structured.date);
    const category = normalizeCategory(structured.category);
    const lineItems: Array<{ name: string; price: number }> = [];

    if (Array.isArray(structured.line_items)) {
      for (const item of structured.line_items) {
        if (item && typeof item.name === 'string' && typeof item.price === 'number') {
          lineItems.push({ name: item.name.substring(0, 80), price: item.price });
        }
      }
    }

    // Snap merchant to known value if a strong match exists
    if (knownMerchants.length > 0 && merchant !== 'Unknown') {
      const match = findBestMerchantMatch(merchant, knownMerchants);
      if (match && match.score >= 0.78) {
        merchant = match.value.substring(0, 80);
      }
    }

    const confidence = (merchant !== 'Unknown' && total > 0) ? 0.9 : 0.6;

    logger.log('[VisionService] Structured result:', { merchant, total, date, category, lineItems: lineItems.length, confidence });

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

  // ── Fallback: regex-based extraction for raw text responses ─────────
  logger.log('[VisionService] Falling back to regex-based parsing');

  let total = 0;
  let merchant = 'Unknown';
  let date = getHKDateString();
  let category = 'Misc';
  let confidence = 0.5;
  const lineItems: Array<{ name: string; price: number }> = [];

  // --- Clean up text ---
  let actualText = rawText;
  try {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.text && typeof parsed.text === 'string') actualText = parsed.text;
      else if (parsed.content && typeof parsed.content === 'string') actualText = parsed.content;
      else if (parsed.message && typeof parsed.message === 'string') actualText = parsed.message;
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        actualText = parsed.map((item: unknown) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'text' in item) return (item as { text: string }).text;
          if (item && typeof item === 'object' && 'content' in item) return (item as { content: string }).content;
          return JSON.stringify(item);
        }).join('\n');
      }
    }
  } catch {
    // Not JSON, use as-is
  }

  actualText = actualText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*\{[\s\S]*?"text"\s*:\s*"/, '')
    .replace(/"\s*\}\s*$/, '')
    .trim();

  const textLines = actualText.split('\n').map(l => l.trim()).filter(Boolean);

  // --- Extract Merchant ---
  // Known field-name prefixes the model may include (strip these from values)
  const FIELD_PREFIXES = /^"?(?:merchant|store|shop|vendor|name|商店|店[名鋪舖]?)["\s]*[:：]\s*"?/i;

  // CJK-aware: skip code-like lines but accept Chinese text
  const codePatterns = [
    /^[A-Z0-9]{10,}$/,
    /^https?:\/\//,
    /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
    /^[#*]\s*/,
    /^[A-Z]{2,}\s*\d+/,
    /^\$\d+/,
    /^\{.*"text"/,
    // Skip lines that are clearly other JSON fields (not merchant)
    /^"?(?:date|total|currency|category|language|line_items)"?\s*[:：]/i,
  ];

  /** Clean a candidate merchant string: strip field-name prefix and trailing quotes */
  function cleanMerchantCandidate(raw: string): string {
    return raw
      .replace(FIELD_PREFIXES, '')
      .replace(/"\s*,?\s*$/, '') // trailing quote / comma from JSON-ish
      .trim()
      .substring(0, 80);
  }

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];
    const isCodeLike = codePatterns.some(pattern => pattern.test(line));
    const isTooShort = line.length < 2; // Allow short CJK names (2 chars)
    const isMostlyNumbers = /^\d+[\s\d]*$/.test(line);

    // CJK-aware special char check: allow CJK, fullwidth punctuation, and common CJK symbols
    const allowedChars = line.match(/[a-zA-Z0-9\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g) || [];
    const hasTooManySpecialChars = allowedChars.length < line.length * 0.4;

    if (!isCodeLike && !isTooShort && !isMostlyNumbers && !hasTooManySpecialChars) {
      // For lines with a numeric prefix followed by CJK/text, take the text part
      const cjkTextMatch = line.match(/^\d+\s+(.+)/);
      if (cjkTextMatch && /[\u4e00-\u9fff]/.test(cjkTextMatch[1])) {
        merchant = cleanMerchantCandidate(cjkTextMatch[1]);
      } else {
        const firstPhrase = line.split(/[\n,，。]{1,}|\s{3,}/)[0].trim();
        merchant = cleanMerchantCandidate(firstPhrase);
      }
      break;
    }
  }

  if (merchant === 'Unknown' && textLines.length > 0) {
    const firstLine = textLines[0];
    const cjkTextMatch = firstLine.match(/^\d+\s+(.+)/);
    if (cjkTextMatch && /[\u4e00-\u9fff]/.test(cjkTextMatch[1])) {
      merchant = cleanMerchantCandidate(cjkTextMatch[1]);
    } else {
      const firstPhrase = firstLine.split(/[\n,，。]{1,}|\s{3,}/)[0].trim();
      merchant = cleanMerchantCandidate(firstPhrase);
    }
  }

  // Snap merchant to known value
  if (knownMerchants.length > 0) {
    const candidatePhrases = [merchant, ...textLines.slice(0, 3)].filter(Boolean);
    let best: { value: string; score: number } | null = null;
    for (const phrase of candidatePhrases) {
      const match = findBestMerchantMatch(phrase, knownMerchants);
      if (match && (!best || match.score > best.score)) {
        best = match;
      }
    }
    const threshold = merchant !== 'Unknown' ? 0.78 : 0.7;
    if (best && best.score >= threshold) {
      merchant = best.value.substring(0, 80);
    }
  }

  // --- Extract Total ---
  const totalPatterns = [
    /(?:grand\s*)?total[:\s]*(?:HK\$|HKD\s*)\s*([\d,]+\.?\d*)/i,
    /(?:amount\s*due|balance\s*due)[:\s]*(?:HK\$|HKD\s*)\s*([\d,]+\.?\d*)/i,
    /(?:HK\$|HKD\s*)\s*([\d,]+\.\d{2})\s*$/m,
    /(?:grand\s*)?total[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    /(?:amount\s*due|balance\s*due)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.\d{2})\s*$/m,
    // Chinese total patterns
    /合[计計][：:\s]*(?:HK\$|HKD)?\s*([\d,]+\.?\d*)/i,
    /总[计計][：:\s]*(?:HK\$|HKD)?\s*([\d,]+\.?\d*)/i,
    /應付[：:\s]*(?:HK\$|HKD)?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = actualText.match(pattern);
    if (match) {
      total = parseFloat(match[1].replace(',', ''));
      confidence = 0.8;
      break;
    }
  }

  if (total === 0) {
    const priceMatches = actualText.match(/(?:HK\$|HKD\s*|\$)?\s*(\d+\.\d{2})/g) || [];
    const prices = priceMatches.map(p => parseFloat(p.replace(/[HK$\s]/gi, '')));
    if (prices.length > 0) {
      total = Math.max(...prices);
      confidence = 0.5;
    }
  }

  // --- Extract Date ---
  const datePatterns = [
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
    { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, handler: (m: RegExpMatchArray) => {
        const p1 = parseInt(m[1], 10);
        const p2 = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        if (p1 > 12 && p1 <= 31 && p2 >= 1 && p2 <= 12) {
          return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        } else if (p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
          return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
        }
        return null;
      }
    },
    { pattern: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i, handler: (m: RegExpMatchArray) => {
        try {
          const parsed = new Date(m[1]);
          if (!isNaN(parsed.getTime())) return getHKDateString(parsed);
        } catch { /* continue */ }
        return null;
      }
    },
  ];

  for (const { pattern, handler } of datePatterns) {
    const match = actualText.match(pattern);
    if (match) {
      const formatted = handler(match);
      if (formatted && /^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
        const parsed = new Date(formatted);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
          date = formatted;
          break;
        }
      }
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    date = getHKDateString();
  }

  // --- Detect Category ---
  const categoryKeywords: Record<string, string[]> = {
    'Food & Daily Needs': ['grocery', 'supermarket', 'market', 'food', 'restaurant', 'cafe', 'deli', 'bakery',
      '超市', '超級市場', '餐廳', '食', '麵', '飯', '茶餐廳', '酒樓', '快餐', '便利店'],
    'Transport & Travel': ['gas', 'fuel', 'petrol', 'uber', 'grab', 'taxi', 'parking', 'transit',
      '的士', '巴士', '港鐵', '油站', '停車'],
    'Housing & Utilities': ['electric', 'water', 'internet', 'phone', 'rent', 'maintenance',
      '電費', '水費', '租金', '管理費'],
    'Health & Personal Care': ['pharmacy', 'clinic', 'hospital', 'doctor', 'dental', 'medical',
      '藥房', '診所', '醫院', '牙科'],
    'Fun & Lifestyle': ['cinema', 'movie', 'entertainment', 'gym', 'spa', 'hobby',
      '戲院', '電影', '健身'],
  };

  const lowerText = actualText.toLowerCase();
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw) || actualText.includes(kw))) {
      category = cat;
      break;
    }
  }

  // --- Extract Line Items ---
  const itemPattern = /^(.+?)\s+(?:HK\$|HKD\s*|\$)?\s*(\d+\.\d{2})\s*$/gm;
  let itemMatch;
  while ((itemMatch = itemPattern.exec(actualText)) !== null) {
    const itemName = itemMatch[1].trim();
    const itemPrice = parseFloat(itemMatch[2]);
    if (itemName.length > 1 && itemName.length < 80 && itemPrice <= total) {
      lineItems.push({ name: itemName, price: itemPrice });
    }
  }

  logger.log('[VisionService] Regex fallback result:', { merchant, total, date, category, lineItems: lineItems.length });

  return { rawText, total, merchant, date, category, confidence, lineItems };
}

// ─── Gemini-based handwriting detection (Pass 2) ────────────────────────

// Gemini proxy endpoint (same as geminiService.ts)
const GEMINI_PROXY_URL = (() => {
  try {
    return (import.meta.env?.VITE_API_URL || '') + '/api/gemini-proxy';
  } catch {
    return '/api/gemini-proxy';
  }
})();

const GEMINI_HANDWRITING_PROMPT = `Look at this receipt image carefully. There is a HANDWRITTEN number on it — written by hand with a pen (blue or black ink) on the paper.

This handwritten number is the dollar amount (HKD) paid. It is typically:
- 2 to 3 digits (e.g. 35, 68, 120)
- Written much LARGER than any printed text
- In casual/cursive handwriting with ink pen strokes
- Located in an open white area of the receipt, not inside any printed label

Also look for a pre-printed label (often red/coloured) at the top — that has the store name.

Return a JSON object:
{
  "total": <the handwritten number as a decimal, e.g. 68.00>,
  "merchant": "<store name from the printed label, preserve Chinese characters>",
  "date": "<YYYY-MM-DD if visible, otherwise empty string>"
}

Rules:
- Focus on the HANDWRITTEN ink strokes to read the number — this is the most important part
- If no decimal point is written, treat as whole dollars (35 becomes 35.00)
- Give your best guess even if the handwriting is messy
- Preserve Chinese characters exactly as written
- Return ONLY valid JSON, no explanation or markdown`;

interface GeminiHandwritingResult {
  total?: number;
  merchant?: string;
  date?: string;
}

/**
 * Use Gemini 2.5 Flash (general-purpose VLM) to read handwritten amounts.
 * Unlike qwen-vl-ocr (specialised text-region OCR), Gemini can reason about
 * visual properties like ink strokes, handwriting style, and spatial layout.
 * This is used as a fallback when qwen-vl-ocr fails to detect a total (common
 * on wet-market receipts with pen-scribbled amounts).
 */
async function extractAmountViaGemini(base64Image: string): Promise<GeminiHandwritingResult> {
  logger.log('[VisionService] Calling Gemini 2.5 Flash for handwriting detection');

  const response = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: GEMINI_HANDWRITING_PROMPT,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini proxy error ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  // Extract text from Gemini response format (same structure as geminiService.ts)
  let text = '';
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = data.candidates[0].content.parts[0].text;
  } else if (data.text) {
    text = data.text;
  }

  if (!text) {
    throw new Error('Gemini returned empty response for handwriting detection');
  }

  logger.log('[VisionService] Gemini raw response:', text.substring(0, 300));

  // Parse the JSON response
  let cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  const result: GeminiHandwritingResult = {};

  if (typeof parsed.total === 'number' && isFinite(parsed.total) && parsed.total > 0) {
    result.total = parsed.total;
  } else if (typeof parsed.total === 'string') {
    const num = parseFloat(parsed.total.replace(/[^0-9.]/g, ''));
    if (isFinite(num) && num > 0) result.total = num;
  }

  if (parsed.merchant && typeof parsed.merchant === 'string' && parsed.merchant !== 'Unknown') {
    result.merchant = parsed.merchant.substring(0, 80);
  }

  if (parsed.date && typeof parsed.date === 'string') {
    result.date = parsed.date;
  }

  logger.log('[VisionService] Gemini handwriting result:', result);
  return result;
}

/**
 * Main function: Process receipt image end-to-end.
 *
 * Pass 1: qwen-vl-ocr — great for printed receipts (supermarkets, restaurants, etc.)
 * Pass 2: Gemini 2.5 Flash — if Pass 1 couldn't find a total, use Gemini's general
 *         vision understanding to decipher handwritten pen-scribbled amounts (common
 *         on wet-market / street-vendor receipts).
 */
export async function processReceipt(base64Image: string, options?: ProcessReceiptOptions): Promise<ParsedReceipt> {
  // Pass 1 — qwen-vl-ocr (structured JSON prompt)
  const rawText = await extractTextFromImage(base64Image);
  const result = parseReceiptText(rawText, options);

  logger.log('[VisionService] Pass 1 (qwen-vl-ocr) result:', {
    merchant: result.merchant,
    total: result.total,
    confidence: result.confidence,
  });

  // Pass 2 — Gemini handwriting detection when Pass 1 couldn't find a total
  // (or returned nothing at all). qwen-vl-ocr is a specialised text-region OCR model
  // that cannot detect handwritten ink strokes; Gemini is a general-purpose VLM that can.
  const needsGeminiFallback = result.total === 0 || (result.merchant === 'Unknown' && result.confidence < 0.7);
  if (needsGeminiFallback) {
    logger.log('[VisionService] Pass 1 missing total — invoking Gemini 2.5 Flash for handwriting detection');
    try {
      const geminiResult = await extractAmountViaGemini(base64Image);

      // Merge: Gemini's handwriting read for total, keep Pass 1 data for everything else
      if (geminiResult.total && geminiResult.total > 0) {
        logger.log('[VisionService] Gemini found handwritten total:', geminiResult.total);
        result.total = geminiResult.total;
        result.confidence = Math.max(result.confidence, 0.75);
      }

      // If Gemini also found a better merchant (e.g. from the red label), use it
      if (geminiResult.merchant && result.merchant === 'Unknown') {
        result.merchant = geminiResult.merchant;
      }

      // If Gemini found a date and Pass 1 didn't, use it
      const today = getHKDateString();
      if (geminiResult.date && result.date === today) {
        const validated = validateDate(geminiResult.date);
        if (validated !== today) {
          result.date = validated;
        }
      }
    } catch (geminiError) {
      logger.warn('[VisionService] Gemini handwriting fallback failed (non-fatal):', geminiError);
    }
  }

  return result;
}