
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Map "@" to the project root, so "@/components/..." works when components are outside src
      '@': path.resolve(__dirname, '.'),
      // Optional: map "@src" to the src folder
      '@src': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      // ✅ Proxy API calls to Vercel local server
      '/api': {
        // Use Vercel dev (serverless) port instead of the Vite port to avoid self-proxy loops
        // that return 500s (e.g., Stripe webhooks hitting /api/stripe-webhook).
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
