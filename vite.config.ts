import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    allowedHosts: ['.devtunnels.ms'],
  },
  preview: {
    allowedHosts: ['.devtunnels.ms'],
  },
});
