import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  cacheDir: fileURLToPath(new URL('../../node_modules/.vite-visual-fixture', import.meta.url)),
  plugins: [svelte({ configFile: false }), {
    name: 'synthetic-native-download',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/__synthetic-download?')) return next();
        response.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="synthetic-download.txt"',
          'Cache-Control': 'no-store',
        });
        response.end('Synthetic test response; no installer.');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 5198, strictPort: true },
});
