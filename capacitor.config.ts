import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.helpyfam.app',
  appName: 'Helpyfam',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://app.helpyfam.com',
    cleartext: true,
    // IMPORTANT: Capacitor's HostMask matches against the HOSTNAME only.
    // Do NOT include a scheme (https://) or path (/*) – they become part
    // of the first host segment and silently break matching.
    allowNavigation: [
      '*.helpyfam.com',
      '*.clerk.accounts.dev',
      '*.google.com'
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
    },
    SocialLogin: {
      google: {
        /**
         * This MUST be the Web client ID from Google Cloud Console
         * (the same one configured in Clerk Dashboard → SSO → Google).
         * It is NOT the Android client ID.
         * Replace the placeholder below with your actual Web client ID.
         */
        webClientId: '687792783542-b3fsfqlrq1vls826ou7vc0m03e73s3q6.apps.googleusercontent.com',
      }
    }
  }
};

export default config;
