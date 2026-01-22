/**
 * Logger utility that only outputs in development mode.
 * Keeps console clean in production while preserving debug info for devs.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('Message');
 *   logger.auth('Login attempt');
 *   logger.api('Request received');
 */

const isDev = typeof window !== 'undefined' 
  ? import.meta.env?.DEV ?? false 
  : process.env.NODE_ENV !== 'production';

// For Vercel serverless functions
const isServerDev = typeof window === 'undefined' && process.env.NODE_ENV !== 'production';

export const logger = {
  // General logging
  log: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => console.error(...args), // Always show errors
  debug: (...args: unknown[]) => isDev && console.log('🔍', ...args),
  info: (...args: unknown[]) => isDev && console.info(...args),
  
  // Feature-specific loggers with prefixes
  auth: (...args: unknown[]) => isDev && console.log('🔐 [Auth]', ...args),
  api: (...args: unknown[]) => isDev && console.log('🌐 [API]', ...args),
  sync: (...args: unknown[]) => isDev && console.log('🔄 [Sync]', ...args),
  push: (...args: unknown[]) => isDev && console.log('🔔 [Push]', ...args),
  supabase: (...args: unknown[]) => isDev && console.log('💾 [Supabase]', ...args),
  realtime: (...args: unknown[]) => isDev && console.log('📡 [Realtime]', ...args),
  sw: (...args: unknown[]) => isDev && console.log('⚙️ [SW]', ...args),
  app: (...args: unknown[]) => isDev && console.log('📱 [App]', ...args),
  
  // Server-side logger (for API routes) - always logs in server context for debugging
  server: (...args: unknown[]) => {
    if (typeof window === 'undefined') {
      console.log('[Server]', ...args);
    }
  },
  
  // API route logger - logs in dev or on server
  apiRoute: (...args: unknown[]) => {
    if (typeof window === 'undefined' || isDev) {
      console.log(...args);
    }
  },
};

// Default export for convenience
export default logger;
