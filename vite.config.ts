import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          const groups: [string, RegExp][] = [
            ['react', /node_modules\/(react|react-dom|scheduler|use-sync-external-store|react-router|react-router-dom|@remix-run)\//],
            ['tanstack', /node_modules\/@tanstack\//],
            ['supabase', /node_modules\/@supabase\//],
            ['radix', /node_modules\/(@radix-ui|cmdk|@floating-ui|aria-hidden|react-remove-scroll[^/]*|react-style-singleton|use-callback-ref|use-sidecar|detect-node-es|get-nonce|tslib)\//],
            ['forms', /node_modules\/(react-hook-form|zod|@hookform)\//],
            ['hebcal', /node_modules\/@hebcal\//],
            ['motion', /node_modules\/(framer-motion|motion-dom|motion-utils)\//],
          ]
          return groups.find(([, re]) => re.test(id))?.[0] ?? 'vendor'
        },
      },
    },
  },
})
