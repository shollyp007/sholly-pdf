import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // Use relative paths in production so Electron can load from file://
  base: mode === 'production' ? './' : '/',
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib', 'zustand'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
