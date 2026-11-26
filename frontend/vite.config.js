import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const buildId = process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString()

function versionJsonPlugin(id) {
  return {
    name: 'version-json-plugin',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: id }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), versionJsonPlugin(buildId)],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
})
