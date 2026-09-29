import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Windows'taki Docker bind mount dosya değişikliği olaylarını container'a iletmez;
    // polling olmadan Vite değişiklikleri görmez ve eski kodu sunar.
    watch: { usePolling: true, interval: 300 },
    // Sistem İzleme'nin sağlık kontrolü compose ağı içinden "frontend" adıyla gelir.
    allowedHosts: ['frontend'],
  },
})
