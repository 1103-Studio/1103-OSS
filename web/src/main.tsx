import React from 'react'
import ReactDOM from 'react-dom/client'
import zhCN from 'antd/locale/zh_CN'
import { App as AntApp, ConfigProvider, theme as antdTheme } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { AuthProvider } from './hooks/useAuth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          colorInfo: '#1677ff',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          colorBgLayout: '#f5f7fa',
          colorBgContainer: '#ffffff',
          colorText: '#1f2329',
          colorTextSecondary: '#73777d',
          colorBorder: '#e6e7eb',
          borderRadius: 4,
          fontSize: 12,
          fontSizeHeading1: 28,
          fontSizeHeading2: 22,
          fontSizeHeading3: 18,
          fontSizeHeading4: 16,
          controlHeight: 30,
          controlHeightLG: 34,
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#ffffff',
            bodyBg: '#f5f7fa',
            triggerBg: '#ffffff',
          },
          Menu: {
            itemBorderRadius: 2,
            itemHeight: 40,
            itemMarginBlock: 2,
            itemMarginInline: 8,
            itemSelectedBg: '#eff6ff',
            itemSelectedColor: '#1677ff',
          },
          Card: {
            bodyPadding: 16,
            headerHeight: 46,
          },
          Table: {
            headerBg: '#fafafa',
            rowHoverBg: '#f7fafe',
          },
          Button: {
            borderRadius: 3,
            controlHeight: 30,
            paddingInline: 12,
          },
          Tabs: {
            itemColor: '#4b5563',
            itemSelectedColor: '#1677ff',
            inkBarColor: '#1677ff',
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
