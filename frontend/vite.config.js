import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Appels au backend en local : /api -> backend lancé sur le poste (src/api.js)
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  // Tests unitaires (vitest) : DOM simulé par jsdom
  test: {
    environment: 'jsdom',
    coverage: {
      include: ['src/**/*.{js,jsx}'], // pas les css / images importés
      exclude: ['src/main.jsx'], // mêmes exclusions que sonar.coverage.exclusions
    },
  },
});
