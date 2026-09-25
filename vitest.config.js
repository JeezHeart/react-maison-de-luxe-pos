import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit tests run in Node against the real stores (no browser, no Supabase —
// the client is null when env vars are absent). A localStorage shim keeps
// the local-first stores happy.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
  },
});