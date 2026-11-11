import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    open: false,
    watch: {
      // Робочі файли пайплайна й бекенд не є частиною фронтенду. Без цього Vite
      // бачить новий pipeline/**/*.html, робить повне перезавантаження сторінки —
      // і завдання в обробці губилися.
      ignored: ['**/pipeline/**', '**/server/**'],
    },
    proxy: {
      // Проксі на pipeline-бекенд, щоб уникнути CORS і ходити на /api/*
      '/api': {
        // 127.0.0.1, а не localhost: на Windows localhost може піти в IPv6 (::1),
        // а бекенд слухає лише локальний IPv4.
        target: 'http://127.0.0.1:5176',
        changeOrigin: true,
      },
    },
  },
});
