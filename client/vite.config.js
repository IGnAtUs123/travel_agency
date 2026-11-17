import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// В режиме разработки запросы к API и загруженным файлам проксируются на сервер Express.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
