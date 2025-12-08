// currencyConfig.ts
// Currency configuration for Helpy - currently HKD only, designed for future expansion

/**
 * Default currency for the app (Hong Kong launch)
 */
export const DEFAULT_CURRENCY = 'HKD';

/**
 * Supported currencies configuration
 * Key: ISO 4217 currency code
 * Value: Currency display settings
 * 
 * To add a new currency in the future:
 * 1. Add entry here with symbol, locale, and name
 * 2. Update OCR patterns in visionService.ts if needed
 */
export const SUPPORTED_CURRENCIES: Record<string, {
  symbol: string;
  locale: string;
  name: string;
}> = {
  HKD: { 
    symbol: 'HK$', 
    locale: 'zh-HK', 
    name: 'Hong Kong Dollar' 
  },
  // Future currencies (commented out for reference):
  // USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
  // SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
  // PHP: { symbol: '₱', locale: 'en-PH', name: 'Philippine Peso' },
  // AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
  // EUR: { symbol: '€', locale: 'de-DE', name: 'Euro' },
  // GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound' },
  // JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
  // CNY: { symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan' },
  // THB: { symbol: '฿', locale: 'th-TH', name: 'Thai Baht' },
  // MYR: { symbol: 'RM', locale: 'ms-MY', name: 'Malaysian Ringgit' },
  // IDR: { symbol: 'Rp', locale: 'id-ID', name: 'Indonesian Rupiah' },
};

/**
 * Format amount with currency symbol
 * Uses the currency's configured symbol (e.g., HK$123.45)
 * 
 * @param amount - The numeric amount to format
 * @param currency - ISO 4217 currency code (defaults to DEFAULT_CURRENCY)
 * @returns Formatted string like "HK$123.45"
 */
export function formatCurrency(
  amount: number, 
  currency: string = DEFAULT_CURRENCY
): string {
  const config = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
  
  // Format the number with 2 decimal places and thousands separators
  const formattedNumber = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  // Return with symbol prefix (e.g., HK$123.45)
  return `${config.symbol}${formattedNumber}`;
}

/**
 * Get currency symbol for display
 * 
 * @param currency - ISO 4217 currency code
 * @returns Currency symbol (e.g., "HK$")
 */
export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const config = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
  return config.symbol;
}

/**
 * Check if a currency is supported
 * 
 * @param currency - ISO 4217 currency code
 * @returns true if currency is supported
 */
export function isSupportedCurrency(currency: string): boolean {
  return currency in SUPPORTED_CURRENCIES;
}

