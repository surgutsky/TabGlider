import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    svelte(),
    crx({ manifest }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    // switching page is referenced in web_accessible_resources so crxjs
    // picks it up; no extra rollupOptions input needed
  },
})
