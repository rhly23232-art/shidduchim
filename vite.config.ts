import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Some libraries (pdf.js, jszip) ship raw control bytes inside string literals.
 * They are valid JS but rejected by strict hosts, so rewrite them as \xNN escapes
 * (identical runtime value — they only ever appear inside literals).
 */
function escapeControlChars(): Plugin {
  // eslint-disable-next-line no-control-regex
  const re = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g
  const fix = (code: string) =>
    code.replace(re, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
  return {
    name: 'escape-control-chars',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') file.code = fix(file.code)
        else if (/\.(m?js)$/.test(file.fileName)) {
          const src =
            typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source)
          file.source = fix(src)
        }
      }
    },
  }
}

/** "1.0.0+abc1234" — shown in the support report so issues map to an exact build. */
function appVersion(): string {
  const pkg = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'),
  ) as {
    version: string
  }
  let sha = process.env.GITHUB_SHA?.slice(0, 7) ?? ''
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
    } catch {
      sha = 'local'
    }
  }
  return `${pkg.version}+${sha}`
}

export default defineConfig({
  plugins: [react(), escapeControlChars()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
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
            [
              'react',
              /node_modules\/(react|react-dom|scheduler|use-sync-external-store|react-router|react-router-dom|@remix-run)\//,
            ],
            ['tanstack', /node_modules\/@tanstack\//],
            ['supabase', /node_modules\/@supabase\//],
            [
              'radix',
              /node_modules\/(@radix-ui|cmdk|@floating-ui|aria-hidden|react-remove-scroll[^/]*|react-style-singleton|use-callback-ref|use-sidecar|detect-node-es|get-nonce|tslib)\//,
            ],
            ['forms', /node_modules\/(react-hook-form|zod|@hookform)\//],
            ['hebcal', /node_modules\/@hebcal\//],
            ['motion', /node_modules\/(framer-motion|motion-dom|motion-utils)\//],
            // Viewer libraries load only when a resume is opened.
            ['pdf', /node_modules\/pdfjs-dist\//],
            [
              'docx',
              /node_modules\/(mammoth|jszip|pako|lop|dingbat-to-unicode|bluebird|underscore|xmlbuilder|@xmldom|base64-js|option|path-is-absolute|lie|immediate|setimmediate|readable-stream|inherits|core-util-is|isarray|process-nextick-args|safe-buffer|string_decoder|util-deprecate|argparse|sprintf-js)\//,
            ],
          ]
          return groups.find(([, re]) => re.test(id))?.[0] ?? 'vendor'
        },
      },
    },
  },
})
