/**
 * Server-side logger for Vercel API routes
 * Uses process.env (not import.meta.env) for compatibility
 * 
 * In production: Logs are suppressed (except errors)
 * In development: All logs are shown
 * 
 * Usage:
 *   import { logger } from './_logger';
 *   logger.log('[API] Message');
 *   logger.error('[API] Error:', error);
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => console.error(...args), // Always show errors
  info: (...args: unknown[]) => isDev && console.info(...args),
  debug: (...args: unknown[]) => isDev && console.log('🔍', ...args),
};

export default logger;
