import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './node_modules/wired-elements/lib/wired-elements.js',
      formats: ['es'],
      name: 'WiredElements',
      fileName: 'wired-elements-bundle'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});