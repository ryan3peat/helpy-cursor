
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
});
