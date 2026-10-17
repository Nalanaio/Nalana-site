import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { kitPreloadErrors } from './vite-plugins/kit-preload-errors.js';

export default defineConfig({
  plugins: [kitPreloadErrors(), sveltekit()]
});
