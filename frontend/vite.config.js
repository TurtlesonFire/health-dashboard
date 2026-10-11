import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The dev proxy forwards /api to the FastAPI backend. In a static build there
// is no backend — /api/*.json files are served from public/ — so the proxy MUST
// be off, or it intercepts those requests and fails with ECONNREFUSED. Note
// `vite preview` also applies `server.proxy`, so a static preview would break
// without this guard.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const dataMode = env.VITE_DATA_MODE || 'api'
  const useProxy = dataMode !== 'static'

  return {
    plugins: [react()],
    // GitHub Pages serves project sites at /<repo>/, so asset paths must be
    // prefixed accordingly in the production build. Dev mode serves from root.
    base: dataMode === 'static' ? '/health-dashboard/' : '/',
    server: {
      port: 3000,
      ...(useProxy
        ? {
            proxy: {
              '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
              },
            },
          }
        : {}),
    },
  }
})
