import { Suspense, lazy, type ReactElement } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import Layout from './components/Layout'
import { useAuth } from './hooks/useAuth'
import {
  ACCOUNT_PAGE_PERMISSIONS,
  IAM_PAGE_PERMISSIONS,
  MIGRATION_PAGE_PERMISSIONS,
  SUBSCRIPTION_PAGE_PERMISSIONS,
  TICKET_PAGE_PERMISSIONS,
} from './lib/permissions'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Buckets = lazy(() => import('./pages/Buckets'))
const Objects = lazy(() => import('./pages/Objects'))
const Settings = lazy(() => import('./pages/Settings'))
const About = lazy(() => import('./pages/About'))
const Login = lazy(() => import('./pages/Login'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const Migration = lazy(() => import('./pages/Migration'))
const AccessControl = lazy(() => import('./pages/AccessControl'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const Tickets = lazy(() => import('./pages/Tickets'))
const Tester = lazy(() => import('./pages/Tester'))
const AccessDenied = lazy(() => import('./pages/AccessDenied'))
const NotFound = lazy(() => import('./pages/NotFound'))

function AdminRoute({ children }: { children: ReactElement }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(...IAM_PAGE_PERMISSIONS)) {
    return <AccessDenied />
  }
  return children
}

function SuperAdminRoute({ children }: { children: ReactElement }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <AccessDenied />
  }
  return children
}

function PermissionRoute({ children, permissions }: { children: ReactElement; permissions: string[] }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(...permissions)) {
    return <AccessDenied />
  }
  return children
}

export default function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>}>
        <Login />
      </Suspense>
    )
  }

  return (
    <Layout>
      <Suspense fallback={<div style={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/buckets" element={<Buckets />} />
          <Route path="/buckets/:bucket/*" element={<Objects />} />
          <Route path="/migration" element={<PermissionRoute permissions={MIGRATION_PAGE_PERMISSIONS}><Migration /></PermissionRoute>} />
          <Route path="/accounts" element={<PermissionRoute permissions={ACCOUNT_PAGE_PERMISSIONS}><Accounts /></PermissionRoute>} />
          <Route path="/subscriptions" element={<PermissionRoute permissions={SUBSCRIPTION_PAGE_PERMISSIONS}><Subscriptions /></PermissionRoute>} />
          <Route path="/iam" element={<AdminRoute><AccessControl /></AdminRoute>} />
          <Route path="/tickets" element={<PermissionRoute permissions={TICKET_PAGE_PERMISSIONS}><Tickets /></PermissionRoute>} />
          <Route path="/tester" element={<Tester />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-logs" element={<SuperAdminRoute><AuditLogs /></SuperAdminRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
