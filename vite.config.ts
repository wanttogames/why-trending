import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { BRAND } from './shared/config'

export default defineConfig({
  plugins: [vue(), {name:'brand',transformIndexHtml(html){return html.replaceAll('TrendPick',BRAND.name)}}],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
