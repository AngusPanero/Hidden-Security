import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'deepdev-front.ngrok-free.app', // La URL de tu FRONT en ngrok
      'all'
    ]
  },
  build: {
    
    minify: 'esbuild',
    sourcemap: false, 
  },
  /* esbuild: {
    drop: ['console', 'debugger'],
  }, */
})
