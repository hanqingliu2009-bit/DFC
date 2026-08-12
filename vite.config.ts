import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Electron 加载本地文件时需要相对路径
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
