import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { execSync } from 'child_process'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { version } from './package.json'

const getGitCommitId = (): string => {
  try {
    const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim()

    if (commitMessage.includes('chore(main): release')) {
      return ''
    }

    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch (error) {
    console.warn('无法获取git commit ID:', error)
    return ''
  }
}

const getBuildTime = (): string => {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-') +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

// Selects which fonts get bundled. One of:
//   all (default) | cdn | firasans | misans | pingfang | sarasa | none
// See src/assets/load-fonts.ts for what each value loads.
const font = process.env.FONT || 'all'

// 版本号来源：优先 APP_VERSION（由发布工作流按 tag 注入），否则用 package.json。
// 这样 CI 不需要把版本号提交回仓库，本地也就不会和远端分叉。
const appVersion = process.env.APP_VERSION || version

// NebulaDash: OpenClash routers are low-resource devices, so large third-party
// dependencies are split out of the entry chunk and the PWA precache is capped.
// Keep these groups in sync with `NEBULADASH-FEATURE-INVENTORY.md` §16.
const getManualChunk = (id: string): string | undefined => {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('three')) return 'three'
  if (id.includes('echarts')) return 'echarts'
  if (id.includes('zrender')) return 'zrender'
  if (id.includes('@tanstack')) return 'table'
  if (id.includes('vuedraggable') || id.includes('sortablejs')) return 'drag'
  if (id.includes('@heroicons')) return 'icons'
  if (id.includes('vue') || id.includes('@vue') || id.includes('vue-router')) return 'vue-vendor'

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_ID__: JSON.stringify(getGitCommitId()),
    __BUILD_TIME__: JSON.stringify(getBuildTime()),
    __FONT__: JSON.stringify(font),
  },
  base: './',
  plugins: [
    vue(),
    vueJsx(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-dark.svg'],
      workbox: {
        // The globe is lazy-loaded, but its local textures and bundled attribution must
        // remain available after the first PWA install/update for offline cache reuse.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,jpg,md}'],
        // The main chunk sits at ~1.75 MiB — under Workbox's 2 MiB default, but not
        // by enough to rely on. Keep the ceiling raised so it can't silently fall out
        // of the precache (and stop working offline) the next time it grows a little.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'NebulaDash',
        short_name: 'NebulaDash',
        description: 'NebulaDash - a dashboard using clash api',
        theme_color: '#000000',
        icons: [
          {
            src: './pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: './pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => getManualChunk(id),
      },
    },
  },
})
