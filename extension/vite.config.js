import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle: () => {
        // Copy background.js and contentScript.js to dist
        const files = ['background.js', 'contentScript.js'];
        files.forEach(file => {
          const src = path.resolve(__dirname, 'src', file);
          const dest = path.resolve(__dirname, 'dist', file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`Copied ${file} to dist`);
          }
        });

        // Copy icon files to dist
        const iconSizes = ['16', '48', '128'];
        iconSizes.forEach(size => {
          const src = path.resolve(__dirname, 'public', `icon-${size}.png`);
          const dest = path.resolve(__dirname, 'dist', `icon-${size}.png`);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          } else {
            // Create placeholder icon if doesn't exist
            console.log(`Icon ${size}x${size} not found - will use default`);
          }
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'src/[name].js',
        chunkFileNames: 'src/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  define: {
    'process.env': {}
  }
});
