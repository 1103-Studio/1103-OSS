import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const antdChunkGroups: Array<[string, string[]]> = [
  ['icons-vendor', ['@ant-design/icons']],
  ['antd-shell', ['/antd/es/config-provider', '/antd/es/layout', '/antd/es/grid', '/antd/es/menu', '/antd/es/theme', '/antd/es/style', 'rc-menu']],
  ['antd-forms', ['/antd/es/form', '/antd/es/input', '/antd/es/select', '/antd/es/upload', '/antd/es/switch', '/antd/es/checkbox', '/antd/es/radio', 'rc-field-form', 'rc-select', 'rc-upload', 'async-validator']],
  ['antd-data', ['/antd/es/table', '/antd/es/card', '/antd/es/list', '/antd/es/descriptions', '/antd/es/statistic', '/antd/es/tag', '/antd/es/avatar', '/antd/es/breadcrumb', 'rc-table', 'rc-pagination', 'rc-tree', 'rc-virtual-list']],
  ['antd-feedback', ['/antd/es/button', '/antd/es/alert', '/antd/es/modal', '/antd/es/progress', '/antd/es/spin', '/antd/es/drawer', '/antd/es/app', '/antd/es/message', '/antd/es/notification', 'rc-dialog', 'rc-drawer', 'rc-notification', 'rc-tooltip', 'rc-trigger', 'rc-motion', 'rc-util']],
]

function resolveAntdChunk(id: string) {
  for (const [chunkName, patterns] of antdChunkGroups) {
    if (patterns.some((pattern) => id.includes(pattern))) {
      return chunkName
    }
  }

  if (id.includes('/antd/')) {
    return 'antd-misc'
  }

  return undefined
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://gooss-api-dev:9000'

  return {
    plugins: [react()],
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'react-vendor'
            if (id.includes('@tanstack/react-query')) return 'query-vendor'
            if (id.includes('axios')) return 'network-vendor'

            const antdChunk = resolveAntdChunk(id)
            if (antdChunk) {
              return antdChunk
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: false,
        }
      }
    }
  }
})
