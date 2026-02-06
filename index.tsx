import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { logger } from './utils/logger';
import { initMetaPixel } from './services/metaPixel';

// Initialize Meta Pixel BEFORE React loads to ensure all page views are tracked
// This must be called synchronously before React mounts
initMetaPixel();

// Capture PWA install prompt IMMEDIATELY before React loads
// This ensures we never miss Chrome's beforeinstallprompt event
(window as any).deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredInstallPrompt = e;
});

// Disable iOS shake-to-undo - prevents confusing undo dialog in PWA
// This intercepts the undo/redo input events triggered by shake gesture
document.addEventListener('beforeinput', (e: InputEvent) => {
  if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
    e.preventDefault();
  }
});

// Log URL immediately on script load (before React)
logger.log('[Index] App starting. URL:', window.location.href);
logger.log('[Index] Hash:', window.location.hash);
logger.log('[Index] Pathname:', window.location.pathname);

// Always-visible startup marker for Android Logcat (production included).
// If you don't see this in Logcat, you're not running this deployed bundle.
try {
  const bootPayload = {
    href: window.location.href,
    hash: window.location.hash,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'no-navigator',
    mode: import.meta.env?.MODE,
  };
  // Log as a string because Logcat often prints objects as "[object Object]"
  console.error('[HELpyBoot] index.tsx loaded ' + JSON.stringify(bootPayload));
} catch {
  // ignore
}

// Global error hooks (critical for diagnosing "blank screen" in Android WebView)
window.addEventListener('error', (e) => {
  try {
    const err = (e as ErrorEvent).error as any;
    console.error(
      '[HELpyGlobalError] ' +
        JSON.stringify({
          message: (e as ErrorEvent).message,
          filename: (e as ErrorEvent).filename,
          lineno: (e as ErrorEvent).lineno,
          colno: (e as ErrorEvent).colno,
          stack: err?.stack,
        })
    );
  } catch {
    // ignore
  }
});

window.addEventListener('unhandledrejection', (e) => {
  try {
    const reason: any = (e as PromiseRejectionEvent).reason;
    console.error(
      '[HELpyUnhandledRejection] ' +
        JSON.stringify({
          message: reason?.message || String(reason),
          stack: reason?.stack,
        })
    );
  } catch {
    // ignore
  }
});

/**
 * Debug: Log navigations + clicks in the native app.
 *
 * Important: `logger.log()` is dev-only, so on production builds (like `app.helpyfam.com`)
 * it won't show in Android Logcat. We intentionally use `console.log()` here so you can
 * see the OAuth redirect flow in Logcat.
 */
const isHelpyNativeUA =
  typeof navigator !== 'undefined' && /HelpyApp\/\d+/i.test(navigator.userAgent || '');

if (isHelpyNativeUA) {
  const logNav = (reason: string, extra?: Record<string, unknown>) => {
    try {
      const payload = {
        reason,
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        ...extra,
      };
      // Use error level so it always appears in Logcat.
      console.error('[HELpyNav] ' + JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  try {
    console.error(
      '[HELpyNav] enabled ' +
        JSON.stringify({ userAgent: navigator.userAgent, href: window.location.href })
    );
  } catch {
    // ignore
  }

  logNav('startup');
  window.addEventListener('hashchange', () => logNav('hashchange'));
  window.addEventListener('popstate', () => logNav('popstate'));
  window.addEventListener('pagehide', () => logNav('pagehide'));
  document.addEventListener('visibilitychange', () => logNav('visibilitychange', { visibilityState: document.visibilityState }));

  // Capture clicks on OAuth buttons (Clerk uses data-provider="oauth_google")
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest?.('button') as HTMLButtonElement | null;
      if (!btn) return;

      const provider = btn.getAttribute('data-provider') || btn.getAttribute('data-provider-name');
      const text = (btn.textContent || '').trim().slice(0, 80);

      if (provider || /google/i.test(text) || /continue with google/i.test(text)) {
        logNav('click', { provider, text });
      }
    },
    true
  );
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

// Debug logging for Clerk initialization
logger.log('🔵 [Clerk] Initializing with key:', clerkPubKey ? `${clerkPubKey.substring(0, 15)}...` : 'MISSING');
logger.log('🔵 [Clerk] Environment:', import.meta.env.MODE);
logger.log('🔵 [Clerk] Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'server');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element');
}

// Get production URL for Clerk configuration
const getProductionUrl = () => {
  return import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://app.helpyfam.com';
};

const root = ReactDOM.createRoot(rootElement);

// Only use custom domain in production
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'app.helpyfam.com' || 
   window.location.hostname.includes('helpyfam.com'));

const isNative = Capacitor.isNativePlatform();

root.render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={clerkPubKey}
      fallbackRedirectUrl={typeof window !== 'undefined' ? window.location.origin : undefined}
      // Required for native platforms (Capacitor) per Clerk docs.
      // Prevents Clerk from assuming a full browser cookie setup.
      standardBrowser={!isNative}
      // Allow custom scheme redirects for native OAuth return.
      allowedRedirectProtocols={['http', 'https', 'com.helpyfam.app']}
    >
      <SupabaseProvider>
        <App />
      </SupabaseProvider>
    </ClerkProvider>
  </React.StrictMode>
);
