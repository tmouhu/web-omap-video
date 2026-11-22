import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Public path of the built app. GitHub Pages serves a project site under /<repo>/; the deploy workflow sets
  // BASE_PATH from actions/configure-pages (empty for a custom domain or a <user>.github.io repository).
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH.replace(/\/+$/, '')}/` : '/',
  plugins: [svelte()],
  server: { port: 5173 },
});
