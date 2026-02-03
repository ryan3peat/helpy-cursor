import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.helpyfam.app',
  appName: 'Helpyfam',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
