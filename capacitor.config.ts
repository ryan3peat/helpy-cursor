import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.helpyfam.app',
  appName: 'Helpyfam',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
    url: 'https://app.helpyfam.com',
    cleartext: true,  // Add this
    allowNavigation: [            // Add this
      'https://informed-guppy-42.clerk.accounts.dev',
      'https://app.helpyfam.com'
    ]
  },
  plugins: {
    CapacitorHttp: {
      // Enable native HTTP for all requests - bypasses CORS
      enabled: true
    }
  }
};

export default config;
