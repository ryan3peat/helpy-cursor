import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.helpyfam.app',
  appName: 'Helpyfam',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://app.helpyfam.com',
    cleartext: true,
    allowNavigation: [
      'https://informed-guppy-42.clerk.accounts.dev',
      'https://clerk.helpyfam.com',
      'https://clerk.helpyfam.com/*',  // ADD THIS
      'https://*.clerk.accounts.dev',
      'https://app.helpyfam.com',
      'https://accounts.helpyfam.com',
      'https://accounts.google.com',   // ADD THIS - Google OAuth
      'https://accounts.google.com/*'  // ADD THIS
    ]
  },
  plugins: {
    CapacitorHttp: {
      /**
       * IMPORTANT (Clerk OAuth on Android):
       * Enabling this patches `fetch`/XHR to use native HTTP, which does NOT share the same
       * cookie jar as the WebView / browser context. Clerk's OAuth flow relies on cookies
       * to persist "state" between the initial auth request and the `/v1/oauth_callback`
       * redirect from Google.
       *
       * If this is enabled, Google OAuth commonly fails with Clerk:
       *   { code: "authorization_invalid" }
       *
       * Keep this disabled, and call `CapacitorHttp.request()` explicitly only for the
       * specific API calls that truly need native HTTP.
       */
      enabled: false
    }
  }
};

export default config;
