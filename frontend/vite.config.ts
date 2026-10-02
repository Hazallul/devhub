import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Kütüphaneler ayrı dosyalarda: uygulama kodu değişince tarayıcı yalnızca değişen dosyayı yeniden indirir.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 30 },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 20 },
            { name: 'icons', test: /node_modules[\\/]@phosphor-icons[\\/]/, priority: 20 },
            { name: 'editor', test: /node_modules[\\/](@tiptap|prosemirror-[^\\/]+|linkifyjs|orderedmap|rope-sequence|w3c-keyname|fast-equals)[\\/]/, priority: 20 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    // Windows'taki Docker bind mount dosya değişikliği olaylarını container'a iletmez;
    // polling olmadan Vite değişiklikleri görmez ve eski kodu sunar.
    watch: { usePolling: true, interval: 300 },
    // Sistem İzleme'nin sağlık kontrolü compose ağı içinden "frontend" adıyla gelir.
    allowedHosts: ['frontend'],
  },
})
